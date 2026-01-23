
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail } from "lucide-react";
import IndividualFormFields from "@/components/auth/IndividualFormFields";
import PasswordInput from "@/components/auth/PasswordInput";
import { validateEmail } from "@/lib/authSchema";

interface AuthFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  birthDate: string;
  address: string;
  city: string;
  postalCode: string;
  province: string;
  taxCode: string;
  acceptTerms: boolean;
}

interface AuthFormProps {
  isLogin: boolean;
  formData: AuthFormData;
  setFormData: React.Dispatch<React.SetStateAction<AuthFormData>>;
  identityFile: File | null;
  setIdentityFile: React.Dispatch<React.SetStateAction<File | null>>;
  taxCodeFile: File | null;
  setTaxCodeFile: React.Dispatch<React.SetStateAction<File | null>>;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onToggleMode: () => void;
  onForgotPassword: () => void;
}

const AuthForm = ({
  isLogin,
  formData,
  setFormData,
  identityFile,
  setIdentityFile,
  taxCodeFile,
  setTaxCodeFile,
  loading,
  onSubmit,
  onToggleMode,
  onForgotPassword,
}: AuthFormProps) => {
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, email: value }));
    
    if (emailTouched) {
      const validation = validateEmail(value);
      setEmailError(validation.isValid ? null : (validation.error || null));
    }
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    if (formData.email) {
      const validation = validateEmail(formData.email);
      setEmailError(validation.isValid ? null : (validation.error || null));
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {!isLogin && (
        <IndividualFormFields
          formData={formData}
          setFormData={setFormData}
          identityFile={identityFile}
          setIdentityFile={setIdentityFile}
          taxCodeFile={taxCodeFile}
          setTaxCodeFile={setTaxCodeFile}
          loading={loading}
        />
      )}

      <div>
        <Label htmlFor="email" className="text-base font-semibold mb-2 block" style={{ fontFamily: 'Oswald, sans-serif', color: '#5F5F5F' }}>
          Email *
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#5F5F5F' }} />
          <Input
            id="email"
            type="email"
            placeholder="marco@example.com"
            value={formData.email}
            onChange={handleEmailChange}
            onBlur={handleEmailBlur}
            className={`pl-12 py-3 border-2 ${emailError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            style={{ 
              borderColor: emailError ? '#DC2626' : '#5F5F5F',
              fontFamily: 'Oswald, sans-serif',
              fontSize: '16px'
            }}
            required
          />
        </div>
        {emailError && (
          <p className="text-sm text-red-600 mt-1" style={{ fontFamily: 'Oswald, sans-serif' }}>{emailError}</p>
        )}
      </div>

      <PasswordInput
        value={formData.password}
        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
        loading={loading}
      />

      {!isLogin && (
        <PasswordInput
          value={formData.confirmPassword}
          onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
          loading={loading}
          label="Conferma Password"
          placeholder="••••••••"
          id="confirmPassword"
        />
      )}

      {!isLogin && formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
        <p className="text-sm text-red-600" style={{ fontFamily: 'Oswald, sans-serif' }}>Le password non combaciano</p>
      )}

      {!isLogin && (
        <div className="flex items-start space-x-3 pt-2">
          <Checkbox
            id="terms"
            checked={formData.acceptTerms}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, acceptTerms: checked as boolean }))}
            required={!isLogin}
            className="mt-1 border-2"
            style={{ borderColor: '#5F5F5F' }}
          />
          <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer" style={{ fontFamily: 'Oswald, sans-serif', color: '#374151' }}>
            Accetto i{" "}
            <a href="#" className="text-[#2563EB] hover:underline font-semibold">termini di servizio</a> e la{" "}
            <a href="#" className="text-[#2563EB] hover:underline font-semibold">privacy policy</a> *
          </Label>
        </div>
      )}

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
        {loading ? "Caricamento..." : (isLogin ? "Accedi" : "Registrati")}
      </Button>

      {isLogin && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm font-semibold hover:underline transition-colors"
            style={{ fontFamily: 'Oswald, sans-serif', color: '#2563EB' }}
            disabled={loading}
          >
            Hai dimenticato la password?
          </button>
        </div>
      )}

      <div className="text-center pt-4 border-t-2" style={{ borderColor: '#5F5F5F' }}>
        <span className="text-base" style={{ fontFamily: 'Oswald, sans-serif', color: '#374151' }}>
          {isLogin ? "Non hai un account?" : "Hai già un account?"}{" "}
          <button
            type="button"
            onClick={onToggleMode}
            className="font-bold hover:underline transition-colors"
            style={{ fontFamily: 'Oswald, sans-serif', color: '#059669' }}
            disabled={loading}
          >
            {isLogin ? "Registrati" : "Accedi"}
          </button>
        </span>
      </div>
    </form>
  );
};

export default AuthForm;
