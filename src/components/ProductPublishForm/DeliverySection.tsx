
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductFormData } from '@/types';

interface Props {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}

export default function DeliverySection({ formData, setFormData }: Props) {
  return (
    <fieldset>
      <legend className="font-medium mb-4">Modalità di consegna</legend>
      <div className="space-y-4">
        <div>
          <Label htmlFor="delivery_type">Tipo di consegna</Label>
          <Select
            value={formData.delivery_type || "pickup"}
            onValueChange={value => setFormData(prev => ({ ...prev, delivery_type: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona modalità" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pickup">Ritiro in sede</SelectItem>
              <SelectItem value="delivery">Consegna</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="delivery_area_km">Area di consegna (km)</Label>
          <Input
            type="number"
            id="delivery_area_km"
            value={formData.delivery_area_km === undefined ? "" : formData.delivery_area_km}
            onChange={e => setFormData(prev => ({
              ...prev,
              delivery_area_km: e.target.value === "" ? undefined : Number(e.target.value)
            }))}
            placeholder="Area di consegna in chilometri"
          />
        </div>
      </div>
    </fieldset>
  );
}
