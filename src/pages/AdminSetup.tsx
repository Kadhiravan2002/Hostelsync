import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function AdminSetup() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const setupAdmin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('bootstrap-admin', {
        body: {
          email: 'kadhiravan2026@gmail.com',
          password: 'marveldc'
        }
      });

      if (error) {
        throw error;
      }

      console.log('Bootstrap result:', data);
      setSuccess(true);
      toast({
        title: "Admin Setup Complete!",
        description: "Admin account created successfully. You can now log in.",
      });

    } catch (e: any) {
      console.error('Setup error:', e);
      const errorMessage = e.message || 'Failed to setup admin';
      setError(errorMessage);
      toast({
        title: "Setup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Admin Setup</CardTitle>
          <CardDescription>
            One-time setup to create the admin account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!success && !error && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Email:</strong> kadhiravan2026@gmail.com</p>
                <p><strong>Password:</strong> marveldc</p>
              </div>
              
              <Button 
                onClick={setupAdmin} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up admin...
                  </>
                ) : (
                  'Setup Admin Account'
                )}
              </Button>
            </div>
          )}

          {success && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div className="space-y-2">
                <h3 className="font-semibold text-green-700">Setup Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  Admin account has been created successfully.
                </p>
                <Button 
                  onClick={() => window.location.href = '/auth'}
                  className="w-full"
                >
                  Go to Login
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div className="space-y-2">
                <h3 className="font-semibold text-red-700">Setup Failed</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button 
                  onClick={() => {
                    setError(null);
                    setSuccess(false);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}