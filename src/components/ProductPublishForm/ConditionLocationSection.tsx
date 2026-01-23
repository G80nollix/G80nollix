import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import type { ProductFormData } from '@/types';
import { BrandModelCombobox } from './BrandModelCombobox';
import { Info, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  conditions: { id: string; name: string }[];
  loadingConditions?: boolean;
  productId?: string;
}

interface InformativeAttribute {
  id: string;
  name: string;
  unit: string | null;
  values: { id: string; value: string }[];
}

export default function ConditionLocationSection({ formData, setFormData, conditions, loadingConditions, productId }: Props) {
  const [informativeAttributes, setInformativeAttributes] = useState<InformativeAttribute[]>([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  // Carica attributi informativi quando cambia la sottocategoria
  useEffect(() => {
    const loadInformativeAttributes = async () => {
      const subcategoryId = formData.id_product_subcategory || formData.product_subcategory_id;
      if (!subcategoryId) {
        setInformativeAttributes([]);
        return;
      }

      setLoadingAttributes(true);
      try {
        // Carica gli attributi informativi per la sottocategoria (is_variable = false)
        const { data: allowedAttrs, error: attrsError } = await supabase
          .from('allowed_subcategories_attributes')
          .select(`
            id_product_attribute,
            product_attributes!inner(id, name, unit)
          `)
          .eq('id_product_subcategory', subcategoryId)
          .eq('is_variable', false);

        if (attrsError) throw attrsError;

        if (!allowedAttrs || allowedAttrs.length === 0) {
          setInformativeAttributes([]);
          setLoadingAttributes(false);
          return;
        }

        // Carica i valori per ogni attributo
        const attributesWithValues: InformativeAttribute[] = [];
        for (const attr of allowedAttrs) {
          const { data: values, error: valuesError } = await supabase
            .from('product_attributes_values')
            .select('id, value')
            .eq('id_product_attribute', attr.id_product_attribute)
            .order('value');

          if (!valuesError && values) {
            attributesWithValues.push({
              id: attr.id_product_attribute,
              name: attr.product_attributes.name,
              unit: attr.product_attributes.unit,
              values: values,
            });
          }
        }

        setInformativeAttributes(attributesWithValues);

        // Reset attributi informativi quando cambia sottocategoria (se non è modifica)
        if (!productId) {
          setFormData(prev => ({
            ...prev,
            informativeAttributes: {},
          }));
        }

        // Carica i valori esistenti se si sta modificando un prodotto
        if (productId) {
          const { data: existingValues, error: existingError } = await supabase
            .from('product_informative_attribute_values')
            .select(`
              id_product_attribute_value,
              product_attributes_values!inner(id_product_attribute)
            `)
            .eq('id_product', productId);

          if (!existingError && existingValues) {
            const existingMap: { [key: string]: string } = {};
            existingValues.forEach((ev: any) => {
              if (ev.product_attributes_values) {
                existingMap[ev.product_attributes_values.id_product_attribute] = ev.id_product_attribute_value;
              }
            });

            setFormData(prev => ({
              ...prev,
              informativeAttributes: existingMap,
            }));
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento attributi informativi:', error);
      } finally {
        setLoadingAttributes(false);
      }
    };

    loadInformativeAttributes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.id_product_subcategory, formData.product_subcategory_id, productId]);

  const handleBrandSelect = (id: string, name: string) => {
    setFormData(prev => ({
      ...prev,
      id_brand: id === 'N/A' || id === '' ? null : id,
      brand: name === 'N/A' ? '' : name,
      // Reset model quando cambia brand o si seleziona N/A
      id_model: id === 'N/A' || id === '' ? null : prev.id_model,
      model: id === 'N/A' || id === '' ? '' : prev.model,
    }));
  };

  const handleModelSelect = (id: string, name: string) => {
    setFormData(prev => ({
      ...prev,
      id_model: id === 'N/A' || id === '' ? null : id,
      model: name === 'N/A' ? '' : name,
    }));
  };

  const handleInformativeAttributeChange = (attributeId: string, valueId: string) => {
    setFormData(prev => {
      const newInformativeAttributes = { ...(prev.informativeAttributes || {}) };
      if (valueId === 'N/A' || valueId === '') {
        // Rimuovi l'attributo se si seleziona N/A
        delete newInformativeAttributes[attributeId];
      } else {
        // Aggiungi o aggiorna l'attributo
        newInformativeAttributes[attributeId] = valueId;
      }
      return {
        ...prev,
        informativeAttributes: newInformativeAttributes,
      };
    });
  };

  return (
    <div>
      <Label htmlFor="brand">Marca</Label>
      <BrandModelCombobox
        type="brand"
        value={formData.id_brand === null ? 'N/A' : (formData.id_brand || '')}
        displayValue={formData.brand || (formData.id_brand === null ? 'N/A' : '')}
        onSelect={handleBrandSelect}
        placeholder="Seleziona o cerca marca"
        allowNone={true}
      />
      <Label htmlFor="model" className="mt-4">Modello</Label>
      <BrandModelCombobox
        type="model"
        value={formData.id_model === null ? 'N/A' : (formData.id_model || '')}
        displayValue={formData.model || (formData.id_model === null ? 'N/A' : '')}
        onSelect={handleModelSelect}
        placeholder="Seleziona o cerca modello"
        brandId={formData.id_brand || undefined}
        disabled={!formData.id_brand}
        allowNone={true}
      />
      
      {/* Attributi informativi - sempre visibili */}
      {informativeAttributes.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <Label className="text-base font-semibold mb-4 block">Attributi informativi</Label>
          {loadingAttributes ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Caricamento attributi...
            </div>
          ) : (
            <div className="space-y-4">
              {informativeAttributes.map((attr) => (
                <div key={attr.id}>
                  <Label htmlFor={`attr-${attr.id}`}>
                    {attr.name} {attr.unit && `(${attr.unit})`}
                  </Label>
                  <Select
                    value={formData.informativeAttributes?.[attr.id] || 'N/A'}
                    onValueChange={(value) => handleInformativeAttributeChange(attr.id, value)}
                  >
                    <SelectTrigger id={`attr-${attr.id}`} className="mt-1">
                      <SelectValue placeholder={`Seleziona ${attr.name.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="N/A">N/A</SelectItem>
                      {attr.values.map((val) => (
                        <SelectItem key={val.id} value={val.id}>
                          {val.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <Label className={`flex items-center gap-2 ${productId ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={formData.has_variants || false}
              onChange={(e) => setFormData(prev => ({ ...prev, has_variants: e.target.checked }))}
              disabled={!!productId}
              className="w-4 h-4 text-[#3fafa3] border-gray-300 rounded focus:ring-[#3fafa3] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span>Gestisci varianti</span>
          </Label>
          {productId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full w-5 h-5 bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors cursor-help"
                    aria-label="Informazioni sulla gestione varianti"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Non è possibile modificare la gestione varianti durante la modifica del prodotto
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1 ml-6">
          {productId 
            ? "Non è possibile modificare la gestione varianti durante la modifica del prodotto."
            : "Seleziona questa opzione se vuoi gestire varianti di questo prodotto (es. diverse taglie, colori, ecc.)"
          }
        </p>
      </div>
    </div>
  );
}
