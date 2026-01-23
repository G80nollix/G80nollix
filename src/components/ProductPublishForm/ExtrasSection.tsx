
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  formData: any;
  setFormData: (f: any) => void;
}

export default function ExtrasSection({ formData, setFormData }: Props) {
  return (
    <fieldset>
      <legend className="font-medium mb-2">Servizi extra e Termini</legend>
      <div>
        <Label htmlFor="extraServices">Servizi extra</Label>
        <Textarea
          id="extraServices"
          value={formData.extraServices}
          onChange={e => setFormData((prev: any) => ({ ...prev, extraServices: e.target.value }))}
          placeholder="Servizi aggiuntivi offerti"
        />
      </div>
      <div>
        <Label htmlFor="terms">Termini e condizioni</Label>
        <Textarea
          id="terms"
          value={formData.terms}
          onChange={e => setFormData((prev: any) => ({ ...prev, terms: e.target.value }))}
          placeholder="Termini e condizioni del servizio"
        />
      </div>
    </fieldset>
  );
}
