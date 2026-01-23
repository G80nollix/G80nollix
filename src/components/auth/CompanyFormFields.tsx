
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";
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

interface CompanyFormFieldsProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  loading: boolean;
}

const CompanyFormFields = ({
  formData,
  setFormData,
  loading
}: CompanyFormFieldsProps) => (
  <>
    <div>
      <Label htmlFor="companyName">Ragione sociale</Label>
      <div className="relative">
        <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          id="companyName"
          type="text"
          placeholder="Nome Azienda SRL"
          value={formData.companyName}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, companyName: e.target.value }))}
          className="pl-10"
          required
          disabled={loading}
        />
      </div>
    </div>
    <div>
      <Label htmlFor="vatNumber">Partita IVA</Label>
      <Input
        id="vatNumber"
        type="text"
        placeholder="IT01234567890"
        value={formData.vatNumber}
        onChange={(e) => setFormData((prev: any) => ({ ...prev, vatNumber: e.target.value }))}
        required
        disabled={loading}
      />
    </div>
    <div>
      <Label htmlFor="companyAddress">Sede legale</Label>
      <Input
        id="companyAddress"
        type="text"
        placeholder="Via Azienda 1"
        value={formData.companyAddress}
        onChange={(e) => setFormData((prev: any) => ({ ...prev, companyAddress: e.target.value }))}
        required
        disabled={loading}
      />
    </div>
    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label htmlFor="companyCity">Città</Label>
        <Input
          id="companyCity"
          type="text"
          placeholder="Roma"
          value={formData.companyCity}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, companyCity: e.target.value }))}
          required
          disabled={loading}
        />
      </div>
      <div>
        <Label htmlFor="companyPostalCode">CAP</Label>
        <Input
          id="companyPostalCode"
          type="text"
          placeholder="00100"
          value={formData.companyPostalCode}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, companyPostalCode: e.target.value }))}
          required
          disabled={loading}
        />
      </div>
      <div>
        <Label htmlFor="companyProvince">Provincia</Label>
        <Input
          id="companyProvince"
          type="text"
          placeholder="RM"
          value={formData.companyProvince}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, companyProvince: e.target.value }))}
          required
          disabled={loading}
        />
      </div>
    </div>
    <div>
      <Label htmlFor="legalRepresentative">Legale rappresentante</Label>
      <Input
        id="legalRepresentative"
        type="text"
        placeholder="Mario Rossi"
        value={formData.legalRepresentative}
        onChange={(e) => setFormData((prev: any) => ({ ...prev, legalRepresentative: e.target.value }))}
        required
        disabled={loading}
      />
    </div>
    <div>
      <Label htmlFor="businessSector">Settore</Label>
      <Input
        id="businessSector"
        type="text"
        placeholder="Noleggio bici"
        value={formData.businessSector}
        onChange={(e) => setFormData((prev: any) => ({ ...prev, businessSector: e.target.value }))}
        required
        disabled={loading}
      />
    </div>
    <div>
      <Label htmlFor="companyDescription">Descrizione azienda</Label>
      <Input
        id="companyDescription"
        type="text"
        placeholder="Breve descrizione della tua attività"
        value={formData.companyDescription}
        onChange={(e) => setFormData((prev: any) => ({ ...prev, companyDescription: e.target.value }))}
        required
        disabled={loading}
      />
    </div>
    <div>
      <Label htmlFor="website">Sito Web</Label>
      <Input
        id="website"
        type="text"
        placeholder="https://azienda.it"
        value={formData.website}
        onChange={(e) => setFormData((prev: any) => ({ ...prev, website: e.target.value }))}
        disabled={loading}
      />
    </div>
    <div>
      <Label htmlFor="registrationNumber">Numero iscrizione REA o registro</Label>
      <Input
        id="registrationNumber"
        type="text"
        placeholder="RM-123456"
        value={formData.registrationNumber}
        onChange={(e) => setFormData((prev: any) => ({ ...prev, registrationNumber: e.target.value }))}
        required
        disabled={loading}
      />
    </div>
    <PhoneField
      value={formData.phone}
      onChange={(v: string) => setFormData((prev: any) => ({ ...prev, phone: v }))}
      disabled={loading}
    />
  </>
);

export default CompanyFormFields;

interface PhoneFieldProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const PhoneField: React.FC<PhoneFieldProps> = ({ value, onChange, disabled }) => {
  const [phonePrefix, setPhonePrefix] = useState<string>(() => {
    const match = (value as string | undefined)?.match(/^\+\d+/);
    return match ? match[0] : "+39";
  });
  const [phoneLocal, setPhoneLocal] = useState<string>(() => {
    const original = (value as string | undefined) ?? "";
    return original.replace(/^\+\d+\s*/, "");
  });

  useEffect(() => {
    const combined = phoneLocal ? `${phonePrefix} ${phoneLocal}` : phonePrefix;
    onChange(combined);
  }, [phonePrefix, phoneLocal, onChange]);

  const getMaxDigitsForPrefix = (prefix: string): number => {
    const found = COUNTRY_CALLING_CODES.find((c) => c.code === prefix);
    return found?.maxDigits ?? 15;
  };

  const countDigits = (s: string): number => (s.match(/\d/g) || []).length;

  return (
    <div>
      <Label htmlFor="companyPhone">Telefono</Label>
      <div className="flex gap-2">
        <Select value={phonePrefix} onValueChange={setPhonePrefix} disabled={disabled}>
          <SelectTrigger className="w-28" aria-label="Prefisso telefonico">
            <SelectValue placeholder="Prefisso" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_CALLING_CODES.map(opt => (
              <SelectItem key={opt.code} value={opt.code}>
                {`${countryCodeToFlagEmoji(opt.iso2)} ${opt.code}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id="companyPhone"
          type="tel"
          placeholder="123 456 7890"
          value={phoneLocal}
          onChange={(e) => {
            const value = e.target.value;
            const digitsOnlyCount = countDigits(value);
            const maxDigits = getMaxDigitsForPrefix(phonePrefix);
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
          }}
          inputMode="numeric"
          required
          disabled={disabled}
        />
      </div>
    </div>
  );
};
