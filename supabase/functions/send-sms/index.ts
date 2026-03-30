import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    if (!RESEND_FROM_EMAIL) {
      throw new Error("RESEND_FROM_EMAIL is not configured. Set it to something like 'Hostel Management <noreply@yourdomain.com>'");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { requestId } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: "requestId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for duplicate: if email already sent for this request, skip
    const { data: existingLog } = await supabase
      .from("email_notification_log")
      .select("id")
      .eq("request_id", requestId)
      .eq("status", "sent")
      .maybeSingle();

    if (existingLog) {
      console.log("Email already sent for request:", requestId);
      return new Response(JSON.stringify({ email_sent: true, message: "Email already sent previously" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch outing request with student profile
    const { data: request, error: reqError } = await supabase
      .from("outing_requests")
      .select(`
        *,
        profiles!outing_requests_student_id_fkey (
          full_name, student_id, guardian_email, guardian_name, hostel_type
        )
      `)
      .eq("id", requestId)
      .eq("final_status", "approved")
      .single();

    if (reqError || !request) {
      console.error("Failed to fetch request:", reqError);
      return new Response(JSON.stringify({ error: "Request not found or not approved" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = request.profiles;
    const guardianEmail = profile?.guardian_email?.trim();

    if (!guardianEmail) {
      console.warn("No guardian email for request:", requestId);
      // Log the failure
      await supabase.from("email_notification_log").insert({
        request_id: requestId,
        recipient_email: "N/A",
        status: "failed",
        error_message: "No guardian email on file",
      });
      return new Response(JSON.stringify({ error: "No guardian email on file", email_sent: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hostelLabel = profile?.hostel_type === "boys" ? "Boys Hostel" : "Girls Hostel";
    const outTime = request.from_time || "N/A";
    const returnTime = request.to_time || "N/A";
    const guardianName = profile?.guardian_name || "Parent/Guardian";

    const resend = new Resend(RESEND_API_KEY);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 10px;">
          🏫 Hostel Outing Pass - Approved
        </h2>
        <p>Dear <strong>${guardianName}</strong>,</p>
        <p>This is to inform you that your ward has been granted outing permission. Please find the details below:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #ebf8ff;">
            <td style="padding: 10px; border: 1px solid #bee3f8; font-weight: bold;">Student Name</td>
            <td style="padding: 10px; border: 1px solid #bee3f8;">${profile?.full_name || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #bee3f8; font-weight: bold;">Register No.</td>
            <td style="padding: 10px; border: 1px solid #bee3f8;">${profile?.student_id || "N/A"}</td>
          </tr>
          <tr style="background: #ebf8ff;">
            <td style="padding: 10px; border: 1px solid #bee3f8; font-weight: bold;">Outing Type</td>
            <td style="padding: 10px; border: 1px solid #bee3f8;">${request.outing_type === "local" ? "Local Outing" : "Hometown Visit"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #bee3f8; font-weight: bold;">From</td>
            <td style="padding: 10px; border: 1px solid #bee3f8;">${request.from_date} at ${outTime}</td>
          </tr>
          <tr style="background: #ebf8ff;">
            <td style="padding: 10px; border: 1px solid #bee3f8; font-weight: bold;">To</td>
            <td style="padding: 10px; border: 1px solid #bee3f8;">${request.to_date} at ${returnTime}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #bee3f8; font-weight: bold;">Destination</td>
            <td style="padding: 10px; border: 1px solid #bee3f8;">${request.destination}</td>
          </tr>
          <tr style="background: #ebf8ff;">
            <td style="padding: 10px; border: 1px solid #bee3f8; font-weight: bold;">Hostel</td>
            <td style="padding: 10px; border: 1px solid #bee3f8;">${hostelLabel}</td>
          </tr>
        </table>
        <p style="color: #718096; font-size: 14px;">
          This is an automated notification from the Hostel Management System.<br/>
          Approved by the Hostel Warden.
        </p>
      </div>
    `;

    const emailResult = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [guardianEmail],
      subject: `Outing Pass Approved - ${profile?.full_name} (${profile?.student_id})`,
      html: emailHtml,
    });

    console.log("Resend API response:", JSON.stringify(emailResult));

    if (emailResult.error) {
      console.error("Email failed:", emailResult.error);
      await supabase.from("email_notification_log").insert({
        request_id: requestId,
        recipient_email: guardianEmail,
        status: "failed",
        error_message: emailResult.error.message || "Email delivery failed",
      });
      return new Response(JSON.stringify({ email_sent: false, error: emailResult.error.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log success
    await supabase.from("email_notification_log").insert({
      request_id: requestId,
      recipient_email: guardianEmail,
      status: "sent",
    });

    console.log("Email sent successfully to", guardianEmail);
    return new Response(JSON.stringify({ email_sent: true, message: "Email sent successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Email function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ email_sent: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
