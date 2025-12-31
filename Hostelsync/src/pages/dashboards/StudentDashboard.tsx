import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, Clock, MapPin, Phone, User, FileText, Bell, MessageSquare, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DashboardHeader from "@/components/DashboardHeader";
import StudentProfile from "@/components/StudentProfile";
import ApprovalSlip from "@/components/ApprovalSlip";

export default function StudentDashboard() {
  useEffect(() => { document.title = "Student Dashboard | HostelSync"; }, []);
  
  const [outingRequests, setOutingRequests] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    outing_type: "",
    from_date: "",
    to_date: "",
    from_time: "",
    to_time: "",
    destination: "",
    reason: "",
    contact_person: "",
    contact_phone: "",
  });
  const [complaintData, setComplaintData] = useState({
    title: "",
    description: "",
    category: "",
    photos: [] as Array<{ file: File; preview: string; name: string }>,
  });
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Fetch outing requests with profile information
      const { data: requests } = await supabase
        .from("outing_requests")
        .select(`
          *,
          profiles:student_id (full_name, student_id)
        `)
        .eq("student_id", user.data.user.id)
        .order("created_at", { ascending: false });

      // Fetch notices for students
      const { data: noticeData } = await supabase
        .from("notices")
        .select("*")
        .contains("target_roles", ["student"])
        .order("created_at", { ascending: false })
        .limit(10);

      setOutingRequests(requests || []);
      setNotices(noticeData || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Determine the starting stage based on outing type
      const currentStage = formData.outing_type === "local" ? "warden" : "advisor";

      const { error } = await supabase.from("outing_requests").insert({
        student_id: user.data.user.id,
        outing_type: formData.outing_type as "local" | "hometown",
        from_date: formData.from_date,
        to_date: formData.to_date,
        from_time: formData.from_time || null,
        to_time: formData.to_time || null,
        destination: formData.destination,
        reason: formData.reason,
        contact_person: formData.outing_type === "hometown" ? formData.contact_person : null,
        contact_phone: formData.outing_type === "hometown" ? formData.contact_phone : null,
        current_stage: currentStage,
      });

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: `Outing request submitted successfully! ${
          formData.outing_type === "local" 
            ? "Request sent to Warden for approval." 
            : "Request sent to Advisor for initial review."
        }` 
      });
      setFormData({
        outing_type: "",
        from_date: "",
        to_date: "",
        from_time: "",
        to_time: "",
        destination: "",
        reason: "",
        contact_person: "",
        contact_phone: "",
      });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit request", variant: "destructive" });
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return <Badge className={colors[status] || colors.pending}>{status}</Badge>;
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    if (files.length === 0) return;

    const maxFiles = 3;
    const maxSize = 5 * 1024 * 1024; // 5MB per file

    if (complaintData.photos.length + files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `You can only upload up to ${maxFiles} photos`,
        variant: "destructive",
      });
      return;
    }

    for (const file of files) {
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `File ${file.name} is too large. Maximum size is 5MB`,
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: `File ${file.name} is not an image`,
          variant: "destructive",
        });
        return;
      }
    }

    // Convert files to base64 for preview
    const newPhotos = await Promise.all(
      files.map(async (file) => {
        return new Promise<{ file: File; preview: string; name: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              file,
              preview: e.target?.result as string,
              name: file.name,
            });
          };
          reader.readAsDataURL(file);
        });
      })
    );

    setComplaintData(prev => ({
      ...prev,
      photos: [...prev.photos, ...newPhotos],
    }));
  };

  const removePhoto = (index: number) => {
    setComplaintData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingComplaint(true);

    try {
      const user = await supabase.auth.getUser();
      
      // Upload photos to storage if any
      const photoUrls = [];
      if (complaintData.photos.length > 0) {
        for (const photo of complaintData.photos) {
          const fileName = `complaint-${Date.now()}-${Math.random().toString(36).substring(7)}.${photo.file.name.split('.').pop()}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(`complaints/${fileName}`, photo.file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Failed to upload ${photo.name}`);
          }

          const { data: { publicUrl } } = supabase.storage
            .from('profile-photos')
            .getPublicUrl(uploadData.path);

          photoUrls.push(publicUrl);
        }
      }

      // Submit complaint
      const { error } = await supabase.from("complaints").insert({
        title: complaintData.title,
        description: complaintData.description,
        category: complaintData.category,
        is_anonymous: true,
        submitted_by: user.data.user?.id || null,
        admin_response: photoUrls.length > 0 ? JSON.stringify({ photos: photoUrls }) : null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your anonymous complaint has been submitted successfully",
      });

      // Reset form
      setComplaintData({
        title: "",
        description: "",
        category: "",
        photos: [],
      });

    } catch (error) {
      console.error('Complaint submission error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit complaint",
        variant: "destructive",
      });
    } finally {
      setSubmittingComplaint(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-6 bg-background">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        title="Student Dashboard" 
        subtitle="Apply for outings and track your requests" 
        userRole="student" 
      />
      <main className="p-6">
        <div className="max-w-7xl mx-auto">

        <Tabs defaultValue="apply" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="apply">Apply for Outing</TabsTrigger>
            <TabsTrigger value="requests">My Requests</TabsTrigger>
            <TabsTrigger value="notices">Notices</TabsTrigger>
            <TabsTrigger value="complaints">Anonymous Complaints</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="apply" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  New Outing Request
                </CardTitle>
                <CardDescription>Fill out the form to request permission for an outing</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="outing_type">Outing Type</Label>
                      <Select value={formData.outing_type} onValueChange={(value) => setFormData(prev => ({ ...prev, outing_type: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select outing type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local">Local Outing</SelectItem>
                          <SelectItem value="hometown">Hometown Visit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="destination">Destination</Label>
                      <Input
                        id="destination"
                        value={formData.destination}
                        onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                        placeholder="Enter destination"
                        required
                      />
                    </div>

                    {formData.outing_type === "local" ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="from_date">Outing Date</Label>
                          <Input
                            id="from_date"
                            type="date"
                            value={formData.from_date}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              from_date: e.target.value, 
                              to_date: e.target.value // Same day for local outing
                            }))}
                            min={new Date().toISOString().split('T')[0]}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="from_time">Going Out Time</Label>
                          <Input
                            id="from_time"
                            type="time"
                            value={formData.from_time}
                            onChange={(e) => setFormData(prev => ({ ...prev, from_time: e.target.value }))}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="to_time">Return Time</Label>
                          <Input
                            id="to_time"
                            type="time"
                            value={formData.to_time}
                            onChange={(e) => setFormData(prev => ({ ...prev, to_time: e.target.value }))}
                            required
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="from_date">From Date</Label>
                          <Input
                            id="from_date"
                            type="date"
                            value={formData.from_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, from_date: e.target.value }))}
                            min={new Date().toISOString().split('T')[0]}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="to_date">To Date</Label>
                          <Input
                            id="to_date"
                            type="date"
                            value={formData.to_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, to_date: e.target.value }))}
                            min={formData.from_date || new Date().toISOString().split('T')[0]}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contact_person">Contact Person</Label>
                          <Input
                            id="contact_person"
                            value={formData.contact_person}
                            onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                            placeholder="Contact person name"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contact_phone">Contact Phone</Label>
                          <Input
                            id="contact_phone"
                            value={formData.contact_phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                            placeholder="Contact phone number"
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Outing</Label>
                    <Textarea
                      id="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Provide detailed reason for the outing"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full">Submit Request</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Outing Requests</CardTitle>
                <CardDescription>Track the status of your outing requests</CardDescription>
              </CardHeader>
              <CardContent>
                {outingRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No requests found</p>
                ) : (
                  <Table>
                    <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Date Range</TableHead>
                          <TableHead>Current Stage</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Pass</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {outingRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="capitalize">{request.outing_type}</TableCell>
                            <TableCell>{request.destination}</TableCell>
                            <TableCell>
                              {request.from_date} to {request.to_date}
                              {request.from_time && (
                                <div className="text-sm text-muted-foreground">
                                  {request.from_time} - {request.to_time}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="capitalize">{request.current_stage}</TableCell>
                            <TableCell>{getStatusBadge(request.final_status)}</TableCell>
                            <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              {request.final_status === "approved" && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                      View Pass
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Official Outing Pass</DialogTitle>
                                      <DialogDescription>
                                        Present this pass to security for verification
                                      </DialogDescription>
                                    </DialogHeader>
                                    <ApprovalSlip request={request} />
                                  </DialogContent>
                                </Dialog>
                              )}
                              {request.final_status !== "approved" && (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notices" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Recent Notices
                </CardTitle>
                <CardDescription>Important announcements and updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No notices available</p>
                ) : (
                  notices.map((notice) => (
                    <div key={notice.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{notice.title}</h3>
                        {notice.is_urgent && <Badge variant="destructive">Urgent</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{notice.content}</p>
                      <p className="text-xs text-muted-foreground">
                        Posted on {new Date(notice.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="complaints" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Anonymous Complaints
                </CardTitle>
                <CardDescription>
                  Submit anonymous complaints or feedback. Your identity will be kept confidential.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitComplaint} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="complaint-title">Title</Label>
                    <Input
                      id="complaint-title"
                      value={complaintData.title}
                      onChange={(e) => setComplaintData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Brief title for your complaint"
                      required
                      maxLength={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="complaint-category">Category</Label>
                    <Select 
                      value={complaintData.category} 
                      onValueChange={(value) => setComplaintData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select complaint category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hostel">Hostel Facilities</SelectItem>
                        <SelectItem value="food">Food & Mess</SelectItem>
                        <SelectItem value="academic">Academic Issues</SelectItem>
                        <SelectItem value="infrastructure">Infrastructure</SelectItem>
                        <SelectItem value="staff">Staff Behavior</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="medical">Medical Facilities</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="complaint-description">Description</Label>
                    <Textarea
                      id="complaint-description"
                      value={complaintData.description}
                      onChange={(e) => setComplaintData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Provide detailed description of your complaint..."
                      required
                      className="min-h-[120px]"
                      maxLength={1000}
                    />
                    <div className="text-xs text-muted-foreground text-right">
                      {complaintData.description.length}/1000 characters
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="complaint-photos">Photos (Optional)</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          id="complaint-photos"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('complaint-photos').click()}
                          disabled={complaintData.photos.length >= 3}
                          className="flex items-center gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          Upload Photos (Max 3)
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {complaintData.photos.length}/3 photos
                        </span>
                      </div>

                      {complaintData.photos.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {complaintData.photos.map((photo, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={photo.preview}
                                alt={`Complaint photo ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removePhoto(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                              <div className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs p-1 rounded text-center truncate">
                                {photo.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      You can upload up to 3 photos (max 5MB each). Supported formats: JPG, PNG, GIF
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800">Anonymous Submission</p>
                        <p className="text-yellow-700 mt-1">
                          This complaint will be submitted anonymously. Your identity will not be revealed to administrators,
                          but the complaint will be reviewed and addressed appropriately.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={submittingComplaint || !complaintData.title || !complaintData.description || !complaintData.category}
                  >
                    {submittingComplaint ? "Submitting..." : "Submit Anonymous Complaint"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <StudentProfile />
          </TabsContent>
        </Tabs>
      </div>
    </main>
    </div>
  );
}
