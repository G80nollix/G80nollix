import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AttributeValueCombobox } from "@/components/ProductPublishForm/AttributeValueCombobox";
import { ArrowLeft, Plus, Ban, Loader2, Zap, Edit, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from '@tanstack/react-query';

interface ProductAttribute {
  id: string;
  name: string;
  unit: string | null;
  is_variable: boolean;
}

interface AttributeValue {
  id: string;
  value: string;
  id_product_attribute: string;
}

interface Variant {
  id: string;
  id_product: string;
  attributeValues: { [key: string]: string }; // attribute_id -> value_id
  pricePeriods?: { [periodId: string]: number | null }; // periodId -> price
  deposit?: number;
  is_active?: boolean;
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

interface VariantStockCounts {
  rentable: number;
  maintenance: number;
  nonRentable: number;
}

export default function ProductVariants() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<{ [key: string]: AttributeValue[] }>({});
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantStockCounts, setVariantStockCounts] = useState<{ [variantId: string]: VariantStockCounts }>({});
  const [selectedAttributes, setSelectedAttributes] = useState<{ [key: string]: string }>({}); // attribute_id -> value_id
  const [showNewVariantForm, setShowNewVariantForm] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [editingVariant, setEditingVariant] = useState<string | null>(null); // ID della variante in modifica
  const [variantFilter, setVariantFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editVariantData, setEditVariantData] = useState({
    pricePeriods: {} as { [periodId: string]: number | null },
    deposit: '',
    stock: '',
    is_active: true,
  });
  const [newVariantData, setNewVariantData] = useState({
    pricePeriods: {} as { [periodId: string]: number | null },
    deposit: '',
    stock: '',
    is_active: true,
  });

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

  // Carica i prezzi esistenti del prodotto per precompilare quando si crea una nuova variante
  const { data: productPrices } = useQuery({
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

  useEffect(() => {
    if (!productId) return;
    loadData();
  }, [productId]);

  // Precompila i prezzi del prodotto quando si apre il form di nuova variante
  useEffect(() => {
    if (productPrices && productPrices.length > 0 && showNewVariantForm && Object.keys(newVariantData.pricePeriods).length === 0) {
      const pricePeriodsMap: { [periodId: string]: number | null } = {};
      productPrices.forEach((priceEntry: any) => {
        if (priceEntry.id_price_period && priceEntry.price !== null) {
          pricePeriodsMap[priceEntry.id_price_period] = Number(priceEntry.price);
        }
      });
      
      setNewVariantData(prev => ({
        ...prev,
        pricePeriods: pricePeriodsMap
      }));
    }
  }, [productPrices, showNewVariantForm, newVariantData.pricePeriods]);

  const loadData = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      // Carica il prodotto con la sottocategoria
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          product_subcategory:id_product_subcategory(id, name)
        `)
        .eq('id', productId)
        .single();

      if (productError) throw productError;
      setProduct(productData);

      if (!productData?.id_product_subcategory) {
        toast({
          title: 'Errore',
          description: 'Prodotto senza sottocategoria',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Carica gli attributi abilitati per la sottocategoria
      const { data: allowedAttrs, error: attrsError } = await supabase
        .from('allowed_subcategories_attributes')
        .select(`
          id_product_attribute,
          is_variable,
          product_attributes!inner(id, name, unit)
        `)
        .eq('id_product_subcategory', productData.id_product_subcategory)
        .eq('is_variable', true);

      if (attrsError) throw attrsError;

      const attrs = (allowedAttrs || []).map((a: any) => ({
        id: a.product_attributes.id,
        name: a.product_attributes.name,
        unit: a.product_attributes.unit,
        is_variable: a.is_variable,
      }));

      setAttributes(attrs);

      // Carica i valori per ogni attributo
      const valuesMap: { [key: string]: AttributeValue[] } = {};
      for (const attr of attrs) {
        const { data: values, error: valuesError } = await supabase
          .from('product_attributes_values')
          .select('*')
          .eq('id_product_attribute', attr.id);

        if (!valuesError && values) {
          valuesMap[attr.id] = values;
        }
      }
      setAttributeValues(valuesMap);

      // Carica le varianti esistenti
      await loadVariants(productId);
    } catch (error) {
      console.error('Errore nel caricamento:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i dati del prodotto',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadVariants = async (prodId: string) => {
    try {
      // I prezzi non sono più nella tabella product_variants, sono in product_variant_price_list
      const { data: variantsData, error: variantsError } = await supabase
        .from('product_variants')
        .select(`
          id,
          id_product,
          is_active,
          deposit,
          images,
          created_at,
          updated_at,
          product_variant_attribute_values(
            id_product_attribute_value,
            product_attributes_values!inner(
              id,
              value,
              id_product_attribute
            )
          )
        `)
        .eq('id_product', prodId);

      if (variantsError) throw variantsError;

      // Carica i prezzi per ogni variante da product_variant_price_list
      const mappedVariants = await Promise.all((variantsData || []).map(async (v: any) => {
        const attrValues: { [key: string]: string } = {};
        (v.product_variant_attribute_values || []).forEach((pvav: any) => {
          if (pvav.product_attributes_values) {
            attrValues[pvav.product_attributes_values.id_product_attribute] = pvav.product_attributes_values.id;
          }
        });
        
        // Carica i prezzi della variante da product_variant_price_list
        const { data: variantPrices } = await supabase
          .from('product_variant_price_list')
          .select('id_price_period, price')
          .eq('id_product_variant', v.id);
        
        const pricePeriods: { [periodId: string]: number | null } = {};
        if (variantPrices) {
          variantPrices.forEach((vp: any) => {
            if (vp.id_price_period && vp.price !== null) {
              pricePeriods[vp.id_price_period] = Number(vp.price);
            }
          });
        }
        
        return {
          id: v.id,
          id_product: v.id_product,
          attributeValues: attrValues,
          pricePeriods,
          deposit: v.deposit,
          is_active: v.is_active,
        };
      }));

      // Filtra le varianti che non hanno attributi associati
      // Questo può accadere quando un prodotto passa da has_variants=false a has_variants=true
      const variantsWithAttributes = mappedVariants.filter(variant => 
        Object.keys(variant.attributeValues).length > 0
      );

      setVariants(variantsWithAttributes);
      
      // Carica i conteggi stock per ogni variante
      await loadVariantStockCounts(variantsWithAttributes.map(v => v.id));
    } catch (error) {
      console.error('Errore nel caricamento varianti:', error);
    }
  };

  // Filtra le varianti in base al filtro selezionato
  const filteredVariants = useMemo(() => {
    if (variantFilter === 'all') {
      return variants;
    } else if (variantFilter === 'active') {
      return variants.filter(v => v.is_active === true);
    } else {
      return variants.filter(v => v.is_active === false);
    }
  }, [variants, variantFilter]);

  const loadVariantStockCounts = async (variantIds: string[]) => {
    if (variantIds.length === 0) {
      setVariantStockCounts({});
      return;
    }

    try {
      // ID degli stati
      const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b'; // Noleggiabile
      const maintenanceStatusId = '2cab08fa-de9b-4abb-ad5f-d48be31da5e3'; // In manutenzione
      const nonRentableStatusId = '1c971f6d-5a0c-4d48-9f12-1f7eaa3ccf43'; // Non noleggiabile

      const counts: { [variantId: string]: VariantStockCounts } = {};

      for (const variantId of variantIds) {
        // Conta unità noleggiabili
        const { count: rentableCount } = await supabase
          .from('product_units')
          .select('*', { count: 'exact', head: true })
          .eq('id_product_variant', variantId)
          .eq('id_product_status', rentableStatusId);

        // Conta unità in manutenzione
        const { count: maintenanceCount } = await supabase
          .from('product_units')
          .select('*', { count: 'exact', head: true })
          .eq('id_product_variant', variantId)
          .eq('id_product_status', maintenanceStatusId);

        // Conta unità non noleggiabili
        const { count: nonRentableCount } = await supabase
          .from('product_units')
          .select('*', { count: 'exact', head: true })
          .eq('id_product_variant', variantId)
          .eq('id_product_status', nonRentableStatusId);

        counts[variantId] = {
          rentable: rentableCount || 0,
          maintenance: maintenanceCount || 0,
          nonRentable: nonRentableCount || 0,
        };
      }

      setVariantStockCounts(counts);
    } catch (error) {
      console.error('Errore nel caricamento conteggi stock:', error);
    }
  };

  // Funzione per verificare se esiste già una variante con la stessa combinazione di attributi
  const checkVariantExists = async (combo: { [key: string]: string }, excludeVariantId?: string): Promise<boolean> => {
    if (!productId) return false;

    try {
      // Carica tutte le varianti esistenti
      const { data: existingVariants } = await supabase
        .from('product_variants')
        .select(`
          id,
          product_variant_attribute_values(
            id_product_attribute_value,
            product_attributes_values!inner(
              id,
              id_product_attribute
            )
          )
        `)
        .eq('id_product', productId);

      if (!existingVariants) return false;

      // Crea la chiave della combinazione corrente
      const comboKey = Object.entries(combo)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([attrId, valueId]) => `${attrId}:${valueId}`)
        .join('|');

      // Verifica se esiste una variante con la stessa combinazione
      for (const variant of existingVariants) {
        // Escludi la variante corrente se stiamo modificando
        if (excludeVariantId && variant.id === excludeVariantId) {
          continue;
        }

        const attrValueMap: { [key: string]: string } = {};
        (variant.product_variant_attribute_values || []).forEach((pvav: any) => {
          if (pvav.product_attributes_values) {
            attrValueMap[pvav.product_attributes_values.id_product_attribute] = pvav.product_attributes_values.id;
          }
        });

        const existingComboKey = Object.entries(attrValueMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([attrId, valueId]) => `${attrId}:${valueId}`)
          .join('|');

        if (existingComboKey === comboKey) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Errore nel controllo variante esistente:', error);
      return false;
    }
  };

  const handleCreateVariant = async () => {
    if (!productId) return;

    // Verifica che tutti gli attributi siano selezionati
    const missingAttributes = attributes.filter(attr => !selectedAttributes[attr.id]);
    if (missingAttributes.length > 0) {
      toast({
        title: 'Errore',
        description: `Seleziona tutti gli attributi: ${missingAttributes.map(a => a.name).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    // Verifica se esiste già una variante con la stessa combinazione
    const exists = await checkVariantExists(selectedAttributes);
    if (exists) {
      toast({
        title: 'Errore',
        description: 'Esiste già una variante con questa combinazione di attributi. Le varianti devono essere univoche.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Crea la variante (senza i vecchi campi prezzo)
      const { data: variant, error: variantError } = await supabase
        .from('product_variants')
        .insert({
          id_product: productId,
          deposit: newVariantData.deposit ? parseFloat(newVariantData.deposit) : null,
          is_active: newVariantData.is_active,
        })
        .select('id, id_product, is_active, deposit, images, created_at, updated_at')
        .single();

      if (variantError) throw variantError;

      // Salva i prezzi in product_variant_price_list
      if (newVariantData.pricePeriods && Object.keys(newVariantData.pricePeriods).length > 0) {
        const priceListEntries = Object.entries(newVariantData.pricePeriods)
          .filter(([periodId, price]) => {
            const isValid = periodId && 
                           periodId !== '' && 
                           price !== null && 
                           price !== undefined &&
                           typeof price === 'number' &&
                           !isNaN(price) &&
                           price > 0;
            return isValid;
          })
          .map(([periodId, price]) => ({
            id_product_variant: variant.id,
            id_price_period: periodId,
            price: Number(price),
          }));

        if (priceListEntries.length > 0) {
          const { error: priceListError } = await supabase
            .from('product_variant_price_list')
            .insert(priceListEntries);

          if (priceListError) {
            console.error('Errore inserimento prezzi in product_variant_price_list:', priceListError);
            throw priceListError;
          }
        }
      }

      // Collega i valori degli attributi alla variante
      const attributeValueLinks = Object.entries(selectedAttributes).map(([attrId, valueId]) => ({
        id_product_variant: variant.id,
        id_product_attribute_value: valueId,
      }));

      if (attributeValueLinks.length > 0) {
        const { error: linksError } = await supabase
          .from('product_variant_attribute_values')
          .insert(attributeValueLinks);

        if (linksError) throw linksError;
      }

      // Crea le product_units se è stato specificato uno stock
      const stockQuantity = newVariantData.stock ? parseInt(newVariantData.stock) : 0;
      if (stockQuantity > 0) {
        // ID dello stato "Noleggiabile"
        const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b';
        // ID della condizione "Usato - Ottimo stato"
        const excellentConditionId = 'e915cf03-8bec-4cad-9ed0-9798d8670af6';

        const unitsToInsert = Array.from({ length: stockQuantity }).map(() => ({
          id_product_variant: variant.id,
          serial_number: null,
          id_product_status: rentableStatusId,
          id_product_condition: excellentConditionId,
        }));

        const { error: unitsError } = await supabase
          .from('product_units')
          .insert(unitsToInsert);

        if (unitsError) throw unitsError;
      }

      toast({
        title: 'Successo',
        description: `Variante creata con successo${stockQuantity > 0 ? ` e ${stockQuantity} unità aggiunte` : ''}`,
      });

      // Reset form
      setSelectedAttributes({});
      setNewVariantData({
        pricePeriods: {},
        deposit: '',
        stock: '',
        is_active: true,
      });
      setShowNewVariantForm(false);

      // Ricarica le varianti
      await loadVariants(productId);
    } catch (error: any) {
      console.error('Errore nella creazione variante:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile creare la variante',
        variant: 'destructive',
      });
    }
  };

  const handleEditVariant = async (variant: Variant) => {
    setEditingVariant(variant.id);
    
    // Carica i prezzi esistenti della variante
    const { data: variantPrices } = await supabase
      .from('product_variant_price_list')
      .select('id_price_period, price')
      .eq('id_product_variant', variant.id);
    
    const pricePeriods: { [periodId: string]: number | null } = {};
    if (variantPrices) {
      variantPrices.forEach((vp: any) => {
        if (vp.id_price_period && vp.price !== null) {
          pricePeriods[vp.id_price_period] = Number(vp.price);
        }
      });
    }
    
    setEditVariantData({
      pricePeriods,
      deposit: variant.deposit?.toString() || '',
      stock: '', // Non più utilizzato, solo per compatibilità
      is_active: variant.is_active ?? true,
    });
    // Imposta gli attributi selezionati per la modifica
    setSelectedAttributes(variant.attributeValues);
  };

  const handleSaveVariant = async (variantId: string) => {
    if (!productId) return;

    // Verifica che tutti gli attributi siano selezionati
    const missingAttributes = attributes.filter(attr => !selectedAttributes[attr.id]);
    if (missingAttributes.length > 0) {
      toast({
        title: 'Errore',
        description: `Seleziona tutti gli attributi: ${missingAttributes.map(a => a.name).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    // Verifica se esiste già una variante con la stessa combinazione (escludendo quella corrente)
    const exists = await checkVariantExists(selectedAttributes, variantId);
    if (exists) {
      toast({
        title: 'Errore',
        description: 'Esiste già una variante con questa combinazione di attributi. Le varianti devono essere univoche.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Aggiorna la variante (senza i vecchi campi prezzo)
      const { error: variantError } = await supabase
        .from('product_variants')
        .update({
          deposit: editVariantData.deposit ? parseFloat(editVariantData.deposit) : null,
        })
        .eq('id', variantId);

      if (variantError) throw variantError;

      // Aggiorna i prezzi in product_variant_price_list
      // Elimina i vecchi prezzi
      const { error: deleteError } = await supabase
        .from('product_variant_price_list')
        .delete()
        .eq('id_product_variant', variantId);

      if (deleteError) {
        console.error('Errore eliminazione prezzi variante:', deleteError);
      } else {
        // Inserisci i nuovi prezzi
        if (editVariantData.pricePeriods && Object.keys(editVariantData.pricePeriods).length > 0) {
          const priceListEntries = Object.entries(editVariantData.pricePeriods)
            .filter(([periodId, price]) => {
              const isValid = periodId && 
                             periodId !== '' && 
                             price !== null && 
                             price !== undefined &&
                             typeof price === 'number' &&
                             !isNaN(price) &&
                             price > 0;
              return isValid;
            })
            .map(([periodId, price]) => ({
              id_product_variant: variantId,
              id_price_period: periodId,
              price: Number(price),
            }));

          if (priceListEntries.length > 0) {
            const { error: priceListError } = await supabase
              .from('product_variant_price_list')
              .insert(priceListEntries);

            if (priceListError) {
              console.error('Errore inserimento prezzi in product_variant_price_list:', priceListError);
              throw priceListError;
            }
          }
        }
      }

      // Aggiorna i valori degli attributi se sono cambiati
      // Prima elimina i vecchi collegamenti
      const { error: deleteLinksError } = await supabase
        .from('product_variant_attribute_values')
        .delete()
        .eq('id_product_variant', variantId);

      if (deleteLinksError) throw deleteLinksError;

      // Poi inserisci i nuovi
      const attributeValueLinks = Object.entries(selectedAttributes).map(([attrId, valueId]) => ({
        id_product_variant: variantId,
        id_product_attribute_value: valueId,
      }));

      if (attributeValueLinks.length > 0) {
        const { error: linksError } = await supabase
          .from('product_variant_attribute_values')
          .insert(attributeValueLinks);

        if (linksError) throw linksError;
      }

      toast({
        title: 'Successo',
        description: 'Variante aggiornata con successo',
      });

      setEditingVariant(null);
      setSelectedAttributes({});
      await loadVariants(productId);
      
      // Ricarica i conteggi stock
      const currentVariantIds = variants.map(v => v.id);
      if (currentVariantIds.length > 0) {
        await loadVariantStockCounts(currentVariantIds);
      }
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento variante:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile aggiornare la variante',
        variant: 'destructive',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingVariant(null);
    setSelectedAttributes({});
    setEditVariantData({
      pricePeriods: {},
      deposit: '',
      stock: '',
      is_active: true,
    });
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!window.confirm('Sei sicuro di voler disattivare questa variante?')) return;

    try {
      // Imposta is_active = false invece di eliminare
      const { error: variantError } = await supabase
        .from('product_variants')
        .update({ is_active: false })
        .eq('id', variantId);

      if (variantError) throw variantError;

      toast({
        title: 'Successo',
        description: 'Variante disattivata con successo',
      });

      if (productId) {
        await loadVariants(productId);
        
        // Ricarica i conteggi stock
        const currentVariantIds = variants.map(v => v.id);
        if (currentVariantIds.length > 0) {
          await loadVariantStockCounts(currentVariantIds);
        }
      }
    } catch (error: any) {
      console.error('Errore nella disattivazione variante:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile disattivare la variante',
        variant: 'destructive',
      });
    }
  };

  const getVariantDisplayName = (variant: Variant) => {
    const parts: string[] = [];
    attributes.forEach(attr => {
      const valueId = variant.attributeValues[attr.id];
      if (valueId) {
        const values = attributeValues[attr.id] || [];
        const value = values.find(v => v.id === valueId);
        if (value) {
          parts.push(`${attr.name}: ${value.value}${attr.unit ? ` ${attr.unit}` : ''}`);
        }
      }
    });
    return parts.length > 0 ? parts.join(' | ') : 'Variante senza attributi';
  };

  // Funzione per generare tutte le combinazioni possibili
  const generateAllCombinations = (): Array<{ [key: string]: string }> => {
    if (attributes.length === 0) return [];

    // Crea un array di array di valori per ogni attributo
    const valueArrays = attributes.map(attr => {
      const values = attributeValues[attr.id] || [];
      return values.map(v => ({ attrId: attr.id, valueId: v.id }));
    });

    // Funzione ricorsiva per generare il prodotto cartesiano
    const cartesian = (arrays: any[][]): any[][] => {
      if (arrays.length === 0) return [[]];
      if (arrays.length === 1) return arrays[0].map(item => [item]);
      
      const [first, ...rest] = arrays;
      const restCombinations = cartesian(rest);
      const result: any[][] = [];
      
      for (const item of first) {
        for (const combination of restCombinations) {
          result.push([item, ...combination]);
        }
      }
      
      return result;
    };

    // Genera tutte le combinazioni
    const combinations = cartesian(valueArrays);
    
    // Converti in formato { attribute_id: value_id }
    return combinations.map(combo => {
      const result: { [key: string]: string } = {};
      combo.forEach((item: any) => {
        result[item.attrId] = item.valueId;
      });
      return result;
    });
  };

  const handleGenerateAllVariants = async () => {
    if (!productId) return;

    const combinations = generateAllCombinations();
    
    if (combinations.length === 0) {
      toast({
        title: 'Errore',
        description: 'Nessuna combinazione possibile. Verifica che ci siano valori per tutti gli attributi.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingAll(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Carica tutte le varianti esistenti per verificare duplicati
      const { data: existingVariants } = await supabase
        .from('product_variants')
        .select(`
          id,
          product_variant_attribute_values(
            id_product_attribute_value,
            product_attributes_values!inner(
              id,
              id_product_attribute
            )
          )
        `)
        .eq('id_product', productId);

      // Crea una mappa delle combinazioni esistenti
      const existingCombinations = new Set<string>();
      if (existingVariants) {
        existingVariants.forEach((v: any) => {
          const attrValueMap: { [key: string]: string } = {};
          (v.product_variant_attribute_values || []).forEach((pvav: any) => {
            if (pvav.product_attributes_values) {
              attrValueMap[pvav.product_attributes_values.id_product_attribute] = pvav.product_attributes_values.id;
            }
          });
          const comboKey = Object.entries(attrValueMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([attrId, valueId]) => `${attrId}:${valueId}`)
            .join('|');
          if (comboKey) {
            existingCombinations.add(comboKey);
          }
        });
      }

      for (const combo of combinations) {
        try {
          // Verifica se questa combinazione esiste già
          const comboKey = Object.entries(combo)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([attrId, valueId]) => `${attrId}:${valueId}`)
            .join('|');

          if (existingCombinations.has(comboKey)) {
            continue; // Salta questa combinazione se esiste già
          }

          // Crea la variante (senza i vecchi campi prezzo)
          const { data: variant, error: variantError } = await supabase
            .from('product_variants')
            .insert({
              id_product: productId,
              deposit: newVariantData.deposit ? parseFloat(newVariantData.deposit) : null,
              is_active: newVariantData.is_active,
            })
            .select('id, id_product, is_active, deposit, images, created_at, updated_at')
            .single();

          if (variantError) {
            throw variantError;
          }

          // Salva i prezzi in product_variant_price_list
          if (newVariantData.pricePeriods && Object.keys(newVariantData.pricePeriods).length > 0) {
            const priceListEntries = Object.entries(newVariantData.pricePeriods)
              .filter(([periodId, price]) => {
                if (!periodId || periodId === '') return false;
                if (price === null || price === undefined) return false;
                const priceNum = typeof price === 'number' ? price : Number(price);
                return !isNaN(priceNum) && priceNum > 0;
              })
              .map(([periodId, price]) => ({
                id_product_variant: variant.id,
                id_price_period: periodId,
                price: Number(price),
              }));

            if (priceListEntries.length > 0) {
              const { error: priceListError } = await supabase
                .from('product_variant_price_list')
                .insert(priceListEntries);

              if (priceListError) {
                console.error('Errore inserimento prezzi in product_variant_price_list:', priceListError);
                throw priceListError;
              }
            }
          }

          // Collega i valori degli attributi alla variante
          const attributeValueLinks = Object.entries(combo).map(([attrId, valueId]) => ({
            id_product_variant: variant.id,
            id_product_attribute_value: valueId,
          }));

          if (attributeValueLinks.length > 0) {
            const { error: linksError } = await supabase
              .from('product_variant_attribute_values')
              .insert(attributeValueLinks);

            if (linksError) throw linksError;
          }

          // Crea le product_units se è stato specificato uno stock
          const stockQuantity = newVariantData.stock ? parseInt(newVariantData.stock) : 0;
          if (stockQuantity > 0) {
            // ID dello stato "Noleggiabile"
            const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b';
            // ID della condizione "Usato - Ottimo stato"
            const excellentConditionId = 'e915cf03-8bec-4cad-9ed0-9798d8670af6';

            const unitsToInsert = Array.from({ length: stockQuantity }).map(() => ({
              id_product_variant: variant.id,
              serial_number: null,
              id_product_status: rentableStatusId,
              id_product_condition: excellentConditionId,
            }));

            const { error: unitsError } = await supabase
              .from('product_units')
              .insert(unitsToInsert);

            if (unitsError) throw unitsError;
          }

          existingCombinations.add(comboKey); // Aggiungi alla mappa per evitare duplicati nello stesso batch
          successCount++;
        } catch (error: any) {
          console.error('Errore nella creazione variante:', error);
          errorCount++;
        }
      }

      toast({
        title: 'Completato',
        description: `Generate ${successCount} varianti${errorCount > 0 ? `, ${errorCount} errori` : ''}`,
      });

      // Ricarica le varianti
      await loadVariants(productId);
    } catch (error: any) {
      console.error('Errore nella generazione varianti:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile generare le varianti',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#3fafa3]" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Prodotto non trovato</p>
          <Button onClick={() => navigate('/admin/catalog')} className="mt-4">
            Torna al catalogo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/catalog')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Indietro
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            Gestione Varianti - {product.name}
          </h1>
          <div className="flex-1" />
        </div>

        <Card>
          <CardHeader>
            <p className="text-sm text-gray-500">
              Sottocategoria: {product.product_subcategory?.name || '-'}
            </p>
          </CardHeader>
          <CardContent>
            {attributes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Nessun attributo variabile configurato per questa sottocategoria.</p>
                <p className="text-sm mt-2">Configura gli attributi nella tabella allowed_subcategories_attributes.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Attributi disponibili</h3>
                  <div className="space-y-4">
                    {attributes.map(attr => {
                      const values = attributeValues[attr.id] || [];
                      const totalCombinations = generateAllCombinations().length;
                      return (
                        <div key={attr.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-base font-semibold">
                              {attr.name} {attr.unit && `(${attr.unit})`}
                            </Label>
                            <span className="text-sm text-gray-500">{values.length} valori</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {values.map(value => (
                              <span
                                key={value.id}
                                className="px-3 py-1 bg-gray-100 rounded-md text-sm"
                              >
                                {value.value}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {attributes.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Totale combinazioni possibili:</strong> {generateAllCombinations().length}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mb-6">
                  <Button
                    onClick={handleGenerateAllVariants}
                    disabled={true}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white opacity-50 cursor-not-allowed"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Genera tutte le varianti ({generateAllCombinations().length})
                  </Button>
                  <Button
                    onClick={() => {
                      // I prezzi del prodotto vengono precompilati automaticamente tramite useEffect
                      setShowNewVariantForm(true);
                    }}
                    disabled={showNewVariantForm}
                    className="flex-1 bg-[#3fafa3] hover:bg-[#3fafa3] text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crea variante singola
                  </Button>
                </div>

                {showNewVariantForm && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle>Nuova Variante</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="mb-4">
                        <h4 className="font-semibold mb-3">Seleziona i valori degli attributi</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {attributes.map(attr => {
                            const selectedValue = attributeValues[attr.id]?.find(v => v.id === selectedAttributes[attr.id]);
                            return (
                              <div key={attr.id}>
                                <Label>{attr.name} {attr.unit && `(${attr.unit})`} *</Label>
                                <AttributeValueCombobox
                                  attributeId={attr.id}
                                  value={selectedAttributes[attr.id] || ''}
                                  displayValue={selectedValue?.value}
                                  onSelect={async (id, value) => {
                                    setSelectedAttributes(prev => ({ ...prev, [attr.id]: id }));
                                    // Aggiorna anche la lista locale dei valori se è un nuovo valore
                                    if (!attributeValues[attr.id]?.find(v => v.id === id)) {
                                      // Ricarica i valori per questo attributo
                                      const { data: newValues } = await supabase
                                        .from('product_attributes_values')
                                        .select('id, value, id_product_attribute')
                                        .eq('id_product_attribute', attr.id)
                                        .order('value');
                                      
                                      if (newValues) {
                                        setAttributeValues(prev => ({
                                          ...prev,
                                          [attr.id]: newValues
                                        }));
                                      }
                                    }
                                  }}
                                  placeholder={`Seleziona ${attr.name}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {/* Sezione Prezzi - Periodi dinamici */}
                      {loadingPeriods ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">Caricamento periodi...</span>
                        </div>
                      ) : periods && periods.length > 0 ? (
                        <div className="space-y-4">
                          <h4 className="font-semibold">Prezzi per periodo</h4>
                          {periods.map((period) => {
                            const isSelected = newVariantData.pricePeriods && period.id in newVariantData.pricePeriods;
                            const price = newVariantData.pricePeriods?.[period.id] ?? null;
                            
                            return (
                              <div
                                key={period.id}
                                className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex items-center space-x-2 pt-2">
                                  <Checkbox
                                    id={`new-period-${period.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      const newPricePeriods = { ...(newVariantData.pricePeriods || {}) };
                                      if (checked === true) {
                                        newPricePeriods[period.id] = null;
                                      } else {
                                        delete newPricePeriods[period.id];
                                      }
                                      setNewVariantData(prev => ({ ...prev, pricePeriods: newPricePeriods }));
                                    }}
                                  />
                                  <Label
                                    htmlFor={`new-period-${period.id}`}
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
                                    <Label htmlFor={`new-price-${period.id}`} className="text-xs text-muted-foreground">
                                      Prezzo (€)
                                    </Label>
                                    <Input
                                      type="number"
                                      id={`new-price-${period.id}`}
                                      step="0.01"
                                      min="0"
                                      value={price === null || price === undefined ? "" : price}
                                      onChange={(e) => {
                                        const newPricePeriods = { ...(newVariantData.pricePeriods || {}) };
                                        newPricePeriods[period.id] = e.target.value === "" ? null : Number(e.target.value);
                                        setNewVariantData(prev => ({ ...prev, pricePeriods: newPricePeriods }));
                                      }}
                                      placeholder="0.00"
                                      className="mt-1"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            Nessun periodo di prezzo disponibile. Contatta l'amministratore per configurare i periodi.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Deposito</Label>
                          <Input
                            type="number"
                            value={newVariantData.deposit}
                            onChange={(e) => setNewVariantData(prev => ({ ...prev, deposit: e.target.value }))}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Stock</Label>
                          <Input
                            type="number"
                            value={newVariantData.stock}
                            onChange={(e) => setNewVariantData(prev => ({ ...prev, stock: e.target.value }))}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCreateVariant}
                          className="bg-[#3fafa3] hover:bg-[#3fafa3] text-white"
                        >
                          Crea variante
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowNewVariantForm(false);
                            setSelectedAttributes({});
                            setNewVariantData({
                              pricePeriods: {},
                              deposit: '',
                              stock: '',
                              is_active: true,
                            });
                          }}
                        >
                          Annulla
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Varianti esistenti</h3>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="variant-filter" className="text-sm">Filtra:</Label>
                      <Select value={variantFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setVariantFilter(value)}>
                        <SelectTrigger id="variant-filter" className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutte</SelectItem>
                          <SelectItem value="active">Solo attive</SelectItem>
                          <SelectItem value="inactive">Solo disattivate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {filteredVariants.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      {variants.length === 0 
                        ? 'Nessuna variante creata' 
                        : variantFilter === 'active' 
                          ? 'Nessuna variante attiva' 
                          : variantFilter === 'inactive'
                            ? 'Nessuna variante disattivata'
                            : 'Nessuna variante trovata'}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {filteredVariants.map(variant => (
                        <Card key={variant.id}>
                          <CardContent className="pt-6">
                            {editingVariant === variant.id ? (
                              <div className="space-y-4">
                                <div className="mb-4">
                                  <h4 className="font-semibold mb-3">Modifica attributi</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {attributes.map(attr => {
                                      const selectedValue = attributeValues[attr.id]?.find(v => v.id === selectedAttributes[attr.id]);
                                      return (
                                        <div key={attr.id}>
                                          <Label>{attr.name} {attr.unit && `(${attr.unit})`} *</Label>
                                          <AttributeValueCombobox
                                            attributeId={attr.id}
                                            value={selectedAttributes[attr.id] || ''}
                                            displayValue={selectedValue?.value}
                                            onSelect={(id, value) => {
                                              setSelectedAttributes(prev => ({ ...prev, [attr.id]: id }));
                                              // Aggiorna anche la lista locale dei valori se è un nuovo valore
                                              if (!attributeValues[attr.id]?.find(v => v.id === id)) {
                                                setAttributeValues(prev => ({
                                                  ...prev,
                                                  [attr.id]: [...(prev[attr.id] || []), { id, value, id_product_attribute: attr.id }]
                                                }));
                                              }
                                            }}
                                            placeholder={`Seleziona ${attr.name}`}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                {/* Sezione Prezzi - Periodi dinamici */}
                                {loadingPeriods ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-sm text-muted-foreground">Caricamento periodi...</span>
                                  </div>
                                ) : periods && periods.length > 0 ? (
                                  <div className="space-y-4">
                                    <h4 className="font-semibold">Prezzi per periodo</h4>
                                    {periods.map((period) => {
                                      const isSelected = editVariantData.pricePeriods && period.id in editVariantData.pricePeriods;
                                      const price = editVariantData.pricePeriods?.[period.id] ?? null;
                                      
                                      return (
                                        <div
                                          key={period.id}
                                          className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                                        >
                                          <div className="flex items-center space-x-2 pt-2">
                                            <Checkbox
                                              id={`edit-period-${period.id}-${variant.id}`}
                                              checked={isSelected}
                                              onCheckedChange={(checked) => {
                                                const newPricePeriods = { ...(editVariantData.pricePeriods || {}) };
                                                if (checked === true) {
                                                  newPricePeriods[period.id] = null;
                                                } else {
                                                  delete newPricePeriods[period.id];
                                                }
                                                setEditVariantData(prev => ({ ...prev, pricePeriods: newPricePeriods }));
                                              }}
                                            />
                                            <Label
                                              htmlFor={`edit-period-${period.id}-${variant.id}`}
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
                                              <Label htmlFor={`edit-price-${period.id}-${variant.id}`} className="text-xs text-muted-foreground">
                                                Prezzo (€)
                                              </Label>
                                              <Input
                                                type="number"
                                                id={`edit-price-${period.id}-${variant.id}`}
                                                step="0.01"
                                                min="0"
                                                value={price === null || price === undefined ? "" : price}
                                                onChange={(e) => {
                                                  const newPricePeriods = { ...(editVariantData.pricePeriods || {}) };
                                                  newPricePeriods[period.id] = e.target.value === "" ? null : Number(e.target.value);
                                                  setEditVariantData(prev => ({ ...prev, pricePeriods: newPricePeriods }));
                                                }}
                                                placeholder="0.00"
                                                className="mt-1"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-800">
                                      Nessun periodo di prezzo disponibile. Contatta l'amministratore per configurare i periodi.
                                    </p>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                  <div>
                                    <Label>Deposito</Label>
                                    <Input
                                      type="number"
                                      value={editVariantData.deposit}
                                      onChange={(e) => setEditVariantData(prev => ({ ...prev, deposit: e.target.value }))}
                                      placeholder="0.00"
                                    />
                                  </div>
                                  <div>
                                    <Label>Stock noleggiabile</Label>
                                    <Input
                                      type="text"
                                      value={variantStockCounts[variant.id]?.rentable || 0}
                                      readOnly
                                      className="bg-gray-100 cursor-not-allowed"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleSaveVariant(variant.id)}
                                    className="bg-[#3fafa3] hover:bg-[#3fafa3] text-white"
                                  >
                                    <Save className="w-4 h-4 mr-2" />
                                    Salva modifiche
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                  >
                                    <X className="w-4 h-4 mr-2" />
                                    Annulla
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold mb-2">{getVariantDisplayName(variant)}</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    {variant.pricePeriods && Object.keys(variant.pricePeriods).length > 0 && periods && (
                                      <>
                                        {Object.entries(variant.pricePeriods).map(([periodId, price]) => {
                                          if (!price || price === null) return null;
                                          const period = periods.find(p => p.id === periodId);
                                          if (!period) return null;
                                          return (
                                            <div key={periodId}>
                                              <span className="text-gray-500">{period.name}:</span>
                                              <span className="ml-2 font-medium">€{Number(price).toFixed(2)}</span>
                                            </div>
                                          );
                                        })}
                                      </>
                                    )}
                                    {variant.deposit && (
                                      <div>
                                        <span className="text-gray-500">Deposito:</span>
                                        <span className="ml-2 font-medium">€{variant.deposit}</span>
                                      </div>
                                    )}
                                    {(() => {
                                      const stockCounts = variantStockCounts[variant.id] || { rentable: 0, maintenance: 0, nonRentable: 0 };
                                      return (
                                        <>
                                    <div>
                                            <span className="text-gray-500">Stock noleggiabile:</span>
                                            <span className="ml-2 font-medium text-green-600">{stockCounts.rentable}</span>
                                    </div>
                                          <div>
                                            <span className="text-gray-500">Stock in manutenzione:</span>
                                            <span className="ml-2 font-medium text-orange-600">{stockCounts.maintenance}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Stock non noleggiabile:</span>
                                            <span className="ml-2 font-medium text-red-600">{stockCounts.nonRentable}</span>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEditVariant(variant)}
                                    className="text-blue-600 hover:text-blue-700"
                                    title="Modifica"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteVariant(variant.id)}
                                    className="text-orange-600 hover:text-orange-700"
                                    title="Disabilita"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <AdminFooter />
    </div>
  );
}

