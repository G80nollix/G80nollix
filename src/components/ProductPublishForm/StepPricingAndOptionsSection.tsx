import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

interface Props {
  formData: any;
  setFormData: (f: any) => void;
}

export default function StepPricingAndOptionsSection({ formData, setFormData }: Props) {
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [hasInteractedWithDelivery, setHasInteractedWithDelivery] = useState(false);

  // Validazione dei campi delivery solo dopo interazione
  useEffect(() => {
    if (hasInteractedWithDelivery && !formData.delivery && !formData.pickup_on_site) {
      setDeliveryError('Seleziona almeno una modalità di ritiro/spedizione');
    } else {
      setDeliveryError(null);
    }
  }, [formData.delivery, formData.pickup_on_site, hasInteractedWithDelivery]);

  const handleDeliveryChange = (field: 'delivery' | 'pickup_on_site', checked: boolean) => {
    setHasInteractedWithDelivery(true);
    setFormData((prev: any) => ({ ...prev, [field]: checked }));
    
    // Validazione in tempo reale
    const newDelivery = field === 'delivery' ? checked : formData.delivery;
    const newPickupOnSite = field === 'pickup_on_site' ? checked : formData.pickup_on_site;
    
    if (!newDelivery && !newPickupOnSite) {
      setDeliveryError('Seleziona almeno una modalità di ritiro/spedizione');
    } else {
      setDeliveryError(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="min_rent_duration_day">Durata minima del noleggio (giorni)</Label>
          <Input
            type="number"
            id="min_rent_duration_day"
            value={formData.min_rent_duration_day === undefined ? "" : formData.min_rent_duration_day}
            onChange={e => {
              setFormData((prev: any) => ({
                ...prev,
                min_rent_duration_day: e.target.value === "" ? undefined : Number(e.target.value)
              }));
            }}
            placeholder="Durata minima in giorni"
            min={0}
          />
        </div>
        <div>
          <Label htmlFor="min_rent_duration_hours">Durata minima del noleggio (ore)</Label>
          <Input
            type="number"
            id="min_rent_duration_hours"
            value={formData.min_rent_duration_hours === undefined ? "" : formData.min_rent_duration_hours}
            onChange={e => {
              setFormData((prev: any) => ({
                ...prev,
                min_rent_duration_hours: e.target.value === "" ? undefined : Number(e.target.value)
              }));
            }}
            placeholder="Durata minima in ore"
            min={0}
          />
        </div>
        <div>
          <Label htmlFor="deposit">Deposito</Label>
          <Input
            type="number"
            id="deposit"
            step="0.01"
            min="0"
            value={formData.deposit === undefined || formData.deposit === null ? "" : formData.deposit}
            onChange={e => {
              setFormData((prev: any) => ({
                ...prev,
                deposit: e.target.value === "" ? null : Number(e.target.value)
              }));
            }}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!formData.delivery}
            onChange={e => handleDeliveryChange('delivery', e.target.checked)}
          />
          Spedizione disponibile
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!formData.pickup_on_site}
            onChange={e => handleDeliveryChange('pickup_on_site', e.target.checked)}
          />
          Ritiro in loco
        </label>
      </div>
      {deliveryError && <div className="text-red-500 text-sm mt-2">{deliveryError}</div>}
    </div>
  );
} 