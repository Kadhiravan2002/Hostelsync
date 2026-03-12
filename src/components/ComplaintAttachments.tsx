import { Paperclip, ExternalLink } from "lucide-react";

interface ComplaintAttachmentsProps {
  adminResponse: string | null;
}

export default function ComplaintAttachments({ adminResponse }: ComplaintAttachmentsProps) {
  if (!adminResponse) return null;

  // Try to parse the admin_response as JSON to extract photos
  try {
    const parsed = JSON.parse(adminResponse);
    
    if (parsed.photos && Array.isArray(parsed.photos) && parsed.photos.length > 0) {
      return (
        <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Attachments ({parsed.photos.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {parsed.photos.map((photoUrl: string, index: number) => (
              <a
                key={index}
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Attachment {index + 1}
              </a>
            ))}
          </div>
        </div>
      );
    }
  } catch {
    // Not JSON, treat as regular admin response text
  }

  // If it's not a photos JSON, render as regular admin response
  return (
    <div className="bg-muted/50 p-3 rounded mt-2 border">
      <p className="text-sm"><strong>Admin Response:</strong> {adminResponse}</p>
    </div>
  );
}
