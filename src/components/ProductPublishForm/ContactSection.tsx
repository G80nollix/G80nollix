
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductFormData } from '@/types';

interface Props {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}

export default function ContactSection({ formData, setFormData }: Props) {
  return (
    <fieldset>
      <legend className="font-medium mb-2">Informazioni di contatto</legend>
      <div>
        <Label htmlFor="contactPerson">Persona di contatto</Label>
        <Input
          type="text"
          id="contactPerson"
          value={formData.contactPerson}
          onChange={e => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
          placeholder="Nome della persona di contatto"
        />
      </div>
      <div>
        <Label htmlFor="contactPhone">Telefono di contatto</Label>
        <Input
          type="tel"
          id="contactPhone"
          value={formData.contactPhone}
          onChange={e => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
          placeholder="Numero di telefono per contatto"
        />
      </div>
      <div>
        <Label htmlFor="contactEmail">Email di contatto</Label>
        <Input
          type="email"
          id="contactEmail"
          value={formData.contactEmail}
          onChange={e => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
          placeholder="Indirizzo email per contatto"
        />
      </div>
    </fieldset>
  );
}
