
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateEmail } from "@/lib/authSchema";
import { useQuery } from "@tanstack/react-query";

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

const ForgotPasswordForm = ({ onBackToLogin }: ForgotPasswordFormProps) => {
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const { toast } = useToast();

  // Get base_url from shop_settings
  const { data: shopSettings } = useQuery({
    queryKey: ['shop_settings', 'base_url'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('base_url')
        .maybeSingle();
      
      if (error) {
        console.error('Error loading shop settings:', error);
        return null;
      }
      
      return data;
    },
  });

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setResetEmail(value);
    
    if (emailTouched) {
      const validation = validateEmail(value);
      setEmailError(validation.isValid ? null : (validation.error || null));
    }
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    if (resetEmail) {
      const validation = validateEmail(resetEmail);
      setEmailError(validation.isValid ? null : (validation.error || null));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Validazione email
    const emailValidation = validateEmail(resetEmail);
    if (!emailValidation.isValid) {
      toast({
        title: "Email non valida",
        description: emailValidation.error || "L'email deve contenere @ e un punto (.)",
        variant: "destructive"
      });
      setEmailError(emailValidation.error || null);
      setEmailTouched(true);
      return;
    }

    setLoading(true);

    try {
      console.log('Sending password reset email for:', resetEmail);
      
      // Prepara l'URL di redirect usando base_url da shop_settings
      let redirectUrl;
      const baseUrl = shopSettings?.base_url;
      
      if (baseUrl) {
        // Remove trailing slash if present
        const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
        redirectUrl = `${normalizedBaseUrl}/reset-password`;
      } else {
        // Fallback: use current URL if base_url is not available
        redirectUrl = `${window.location.protocol}//${window.location.host}/reset-password`;
      }
      
      console.log('Sending password reset email with redirect URL:', redirectUrl);
      
      // Chiama direttamente resetPasswordForEmail
      // Supabase controllerà internamente se l'email esiste in auth.users
      // Per sicurezza, Supabase non rivela se un'email esiste o meno
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: redirectUrl
      });

      if (error) {
        console.error('Supabase reset password error:', error);
        throw error;
      }

      console.log('Password reset email sent successfully');
      
      setEmailSent(true);
      toast({
        title: "Richiesta inviata con successo!",
        description: "Se l'email corrisponde a un account registrato, riceverai un link di reset della password. Il link scade tra 1 ora.",
      });

      setResetEmail("");
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Errore nell'invio dell'email",
        description: error.message || "Si è verificato un errore. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4" style={{ borderColor: '#5F5F5F' }}>
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700', color: '#5F5F5F' }}>
            EMAIL INVIATA!
          </h2>
          <p className="text-base mb-4" style={{ fontFamily: 'Oswald, sans-serif', color: '#374151' }}>
            Se l'email inserita corrisponde a un account registrato nel sistema, 
            riceverai un link di reset della password. Controlla la tua casella di posta 
            e clicca sul link per reimpostare la password.
          </p>
          <p className="text-sm mb-6" style={{ fontFamily: 'Oswald, sans-serif', color: '#6B7280' }}>
            Il link scade tra 1 ora. Se non ricevi l'email, controlla anche la cartella spam.
          </p>
        </div>
        
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full font-bold text-lg py-6 border-4 uppercase transition-all duration-300 hover:scale-105"
            style={{ 
              borderColor: '#5F5F5F', 
              color: '#5F5F5F', 
              backgroundColor: 'white',
              fontFamily: 'Oswald, sans-serif',
              fontWeight: '700'
            }}
            onClick={() => {
              setEmailSent(false);
              setResetEmail("");
            }}
          >
            Invia un'altra email
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            className="w-full font-semibold"
            style={{ fontFamily: 'Oswald, sans-serif', color: '#2563EB' }}
            onClick={onBackToLogin}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna al login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleResetPassword} className="space-y-5">
      <div>
        <Label htmlFor="reset-email" className="text-base font-semibold mb-2 block" style={{ fontFamily: 'Oswald, sans-serif', color: '#5F5F5F' }}>
          Email
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#5F5F5F' }} />
          <Input
            id="reset-email"
            type="email"
            placeholder="marco@example.com"
            value={resetEmail}
            onChange={handleEmailChange}
            onBlur={handleEmailBlur}
            className={`pl-12 py-3 border-2 ${emailError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            style={{ 
              borderColor: emailError ? '#DC2626' : '#5F5F5F',
              fontFamily: 'Oswald, sans-serif',
              fontSize: '16px'
            }}
            required
            disabled={loading}
          />
        </div>
        {emailError && (
          <p className="text-sm text-red-600 mt-1" style={{ fontFamily: 'Oswald, sans-serif' }}>{emailError}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full font-bold text-lg py-6 border-4 uppercase transition-all duration-300 hover:scale-105 active:scale-100"
        style={{ 
          borderColor: '#5F5F5F', 
          color: '#5F5F5F', 
          backgroundColor: 'white',
          fontFamily: 'Oswald, sans-serif',
          fontWeight: '700'
        }}
        disabled={loading}
      >
        {loading ? "Invio in corso..." : "Invia email di reset"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full font-semibold"
        style={{ fontFamily: 'Oswald, sans-serif', color: '#2563EB' }}
        onClick={onBackToLogin}
        disabled={loading}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Torna al login
      </Button>
    </form>
  );
};

export default ForgotPasswordForm;
