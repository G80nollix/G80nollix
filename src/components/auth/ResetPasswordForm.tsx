
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import PasswordInput from "@/components/auth/PasswordInput";

interface ResetPasswordFormProps {
  onSubmit: (password: string, confirmPassword: string) => void;
  loading: boolean;
}

const ResetPasswordForm = ({ onSubmit, loading }: ResetPasswordFormProps) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password, confirmPassword);
  };

  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = confirmPassword.length >= 6;
  const doPasswordsMatch = password === confirmPassword;
  const isFormValid = isPasswordValid && isConfirmPasswordValid && doPasswordsMatch;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border-4" style={{ borderColor: '#5F5F5F' }}>
          <KeyRound className="h-10 w-10" style={{ color: '#5F5F5F' }} />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700', color: '#5F5F5F' }}>
          REIMPOSTA PASSWORD
        </h1>
        <p className="text-base md:text-lg" style={{ fontFamily: 'Oswald, sans-serif', color: '#374151' }}>
          Inserisci la tua nuova password per completare il reset
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="newPassword" className="text-base font-semibold block" style={{ fontFamily: 'Oswald, sans-serif', color: '#5F5F5F' }}>
            Nuova Password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-3 border-2 rounded-md focus:outline-none"
              style={{ 
                borderColor: '#5F5F5F',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '16px'
              }}
              disabled={loading}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
              style={{ color: '#5F5F5F' }}
              disabled={loading}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {password && !isPasswordValid && (
            <p className="text-sm text-red-600" style={{ fontFamily: 'Oswald, sans-serif' }}>La password deve essere di almeno 6 caratteri</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmNewPassword" className="text-base font-semibold block" style={{ fontFamily: 'Oswald, sans-serif', color: '#5F5F5F' }}>
            Conferma Nuova Password
          </label>
          <div className="relative">
            <input
              id="confirmNewPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-3 border-2 rounded-md focus:outline-none"
              style={{ 
                borderColor: '#5F5F5F',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '16px'
              }}
              disabled={loading}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
              style={{ color: '#5F5F5F' }}
              disabled={loading}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {confirmPassword && !isConfirmPasswordValid && (
            <p className="text-sm text-red-600" style={{ fontFamily: 'Oswald, sans-serif' }}>La password deve essere di almeno 6 caratteri</p>
          )}
        </div>

        {password && confirmPassword && !doPasswordsMatch && (
          <div className="p-3 bg-red-50 border-2 rounded-md" style={{ borderColor: '#DC2626' }}>
            <p className="text-sm text-red-600" style={{ fontFamily: 'Oswald, sans-serif' }}>Le password non combaciano</p>
          </div>
        )}

        {isFormValid && (
          <div className="p-3 bg-green-50 border-2 rounded-md" style={{ borderColor: '#059669' }}>
            <p className="text-sm text-green-600" style={{ fontFamily: 'Oswald, sans-serif' }}>✓ Le password sono valide e combaciano</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full font-bold text-lg py-6 border-4 uppercase transition-all duration-300 hover:scale-105 active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            borderColor: '#5F5F5F', 
            color: '#5F5F5F', 
            backgroundColor: 'white',
            fontFamily: 'Oswald, sans-serif',
            fontWeight: '700'
          }}
          disabled={loading || !isFormValid}
        >
          {loading ? "Aggiornamento..." : "Aggiorna Password"}
        </Button>
      </form>
    </div>
  );
};

export default ResetPasswordForm;
