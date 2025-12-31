import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Upload, User, GraduationCap, Users } from "lucide-react";
import { z } from "zod";

type LoginRole = "student" | "staff" | "admin";
type RegisterRole = "student" | "staff";
type StaffSubtype = "advisor" | "hod" | "warden" | "principal";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  // Login states
  const [loginRole, setLoginRole] = useState<LoginRole>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

// Register states
  const [registerRole, setRegisterRole] = useState<RegisterRole>("student");
  const [staffSubtype, setStaffSubtype] = useState<StaffSubtype>("advisor");
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    rollNumber: "",
    departmentId: "",
    year: "",
    roomId: "",
    designation: "",
    guardianName: "",
    guardianPhone: "",
    localAddress: "",
    permanentAddress: "",
    photo: null as File | null,
  });

  useEffect(() => {
    if (registerRole === "student") {
      fetchAvailableRooms();
      fetchDepartments();
    }
  }, [registerRole]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) {
        console.error("Error fetching departments:", error);
      } else {
        setAvailableDepartments(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching departments:", err);
    }
  };

  const fetchAvailableRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("floor", { ascending: true })
        .order("room_number", { ascending: true });
      
      if (error) {
        console.error("Error fetching rooms:", error);
        setAvailableRooms([]);
        return;
      }
      
      // Filter rooms where occupied < capacity on client side
      const available = (data || []).filter(room => room.occupied < room.capacity);
      setAvailableRooms(available);
      
      console.log("Available rooms:", available.length);
    } catch (err) {
      console.error("Unexpected error fetching rooms:", err);
      setAvailableRooms([]);
    }
  };

  useEffect(() => {
    document.title = mode === "login" ? "Login | HostelSync" : "Register | HostelSync";
  }, [mode]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setTimeout(async () => {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle();
          const role = (data?.role as string | undefined) ?? "student";
          navigate(`/dashboard/${role}`, { replace: true });
        }, 0);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();
        const role = (data?.role as string | undefined) ?? "student";
        navigate(`/dashboard/${role}`, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const okType = ["image/jpeg", "image/png"].includes(file.type);
    const okSize = file.size <= 2 * 1024 * 1024;

    if (!okType) {
      toast({ title: "Invalid file type", description: "Only JPG or PNG images are allowed.", variant: "destructive" });
      return;
    }
    if (!okSize) {
      toast({ title: "File too large", description: "Maximum size is 2MB.", variant: "destructive" });
      return;
    }

    setFormData(prev => ({ ...prev, photo: file }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      
      // All users (including admin) use Supabase authentication
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      // Check if user is approved (for staff members)
      if (data.user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_approved, role")
          .eq("user_id", data.user.id)
          .maybeSingle();
        
        if (profileData && !profileData.is_approved && profileData.role !== 'student') {
          // Sign out the user immediately
          await supabase.auth.signOut();
          toast({ 
            title: "Account Pending Approval", 
            description: "Your staff account is pending admin approval. You will be notified once approved.", 
            variant: "destructive" 
          });
          return;
        }
      }
      
      toast({ title: "Welcome back!", description: "Successfully logged in." });
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message || "Invalid credentials. Please check your email and password.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const uploadPhoto = async (file: File, userId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}.${fileExt}`;
      const filePath = fileName; // Upload directly to bucket root

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Photo upload error:', uploadError);
        toast({
          title: "Photo upload failed",
          description: uploadError.message,
          variant: "destructive"
        });
        return null;
      }

      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Photo upload error:', error);
      return null;
    }
  };

  const handleRegister = async () => {
    try {
      setLoading(true);

      // Validate inputs with Zod
      const studentSchema = z.object({
        fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
        email: z.string().email("Invalid email address").max(255, "Email too long"),
        phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        rollNumber: registerRole === "student" ? z.string().trim().min(1, "Roll number required").max(50, "Roll number too long") : z.string().optional(),
        year: registerRole === "student" ? z.string().regex(/^[1-5]$/, "Year must be 1-5") : z.string().optional(),
        guardianPhone: z.string().regex(/^\d{10}$/, "Guardian phone must be 10 digits").optional().or(z.literal("")),
        localAddress: z.string().max(500, "Local address too long").optional(),
        permanentAddress: z.string().max(500, "Permanent address too long").optional(),
      });

      const validationResult = studentSchema.safeParse({
        fullName: formData.fullName,
        email,
        phone: formData.phone,
        password,
        rollNumber: formData.rollNumber,
        year: formData.year,
        guardianPhone: formData.guardianPhone,
        localAddress: formData.localAddress,
        permanentAddress: formData.permanentAddress,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast({ 
          title: "Validation Error", 
          description: firstError.message, 
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/`;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { 
            full_name: formData.fullName,
            role: registerRole === "staff" ? staffSubtype : "student"
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      // Upload photo if provided
      let photoUrl = null;
      if (formData.photo) {
        photoUrl = await uploadPhoto(formData.photo, authData.user.id);
      }

      // The trigger should automatically create the profile
      // But we'll update it with additional details if needed
      const profileData: any = {
        phone: formData.phone,
        photo_url: photoUrl,
        is_approved: false
      };

      if (registerRole === "student") {
        profileData.student_id = formData.rollNumber;
        profileData.year_of_study = parseInt(formData.year);
        profileData.room_id = formData.roomId || null;
        profileData.department_id = formData.departmentId || null;
        profileData.guardian_name = formData.guardianName || null;
        profileData.guardian_phone = formData.guardianPhone || null;
        profileData.local_address = formData.localAddress || null;
        profileData.permanent_address = formData.permanentAddress || null;
        profileData.is_approved = true; // Auto-approve students
      } else if (registerRole === "staff") {
        profileData.staff_id = formData.designation || staffSubtype;
      }

      // Update the existing profile created by the trigger
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileData)
        .eq("user_id", authData.user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
        // Don't throw error here as the user is already created
      }

      const approvalMessage = registerRole === "staff" 
        ? "Staff registration successful! Your account is pending admin approval. You will be notified once approved."
        : "Student registered! You can now log in.";
      
      toast({ 
        title: "Registration successful!", 
        description: approvalMessage
      });
      setMode("login");
    } catch (e: any) {
      console.error("Registration error:", e);
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderLoginRoleButtons = () => (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {[
        { role: "student" as LoginRole, icon: GraduationCap, label: "Student" },
        { role: "staff" as LoginRole, icon: Users, label: "Staff" },
        { role: "admin" as LoginRole, icon: User, label: "Admin" }
      ].map(({ role, icon: Icon, label }) => (
        <button
          key={role}
          type="button"
          onClick={() => setLoginRole(role)}
          className={`py-3 px-2 rounded-lg border transition-all duration-200 flex flex-col items-center gap-1 ${
            loginRole === role
              ? "bg-primary text-primary-foreground border-primary shadow-md"
              : "bg-background border-border hover:border-primary/50 hover:bg-accent/50"
          }`}
        >
          <Icon size={16} />
          <span className="text-xs font-medium">{label}</span>
        </button>
      ))}
    </div>
  );

  const renderRegisterFields = () => (
    <div className="space-y-4">
      {/* Common fields */}
      <div>
        <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
          Full Name
        </Label>
        <Input 
          id="fullName"
          type="text"
          placeholder="Enter your full name"
          value={formData.fullName}
          onChange={(e) => handleInputChange("fullName", e.target.value)}
          className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
          required
        />
      </div>

      <div>
        <Label htmlFor="phone" className="text-sm font-medium text-foreground">
          Phone Number
        </Label>
        <Input 
          id="phone"
          type="tel"
          placeholder="Enter your phone number"
          value={formData.phone}
          onChange={(e) => handleInputChange("phone", e.target.value)}
          className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
          required
        />
      </div>

      {/* Role selection */}
      <div>
        <Label className="text-sm font-medium text-foreground mb-3 block">
          Register as
        </Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRegisterRole("student")}
            className={`flex-1 py-3 rounded-lg border transition-all duration-200 flex items-center justify-center gap-2 ${
              registerRole === "student"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/50 hover:bg-accent/50"
            }`}
          >
            <GraduationCap size={16} />
            Student
          </button>
          <button
            type="button"
            onClick={() => setRegisterRole("staff")}
            className={`flex-1 py-3 rounded-lg border transition-all duration-200 flex items-center justify-center gap-2 ${
              registerRole === "staff"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/50 hover:bg-accent/50"
            }`}
          >
            <Users size={16} />
            Staff
          </button>
        </div>
      </div>

      {/* Student specific fields */}
      {registerRole === "student" && (
        <>
          <div>
            <Label htmlFor="rollNumber" className="text-sm font-medium text-foreground">
              Register Number
            </Label>
            <Input 
              id="rollNumber"
              type="text"
              placeholder="Enter your register number"
              value={formData.rollNumber}
              onChange={(e) => handleInputChange("rollNumber", e.target.value)}
              className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
              required
            />
          </div>

          <div>
            <Label htmlFor="department" className="text-sm font-medium text-foreground">
              Department
            </Label>
            <Select 
              value={formData.departmentId} 
              onValueChange={(value) => handleInputChange("departmentId", value)}
            >
              <SelectTrigger className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all">
                <SelectValue placeholder="Select your department" />
              </SelectTrigger>
              <SelectContent>
                {availableDepartments.length === 0 ? (
                  <SelectItem disabled value="__no_departments__">
                    No departments available
                  </SelectItem>
                ) : (
                  availableDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="year" className="text-sm font-medium text-foreground">
              Year of Study
            </Label>
            <Input 
              id="year"
              type="text"
              placeholder="e.g., I, II, III, IV"
              value={formData.year}
              onChange={(e) => handleInputChange("year", e.target.value)}
              className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
              required
            />
          </div>

          <div>
            <Label htmlFor="roomId" className="text-sm font-medium text-foreground">
              Room Number
            </Label>
            <Select 
              value={formData.roomId} 
              onValueChange={(value) => handleInputChange("roomId", value)}
            >
              <SelectTrigger className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all">
                <SelectValue placeholder="Select your room" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableRooms.length === 0 ? (
                  <SelectItem disabled value="__no_rooms__">No rooms available</SelectItem>
                ) : (
                  <>
                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">
                        Ground Floor (Rooms 1-33)
                      </SelectLabel>
                      {availableRooms
                        .filter((r) => r.floor === 0)
                        .map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number} ({room.occupied}/{room.capacity} occupied)
                          </SelectItem>
                        ))}
                    </SelectGroup>

                    <SelectSeparator />

                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">
                        First Floor (Rooms 101-133)
                      </SelectLabel>
                      {availableRooms
                        .filter((r) => r.floor === 1)
                        .map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number} ({room.occupied}/{room.capacity} occupied)
                          </SelectItem>
                        ))}
                    </SelectGroup>

                    <SelectSeparator />

                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">
                        Second Floor (Rooms 201-233)
                      </SelectLabel>
                      {availableRooms
                        .filter((r) => r.floor === 2)
                        .map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number} ({room.occupied}/{room.capacity} occupied)
                          </SelectItem>
                        ))}
                    </SelectGroup>

                    <SelectSeparator />

                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">
                        Third Floor (Rooms 301-333)
                      </SelectLabel>
                      {availableRooms
                        .filter((r) => r.floor === 3)
                        .map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number} ({room.occupied}/{room.capacity} occupied)
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Select an available room with space
            </p>
          </div>

          <div>
            <Label htmlFor="guardianName" className="text-sm font-medium text-foreground">
              Guardian Name
            </Label>
            <Input 
              id="guardianName"
              type="text"
              placeholder="Enter guardian's full name"
              value={formData.guardianName}
              onChange={(e) => handleInputChange("guardianName", e.target.value)}
              className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
            />
          </div>

          <div>
            <Label htmlFor="guardianPhone" className="text-sm font-medium text-foreground">
              Guardian Phone
            </Label>
            <Input 
              id="guardianPhone"
              type="tel"
              placeholder="Enter guardian's phone number"
              value={formData.guardianPhone}
              onChange={(e) => handleInputChange("guardianPhone", e.target.value)}
              className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
            />
          </div>

          <div>
            <Label htmlFor="localAddress" className="text-sm font-medium text-foreground">
              Local Address
            </Label>
            <Input 
              id="localAddress"
              type="text"
              placeholder="Enter local/hostel address"
              value={formData.localAddress}
              onChange={(e) => handleInputChange("localAddress", e.target.value)}
              className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
            />
          </div>

          <div>
            <Label htmlFor="permanentAddress" className="text-sm font-medium text-foreground">
              Permanent Address
            </Label>
            <Input 
              id="permanentAddress"
              type="text"
              placeholder="Enter permanent/home address"
              value={formData.permanentAddress}
              onChange={(e) => handleInputChange("permanentAddress", e.target.value)}
              className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
            />
          </div>
        </>
      )}

      {/* Staff specific fields */}
      {registerRole === "staff" && (
        <>
          <div>
            <Label className="text-sm font-medium text-foreground">
              Staff Designation
            </Label>
            <RadioGroup
              value={staffSubtype}
              onValueChange={(value) => setStaffSubtype(value as StaffSubtype)}
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="advisor" id="advisor" />
                <Label htmlFor="advisor">Advisor</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hod" id="hod" />
                <Label htmlFor="hod">HOD (Head of Department)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="warden" id="warden" />
                <Label htmlFor="warden">Warden</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="principal" id="principal" />
                <Label htmlFor="principal">Principal</Label>
              </div>
            </RadioGroup>
          </div>

          {staffSubtype !== "warden" && (
            <div>
              <Label htmlFor="designation" className="text-sm font-medium text-foreground">
                Specific Designation
              </Label>
              <Input 
                id="designation"
                type="text"
                placeholder="e.g., Assistant Professor, Associate Professor"
                value={formData.designation}
                onChange={(e) => handleInputChange("designation", e.target.value)}
                className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
                required
              />
            </div>
          )}
        </>
      )}

      {/* Photo upload */}
      <div>
        <Label htmlFor="photo" className="text-sm font-medium text-foreground">
          {registerRole === "student" ? "Passport-size Photo" : "Formal Photo"}
        </Label>
        <div className="mt-1 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById("photo")?.click()}
            className="flex items-center gap-2"
          >
            <Upload size={16} />
            Choose Photo
          </Button>
          <span className="text-sm text-muted-foreground">
            {formData.photo ? formData.photo.name : "No file selected"}
          </span>
        </div>
        <input
          id="photo"
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          className="hidden"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG only. Max 2MB. Upload a clear {registerRole === "student" ? "passport-size" : "formal"} photo.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/10 to-accent/10 px-4">
      <div className="bg-card/80 backdrop-blur-sm border border-border/20 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            HostelSync
          </h1>
          <h2 className="text-xl font-semibold text-foreground mt-2">
            SPCET Hostel Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Secure access for Students, Staff and Admin
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex mb-6 rounded-xl overflow-hidden border border-border bg-muted/50">
          <button
            className={`flex-1 py-3 px-4 font-medium transition-all duration-200 ${
              mode === "login" 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={`flex-1 py-3 px-4 font-medium transition-all duration-200 ${
              mode === "register" 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
            onClick={() => setMode("register")}
            type="button"
          >
            Register
          </button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          mode === "login" ? handleLogin() : handleRegister();
        }} className="space-y-5">
          
          {/* Login Form */}
          {mode === "login" && (
            <>
              {renderLoginRoleButtons()}
              
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email Address
                </Label>
                <Input 
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <Input 
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
                  required
                />
              </div>
            </>
          )}

          {/* Register Form */}
          {mode === "register" && (
            <>
              {renderRegisterFields()}
              
              <div>
                <Label htmlFor="regEmail" className="text-sm font-medium text-foreground">
                  Email Address
                </Label>
                <Input 
                  id="regEmail"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
                  required
                />
              </div>

              <div>
                <Label htmlFor="regPassword" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <Input 
                  id="regPassword"
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all"
                  required
                />
              </div>
            </>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </div>
            ) : (
              mode === "login" ? "Sign In" : "Create Account"
            )}
          </Button>
        </form>

        {mode === "register" && (
          <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border/30">
            <p className="text-sm text-muted-foreground text-center">
              <span className="inline-block w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
              Registration requires admin approval before account activation.
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            By continuing, you agree to our terms and conditions
          </p>
        </div>
      </div>
    </div>
  );
}