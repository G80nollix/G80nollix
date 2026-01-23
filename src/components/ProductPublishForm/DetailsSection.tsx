
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  formData: any;
  setFormData: (f: any) => void;
}

export default function DetailsSection({ formData, setFormData }: Props) {
  return (
    <fieldset>
      <legend className="font-medium mb-2">Dettagli aggiuntivi</legend>
      <div>
        <Label htmlFor="dimensions">Dimensioni (H x L x P cm)</Label>
        <Input
          type="text"
          id="dimensions"
          value={formData.dimensions}
          onChange={e => setFormData((prev: any) => ({ ...prev, dimensions: e.target.value }))}
          placeholder="Es. 50x30x20"
        />
      </div>
      <div>
        <Label htmlFor="weight">Peso (kg)</Label>
        <Input
          type="text"
          id="weight"
          value={formData.weight}
          onChange={e => setFormData((prev: any) => ({ ...prev, weight: e.target.value }))}
          placeholder="Es. 2.5"
        />
      </div>
      <div>
        <Label htmlFor="power">Potenza</Label>
        <Input
          type="text"
          id="power"
          value={formData.power}
          onChange={e => setFormData((prev: any) => ({ ...prev, power: e.target.value }))}
          placeholder="Potenza del prodotto"
        />
      </div>
      <div>
        <Label htmlFor="capacity">Capacità</Label>
        <Input
          type="text"
          id="capacity"
          value={formData.capacity}
          onChange={e => setFormData((prev: any) => ({ ...prev, capacity: e.target.value }))}
          placeholder="Capacità del prodotto"
        />
      </div>
      <div>
        <Label htmlFor="specs">Specifiche tecniche</Label>
        <Textarea
          id="specs"
          value={formData.specs}
          onChange={e => setFormData((prev: any) => ({ ...prev, specs: e.target.value }))}
          placeholder="Specifiche tecniche dettagliate"
        />
      </div>
    </fieldset>
  );
}
