
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface AuthHeaderProps {
  isLogin: boolean;
  isForgotPassword: boolean;
}

const AuthHeader = ({ isLogin, isForgotPassword }: AuthHeaderProps) => {
  // Don't show the header for reset password page since it has its own styling
  if (isForgotPassword && window.location.pathname === '/reset-password') {
    return null;
  }

  return (
    <CardHeader className="text-center">
      <div className="mx-auto mb-6">
        <img 
          src="/Asti/logo_g80.png" 
          alt="G80 Sport" 
          className="h-20 w-auto mx-auto"
        />
      </div>
      <CardTitle className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700', color: '#5F5F5F' }}>
        {isForgotPassword
          ? "REIMPOSTA PASSWORD"
          : isLogin
          ? "ACCEDI"
          : "REGISTRATI"}
      </CardTitle>
      <CardDescription className="text-base md:text-lg" style={{ fontFamily: 'Oswald, sans-serif', color: '#374151' }}>
        {isForgotPassword
          ? "Inserisci la tua email per ricevere il link di reset"
          : isLogin
          ? "Accedi al tuo account per continuare"
          : "Registrati per prenotare la tua attrezzatura"}
      </CardDescription>
    </CardHeader>
  );
};

export default AuthHeader;
