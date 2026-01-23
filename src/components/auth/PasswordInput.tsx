
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  label?: string;
  placeholder?: string;
  id?: string;
}

const PasswordInput = ({ 
  value, 
  onChange, 
  loading, 
  label = "Password",
  placeholder = "••••••••",
  id = "password"
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  
  return (
    <div>
      <Label htmlFor={id} className="text-base font-semibold mb-2 block" style={{ fontFamily: 'Oswald, sans-serif', color: '#5F5F5F' }}>
        {label} *
      </Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#5F5F5F' }} />
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="pl-12 pr-12 py-3 border-2"
          style={{ 
            borderColor: '#5F5F5F',
            fontFamily: 'Oswald, sans-serif',
            fontSize: '16px'
          }}
          required
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center"
          style={{ color: '#5F5F5F' }}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </div>
  );
};

export default PasswordInput;
