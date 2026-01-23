
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";

const ResetPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const checkResetToken = async () => {
      setIsChecking(true);
      
      console.log('ResetPasswordPage mounted');
      console.log('Current URL:', window.location.href);
      console.log('Pathname:', window.location.pathname);
      console.log('Search:', window.location.search);
      console.log('Hash:', window.location.hash);
      console.log('Full URL breakdown:', {
        href: window.location.href,
        origin: window.location.origin,
        protocol: window.location.protocol,
        host: window.location.host,
        hostname: window.location.hostname,
        port: window.location.port,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash
      });
      
      try {
        // Check for Supabase auth parameters in URL
        // Supabase can send parameters in different ways depending on the configuration
        
        // Method 1: Check hash fragment (common for SPAs)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        // Method 2: Check query parameters (alternative method)
        const queryAccessToken = searchParams.get('access_token');
        const queryRefreshToken = searchParams.get('refresh_token');
        const queryType = searchParams.get('type');
        
        // Method 3: Check for other possible parameters
        const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash');
        const errorParam = searchParams.get('error') || hashParams.get('error');
        const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');
        
        // Use whichever method has the tokens
        const finalAccessToken = accessToken || queryAccessToken;
        const finalRefreshToken = refreshToken || queryRefreshToken;
        const finalType = type || queryType;

        console.log('Reset password parameters:', { 
          hasAccessToken: !!finalAccessToken, 
          hasRefreshToken: !!finalRefreshToken, 
          type: finalType,
          tokenHash: !!tokenHash,
          error: errorParam,
          errorDescription,
          hashParams: Object.fromEntries(hashParams.entries()),
          queryParams: Object.fromEntries(searchParams.entries())
        });

        // Check for error parameters first
        if (errorParam) {
          console.error('Error in reset link:', errorParam, errorDescription);
          throw new Error(`Reset link error: ${errorParam} - ${errorDescription}`);
        }

        if (finalAccessToken && finalRefreshToken && finalType === 'recovery') {
          // Set the session with the tokens from the reset link
          const { data, error } = await supabase.auth.setSession({
            access_token: finalAccessToken,
            refresh_token: finalRefreshToken
          });

          if (error) {
            console.error('Error setting session:', error);
            throw error;
          }

          console.log('Session set successfully for password reset');
          setIsValidSession(true);
          
          // Clean up the URL by removing the tokens
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } else if (tokenHash && finalType === 'recovery') {
          // Handle token_hash method (PKCE flow)
          console.log('Handling token_hash flow');
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery'
          });

          if (error) {
            console.error('Error verifying OTP:', error);
            throw error;
          }

          console.log('OTP verified successfully');
          setIsValidSession(true);
          
          // Clean up the URL
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } else {
          // Check if there's already a valid session (user might have clicked the link multiple times)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('Valid session already exists');
            setIsValidSession(true);
          } else {
            console.log('No valid tokens or session found');
            console.log('This might be a direct access to the reset page without proper tokens');
            console.log('Full URL for debugging:', window.location.href);
            console.log('All URL parameters:', {
              search: window.location.search,
              hash: window.location.hash,
              pathname: window.location.pathname
            });
            
            // Instead of throwing an error immediately, let's show a more helpful message
            toast({
              title: "Link di reset non valido",
              description: "Se hai ricevuto un link di reset via email, assicurati di cliccare direttamente sul link nell'email. Se il problema persiste, richiedi un nuovo link.",
              variant: "destructive",
            });
            navigate("/auth?mode=login");
            return;
          }
        }
      } catch (error: any) {
        console.error('Error in password reset flow:', error);
        toast({
          title: "Link non valido o scaduto",
          description: "Il link per il reset della password è scaduto o non valido. Richiedi un nuovo link.",
          variant: "destructive",
        });
        navigate("/auth?mode=login");
      } finally {
        setIsChecking(false);
      }
    };

    checkResetToken();
  }, [navigate, toast, searchParams]);

  const handleResetPassword = async (password: string, confirmPassword: string) => {
    if (password !== confirmPassword) {
      toast({
        title: "Le password non combaciano",
        description: "Assicurati che le due password inserite siano identiche.",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password troppo corta",
        description: "La password deve essere di almeno 6 caratteri.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setPasswordUpdated(true);
      toast({
        title: "Password aggiornata con successo!",
        description: "La tua password è stata cambiata. Ora puoi accedere con la nuova password.",
      });

      // Redirect to login page after 3 seconds
      setTimeout(() => {
        navigate("/auth?mode=login");
      }, 3000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Errore nell'aggiornamento della password",
        description: error.message || "Si è verificato un errore. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifica del link in corso...</p>
          <p className="text-sm text-gray-500 mt-2">URL: {window.location.href}</p>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Link non valido</h2>
          <p className="text-gray-600 mb-4">Il link per il reset della password è scaduto o non valido.</p>
          <button
            onClick={() => navigate("/auth?mode=login")}
            className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-2 rounded-lg hover:from-green-700 hover:to-blue-700 transition-colors"
          >
            Torna al login
          </button>
        </div>
      </div>
    );
  }

  if (passwordUpdated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <FixedNavbar />
        
        <div className="container mx-auto px-4 py-16 pt-20 md:pt-24">
          <div className="max-w-md mx-auto">
            <Card className="shadow-xl border-0">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Password Aggiornata!</h1>
                <p className="text-gray-600 mb-6">
                  La tua password è stata cambiata con successo. 
                  Ora puoi accedere al tuo account con la nuova password.
                </p>
                
                <div className="animate-pulse">
                  <p className="text-sm text-gray-500">
                    Reindirizzamento automatico al login in corso...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <FixedNavbar />

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <Card className="shadow-xl border-0">
            <CardContent className="p-8">
              <ResetPasswordForm 
                onSubmit={handleResetPassword}
                loading={loading}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ResetPasswordPage;
