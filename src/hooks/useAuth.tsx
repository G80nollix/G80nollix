import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserService } from '@/services/api';
import type { UserMetadata } from '@/types';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/constants';

interface AuthContextType {
  user: User | null;
  profile: UserMetadata | null;
  session: Session | null;
  loading: boolean;
  signUp: (data: any) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserMetadata | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[DEBUG] Error getting session:', error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setProfile(session?.user?.user_metadata as UserMetadata ?? null);
      setLoading(false);
      console.log('[DEBUG] Initial session', { 
        session, 
        user: session?.user, 
        profile: session?.user?.user_metadata
      });
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[DEBUG] Auth state changed:', event, session?.user?.email);
      console.log('[DEBUG] Full user object:', session?.user);
      console.log('[DEBUG] User metadata:', session?.user?.user_metadata);
      
      setSession(session);
      setUser(session?.user ?? null);
      setProfile(session?.user?.user_metadata as UserMetadata ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (data: any) => {
    try {
      const result = await UserService.signUp(data);
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Invia direttamente l'email di benvenuto usando send-email
      try {
        console.log('[DEBUG] Sending welcome email using send-email...');
        
        // Recupera le impostazioni del negozio per personalizzare l'email
        const { data: shopSettings } = await supabase
          .from('shop_settings')
          .select('nome_negozio, shopIcon_url')
          .maybeSingle();
        
        const shopName = shopSettings?.nome_negozio || 'Nollix';
        const shopIconUrl = shopSettings?.shopIcon_url || 'https://demo.nollix.it/Nollix_favicon.png';
        
        // Crea l'HTML per l'email di benvenuto
        const displayName = `${data.firstName} ${data.lastName}`.trim() || data.firstName;
        const welcomeEmailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Benvenuto su ${shopName}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
                .logo { width: 180px; height: 180px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
                .logo img { display: block; margin: auto; max-width: 100%; max-height: 100%; }
                .logo-text { color: white; font-size: 24px; font-weight: bold; }
                .header-title { color: #333; font-size: 28px; font-weight: bold; margin: 0; }
                .header-subtitle { color: #666; font-size: 16px; margin: 10px 0 0 0; }
                .content { padding: 40px 20px; }
                .welcome-text { font-size: 18px; color: #333; margin-bottom: 30px; }
                .credentials-box { background-color: #f8f9fa; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0; border-radius: 4px; }
                .credentials-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; }
                .credential-item { margin-bottom: 10px; }
                .credential-label { font-weight: 600; color: #666; }
                .credential-value { font-family: 'Courier New', monospace; background-color: #e9ecef; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; }
                .warning-box { background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 15px; margin: 20px 0; }
                .warning-text { color: #856404; font-size: 14px; margin: 0; }
                .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; }
                .footer-text { color: #666; font-size: 14px; margin: 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">
                    <img src="${shopIconUrl}" alt="${shopName} Logo" style="width: 150px; height: 150px; object-fit: contain;">
                  </div>
                  <h1 class="header-title">Benvenuto su ${shopName}!</h1>
                  <p class="header-subtitle">Il tuo account è stato creato con successo</p>
                </div>
                
                <div class="content">
                  <p class="welcome-text">
                    Ciao <strong>${displayName}</strong>,
                  </p>
                  
                  <p>Siamo felici di darti il benvenuto su ${shopName}!</p>
                  
                  <p>Ecco cosa puoi fare subito:
                  <ul>
                  <li>✨ Esplora il catalogo delle nostre attrezzature sportive</li>
                  <li>🔍 Prenota le nostre attrezzature per le tue attività</li>
                  <li>📱 Gestisci le tue prenotazioni e informazioni del tuo profilo</li>
                  </ul>
                  </p>
                  
                  <p>Saremo al tuo fianco per farti vivere al meglio le tue vacanze sulla neve. </p>
                  
                  <p>Grazie per aver scelto ${shopName}, non vediamo l'ora di vederci nel nostro negozio!</p>
                  
                  <p>
                  A presto,<br>
                  Il Team di ${shopName}</p>
                </div>
                
                <div class="footer">
                  <p class="footer-text">
                    Questo è un messaggio automatico, per favore non rispondere a questa email.
                  </p>
                </div>
              </div>
            </body>
          </html>
        `;

        const { error: emailError } = await supabase.functions.invoke('send-email', {
          method: 'POST',
          body: {
            to: data.email,
            subject: `Benvenuto su ${shopName} - Registrazione Completata`,
            html: welcomeEmailHtml
          }
        });
        
        if (emailError) {
          console.error('[DEBUG] Error sending welcome email:', emailError);
          // Non blocchiamo la registrazione se l'email fallisce
        } else {
          console.log('[DEBUG] Welcome email sent successfully');
        }
      } catch (emailError) {
        console.error('[DEBUG] Error calling send-email function:', emailError);
        // Non blocchiamo la registrazione se l'email fallisce
      }

      toast({
        title: "Registrazione completata!",
        description: SUCCESS_MESSAGES.AUTH.SIGNUP,
      });
    } catch (error: any) {
      let errorMessage = ERROR_MESSAGES.GENERIC;
      if (error.message?.includes('already registered')) {
        errorMessage = ERROR_MESSAGES.AUTH.EMAIL_EXISTS;
      } else if (error.message?.includes('Password should be')) {
        errorMessage = ERROR_MESSAGES.AUTH.WEAK_PASSWORD;
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Errore nella registrazione",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await UserService.signIn(email, password);
      
      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Accesso effettuato!",
        description: SUCCESS_MESSAGES.AUTH.SIGNIN,
      });
    } catch (error: any) {
      console.error('Signin error:', error);
      let errorMessage = ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS;
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS;
      }
      
      toast({
        title: "Errore nell'accesso",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Check if user is admin before logout
      const isCurrentlyAdmin = user ? await checkIfUserIsAdmin(user.id) : false;
      
      // Clear local state first
      setUser(null);
      setSession(null);
      setProfile(null);
      
      // Force logout from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase signOut error:', error);
        // Continue with logout even if there's an error
      }

      // Clear any remaining tokens from localStorage/sessionStorage
      try {
        // Clear all Supabase related keys
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (storageError) {
        console.error('Error clearing storage:', storageError);
        // Continue with logout even if storage clearing fails
      }

      toast({
        title: "Logout effettuato",
        description: SUCCESS_MESSAGES.AUTH.SIGNOUT,
      });

      // Redirect admin users to special logout page, then to home
      if (isCurrentlyAdmin) {
        window.location.href = '/admin/logout';
      } else {
        // Redirect regular users directly to home page
        window.location.href = '/';
      }
    } catch (error: any) {
      console.error('Signout error:', error);
      
      // Clear local state even on error to ensure logout
      setUser(null);
      setSession(null);
      setProfile(null);
      
      // Force clear storage even on error
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (storageError) {
        console.error('Error clearing storage on error:', storageError);
      }
      
      toast({
        title: "Logout effettuato",
        description: "Sessione terminata con successo.",
      });
      // Even on error, redirect to home to ensure user is logged out
      window.location.href = '/';
    }
  };

  const checkIfUserIsAdmin = async (userId: string): Promise<boolean> => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', userId)
        .maybeSingle();

      return profile?.user_type === 'admin' || false;
    } catch (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
