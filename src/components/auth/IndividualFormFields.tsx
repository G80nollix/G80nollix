
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, CalendarIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_CALLING_CODES } from "@/constants";
import { countryCodeToFlagEmoji } from "@/lib/utils";

interface IndividualFormFieldsProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  identityFile?: File | null;
  setIdentityFile?: (f: File | null) => void;
  taxCodeFile?: File | null;
  setTaxCodeFile?: (f: File | null) => void;
  loading: boolean;
}

const IndividualFormFields = ({
  formData,
  setFormData,
  loading,
}: IndividualFormFieldsProps) => {
  const [phonePrefix, setPhonePrefix] = useState<string>(() => {
    const match = (formData.phone as string | undefined)?.match(/^\+\d+/);
    return match ? match[0] : "+39";
  });
  const [phoneLocal, setPhoneLocal] = useState<string>(() => {
    const original = (formData.phone as string | undefined) ?? "";
    return original.replace(/^\+\d+\s*/, "");
  });

  useEffect(() => {
    const combined = phoneLocal ? `${phonePrefix} ${phoneLocal}` : phonePrefix;
    setFormData((prev: any) => ({ ...prev, phone: combined }));
  }, [phonePrefix, phoneLocal, setFormData]);

  const getMaxDigitsForPrefix = (prefix: string): number => {
    const found = COUNTRY_CALLING_CODES.find((c) => c.code === prefix);
    return found?.maxDigits ?? 15;
  };

  const countDigits = (s: string): number => (s.match(/\d/g) || []).length;

  const handlePhoneLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digitsOnlyCount = countDigits(value);
    const maxDigits = getMaxDigitsForPrefix(phonePrefix);
    // Allow only numbers, spaces, -, (, ) characters (no + in local part)
    const sanitized = value.replace(/[^0-9\s\-()]/g, '');
    
    // Per l'Italia (+39), limita esattamente a 10 cifre
    if (phonePrefix === "+39") {
      if (digitsOnlyCount > 10) {
        // Preveni l'aggiunta di più di 10 cifre
        const digits = (sanitized.match(/\d/g) || []).join("").slice(0, 10);
        setPhoneLocal(digits);
        return;
      }
    } else if (digitsOnlyCount > maxDigits) {
      // Per altri paesi, usa il limite maxDigits
      const digits = (sanitized.match(/\d/g) || []).join("").slice(0, maxDigits);
      setPhoneLocal(digits);
      return;
    }
    setPhoneLocal(sanitized);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const value = e.target.value;
    // Allow only letters, spaces, apostrophes, and hyphens
    const nameValue = value.replace(/[^a-zA-ZÀ-ÿ\s'\-]/g, '');
    setFormData((prev: any) => ({ ...prev, [field]: nameValue }));
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName" className="text-base font-semibold mb-2 block" style={{ fontFamily: 'Oswald, sans-serif', color: '#5F5F5F' }}>
            Nome *
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#5F5F5F' }} />
            <Input
              id="firstName"
              type="text"
              placeholder="Marco"
              value={formData.firstName}
              onChange={(e) => handleNameChange(e, 'firstName')}
              className="pl-12 py-3 border-2"
              style={{ 
                borderColor: '#5F5F5F',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '16px'
              }}
              required
              disabled={loading}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="lastName" className="text-base font-semibold mb-2 block" style={{ fontFamily: 'Oswald, sans-serif', color: '#5F5F5F' }}>
            Cognome *
          </Label>
          <Input
            id="lastName"
            type="text"
            placeholder="Rossi"
            value={formData.lastName}
            onChange={(e) => handleNameChange(e, 'lastName')}
            className="py-3 border-2"
            style={{ 
              borderColor: '#5F5F5F',
              fontFamily: 'Oswald, sans-serif',
              fontSize: '16px'
            }}
            required
            disabled={loading}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="birthDate" className="text-base font-semibold mb-2 block" style={{ fontFamily: 'Oswald, sans-serif', color: '#5F5F5F' }}>
          Data di nascita *
        </Label>
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#5F5F5F' }} />
          <Input
            id="birthDate"
            type="date"
            value={formData.birthDate}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, birthDate: e.target.value }))}
            className="pl-12 py-3 border-2"
            style={{ 
              borderColor: '#5F5F5F',
              fontFamily: 'Oswald, sans-serif',
              fontSize: '16px'
            }}
            max={(() => {
              const today = new Date();
              const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
              return maxDate.toISOString().split('T')[0];
            })()}
            required
            disabled={loading}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="phone" className="text-base font-semibold mb-2 block" style={{ fontFamily: 'Oswald, sans-serif', color: '#5F5F5F' }}>
          Telefono *
        </Label>
        <div className="flex gap-2">
          <Select value={phonePrefix} onValueChange={setPhonePrefix} disabled={loading} required>
            <SelectTrigger className="w-28 border-2" aria-label="Prefisso telefonico" style={{ borderColor: '#5F5F5F', fontFamily: 'Oswald, sans-serif' }}>
              <SelectValue placeholder="Prefisso" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_CALLING_CODES.map(opt => (
                <SelectItem key={opt.code} value={opt.code} style={{ fontFamily: 'Oswald, sans-serif' }}>
                  {`${countryCodeToFlagEmoji(opt.iso2)} ${opt.code}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="phone"
            type="tel"
            placeholder="123 456 7890"
            value={phoneLocal}
            onChange={handlePhoneLocalChange}
            inputMode="numeric"
            className="py-3 border-2"
            style={{ 
              borderColor: '#5F5F5F',
              fontFamily: 'Oswald, sans-serif',
              fontSize: '16px'
            }}
            required
            disabled={loading}
          />
        </div>
      </div>
    </>
  );
};

export default IndividualFormFields;
