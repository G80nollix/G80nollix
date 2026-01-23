import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ProductFormData } from '@/types';

interface Props {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  productId?: string; // ID del prodotto se si sta modificando
}

interface PricePeriod {
  id: string;
  code: string;
  name: string;
  name_plural: string | null;
  period_type: string;
  value: number | null;
  unit: string | null;
  display_order: number;
  description: string | null;
}

export default function ProductPricingSection({ formData, setFormData, productId }: Props) {
  // Ref per tracciare se abbiamo già caricato i prezzi iniziali
  const pricesLoadedRef = useRef<string | null>(null);

  // Carica i periodi disponibili dal database (solo quelli attivi)
  const { data: periods, isLoading: loadingPeriods } = useQuery({
    queryKey: ['price_periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_periods')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return (data || []) as PricePeriod[];
    }
  });

  // Carica i prezzi esistenti se si sta modificando un prodotto
  const { data: existingPrices } = useQuery({
    queryKey: ['product_prices', productId],
    queryFn: async () => {
      if (!productId) return null;
      const { data, error } = await supabase
        .from('product_price_list')
        .select('id_price_period, price')
        .eq('id_product', productId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productId,
  });

  // Inizializza pricePeriods se non esiste
  useEffect(() => {
    if (!formData.pricePeriods) {
      setFormData(prev => ({
        ...prev,
        pricePeriods: {}
      }));
    }
  }, [formData.pricePeriods, setFormData]);

  // Carica i prezzi esistenti nel form quando vengono recuperati
  // Aggiorna sempre quando existingPrices cambia (dopo un salvataggio)
  useEffect(() => {
    if (existingPrices !== undefined) {
      // Se existingPrices è un array vuoto o null, significa che non ci sono prezzi nel DB
      // Se è un array con elementi, carichiamo i prezzi
      const pricePeriodsMap: { [key: string]: number } = {};
      
      if (existingPrices && existingPrices.length > 0) {
        existingPrices.forEach((priceEntry: any) => {
          if (priceEntry.id_price_period && priceEntry.price !== null) {
            pricePeriodsMap[priceEntry.id_price_period] = Number(priceEntry.price);
          }
        });
      }

      // Crea una chiave univoca basata sui prezzi per verificare se sono cambiati
      const pricesKey = JSON.stringify(pricePeriodsMap);
      
      // Aggiorna solo se i prezzi sono cambiati rispetto all'ultimo caricamento
      if (pricesLoadedRef.current !== pricesKey) {
        setFormData(prev => ({
          ...prev,
          pricePeriods: pricePeriodsMap
        }));
        pricesLoadedRef.current = pricesKey;
      }
    }
  }, [existingPrices, setFormData]);

  const handlePeriodToggle = (periodId: string, checked: boolean) => {
    setFormData((prev) => {
      const newPricePeriods = { ...(prev.pricePeriods || {}) };
      
      if (checked) {
        // Seleziona il periodo (inizializza a null, l'utente inserirà il prezzo)
        newPricePeriods[periodId] = null;
      } else {
        // Deseleziona il periodo (rimuovi dalla lista)
        delete newPricePeriods[periodId];
      }
      
      return {
        ...prev,
        pricePeriods: newPricePeriods
      };
    });
  };

  const handlePriceChange = (periodId: string, price: string) => {
    setFormData((prev) => ({
      ...prev,
      pricePeriods: {
        ...(prev.pricePeriods || {}),
        [periodId]: price === "" ? null : Number(price)
      }
    }));
  };

  if (loadingPeriods) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Caricamento periodi...</span>
      </div>
    );
  }

  if (!periods || periods.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          Nessun periodo di prezzo disponibile. Contatta l'amministratore per configurare i periodi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {periods.map((period) => {
          const isSelected = formData.pricePeriods && period.id in formData.pricePeriods;
          const price = formData.pricePeriods?.[period.id] ?? null;
          
          return (
            <div
              key={period.id}
              className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id={`period-${period.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => 
                    handlePeriodToggle(period.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`period-${period.id}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {period.name}
                  {period.description && (
                    <span className="text-xs text-muted-foreground block mt-1">
                      {period.description}
                    </span>
                  )}
                </Label>
              </div>
              
              {isSelected && (
                <div className="flex-1 max-w-xs">
                  <Label htmlFor={`price-${period.id}`} className="text-xs text-muted-foreground">
                    Prezzo (€)
                  </Label>
                  <Input
                    type="number"
                    id={`price-${period.id}`}
                    step="0.01"
                    min="0"
                    value={price === null || price === undefined ? "" : price}
                    onChange={(e) => handlePriceChange(period.id, e.target.value)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          Seleziona i periodi di prezzo che vuoi utilizzare per questo prodotto e inserisci il prezzo per ciascuno.
          Se un periodo non viene selezionato, significa che non ci sono di riferimento specifichi per quel periodo.
        </p>
      </div>
    </div>
  );
}
