// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { email: bodyEmail, password: bodyPassword } = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    // Require email and password in every request - no defaults for security
    if (!bodyEmail || !bodyPassword) {
      return new Response(
        JSON.stringify({ error: "email and password are required in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = bodyEmail.trim();
    const password = bodyPassword;

    // Enforce strong password requirements
    if (password.length < 12) {
      return new Response(
        JSON.stringify({ error: "password must be at least 12 characters long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Check if an admin already exists
    const { data: existingAdmin, error: adminCheckError } = await admin
      .from("profiles")
      .select("id,email,user_id")
      .eq("role", "admin")
      .maybeSingle();

    if (adminCheckError) {
      console.error("Error checking existing admin:", adminCheckError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing admin", details: adminCheckError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingAdmin) {
      // If admin exists but with a different email, block bootstrap
      if (existingAdmin.email?.toLowerCase() !== email.toLowerCase()) {
        return new Response(
          JSON.stringify({
            error: "Admin already exists",
            details: "Admin is set to a different email. Use the admin transfer workflow.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Admin exists with same email; ensure password is set as requested
      const { error: updatePwdError } = await admin.auth.admin.updateUserById(existingAdmin.user_id as string, {
        password,
      });

      if (updatePwdError) {
        console.error("Error updating admin password:", updatePwdError);
        // Continue but report the issue
        return new Response(
          JSON.stringify({
            message: "Admin already exists with the requested email. Failed to update password.",
            details: updatePwdError.message,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message: "Admin already existed. Password updated successfully." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) No admin exists yet
    // Try to find a profile by this email (user may already exist)
    const { data: existingProfile, error: profileLookupError } = await admin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (profileLookupError) {
      console.error("Error looking up profile by email:", profileLookupError);
      return new Response(
        JSON.stringify({ error: "Failed to look up profile", details: profileLookupError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingProfile?.user_id) {
      // Promote existing user to admin and set password
      const [{ error: profileUpdateError }, { error: pwdUpdateError }] = await Promise.all([
        admin.from("profiles").update({ role: "admin", is_approved: true }).eq("user_id", existingProfile.user_id),
        admin.auth.admin.updateUserById(existingProfile.user_id, { password }),
      ]);

      if (profileUpdateError) {
        console.error("Error promoting existing profile to admin:", profileUpdateError);
        return new Response(
          JSON.stringify({ error: "Failed to promote existing profile", details: profileUpdateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (pwdUpdateError) {
        console.warn("Admin promoted but failed to update password:", pwdUpdateError);
        return new Response(
          JSON.stringify({ message: "Admin promoted. Failed to update password.", details: pwdUpdateError.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message: "Existing user promoted to admin and password set." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Create a new user as admin
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Admin" },
    });

    if (createError) {
      console.error("Error creating admin user:", createError);
      return new Response(
        JSON.stringify({ error: "Failed to create admin user", details: createError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin user created:", created?.user?.id);

    // The profile row will be created by trigger handle_new_user and auto-promoted by trg_auto_promote_specific_admin
    return new Response(
      JSON.stringify({ message: "Admin user created successfully." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Unexpected error in bootstrap-admin:", e);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
