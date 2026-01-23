import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Plus, Ban, Loader2, Edit, Save, X, Warehouse, Filter, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Variant {
  id: string;
  id_product: string;
  attributeValues: { [key: string]: string };
  displayName: string;
}

interface ProductUnit {
  id: string;
  id_product_variant: string;
  serial_number: string;
  id_product_status: string;
  id_product_condition: string;
  status_name?: string;
  condition_name?: string;
}

interface ProductStatus {
  id: string;
  name: string;
}

interface ProductCondition {
  id: string;
  name: string;
}

interface ProductAttribute {
  id: string;
  name: string;
  unit: string | null;
}

interface AttributeValue {
  id: string;
  value: string;
  id_product_attribute: string;
}

export default function ProductStock() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [allVariants, setAllVariants] = useState<Variant[]>([]); // Tutte le varianti
  const [filteredVariants, setFilteredVariants] = useState<Variant[]>([]); // Varianti filtrate
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<{ [key: string]: AttributeValue[] }>({});
  const [availableAttributeValues, setAvailableAttributeValues] = useState<{ [key: string]: AttributeValue[] }>({}); // Solo valori presenti nelle varianti
  const [filterAttributes, setFilterAttributes] = useState<{ [key: string]: string }>({}); // attribute_id -> value_id
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [statuses, setStatuses] = useState<ProductStatus[]>([]);
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [showNewUnitForm, setShowNewUnitForm] = useState<string | null>(null); // variantId
  const [editingUnit, setEditingUnit] = useState<string | null>(null); // unitId
  const [unitsToAdd, setUnitsToAdd] = useState<string>('1'); // Numero di unità da aggiungere (come stringa per permettere input vuoto)
  const [newUnitData, setNewUnitData] = useState({
    serial_number: '',
    id_product_status: '',
    id_product_condition: '',
  });
  const [editUnitData, setEditUnitData] = useState({
    serial_number: '',
    id_product_status: '',
    id_product_condition: '',
  });
  const [serialSearch, setSerialSearch] = useState<string>(''); // Ricerca per serial number
  const [statusFilter, setStatusFilter] = useState<string>(''); // Filtro per stato (id dello stato o '' per tutti)
  const [showDeleteUnitsDialog, setShowDeleteUnitsDialog] = useState<string | null>(null); // variantId per cui eliminare unità
  const [unitsToDelete, setUnitsToDelete] = useState<string>(''); // Numero di unità da eliminare (vuoto = tutte)
  const [isDeletingUnits, setIsDeletingUnits] = useState(false); // Stato di caricamento durante eliminazione

  useEffect(() => {
    if (!productId) return;
    loadData();
  }, [productId]);

  const loadData = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      // Carica il prodotto
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

      // Carica gli status
      const { data: statusesData, error: statusesError } = await supabase
        .from('product_unit_status')
        .select('*')
        .order('name');

      if (statusesError) throw statusesError;
      setStatuses(statusesData || []);

      // Carica le condizioni
      const { data: conditionsData, error: conditionsError } = await supabase
        .from('product_unit_conditions')
        .select('*')
        .order('name');

      if (conditionsError) throw conditionsError;
      setConditions(conditionsData || []);

      // Carica gli attributi e i loro valori (solo se has_variants = true)
      if (productData.has_variants) {
        await loadAttributes(productData.id_product_subcategory);
      }

      // Carica le varianti con attributi
      await loadVariants(productId, productData.has_variants);
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

  const loadAttributes = async (subcategoryId: string) => {
    if (!subcategoryId) return;

    try {
      // Carica gli attributi variabili per la sottocategoria
      const { data: allowedAttrs, error: attrsError } = await supabase
        .from('allowed_subcategories_attributes')
        .select(`
          id_product_attribute,
          is_variable,
          product_attributes!inner(id, name, unit)
        `)
        .eq('id_product_subcategory', subcategoryId)
        .eq('is_variable', true);

      if (attrsError) throw attrsError;

      const attrs = (allowedAttrs || []).map((a: any) => ({
        id: a.product_attributes.id,
        name: a.product_attributes.name,
        unit: a.product_attributes.unit,
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
    } catch (error) {
      console.error('Errore nel caricamento attributi:', error);
    }
  };

  const loadVariants = async (prodId: string, hasVariants: boolean) => {
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
              id_product_attribute,
              product_attributes!inner(id, name, unit)
            )
          )
        `)
        .eq('id_product', prodId);

      if (variantsError) throw variantsError;

      const mappedVariants = (variantsData || []).map((v: any) => {
        const attrValues: { [key: string]: string } = {};
        const displayParts: string[] = [];
        
        (v.product_variant_attribute_values || []).forEach((pvav: any) => {
          if (pvav.product_attributes_values) {
            const attrValue = pvav.product_attributes_values;
            const attrId = attrValue.id_product_attribute;
            attrValues[attrId] = attrValue.id;
            const attrName = attrValue.product_attributes?.name || '';
            const unit = attrValue.product_attributes?.unit || '';
            displayParts.push(`${attrName}: ${attrValue.value}${unit ? ` ${unit}` : ''}`);
          }
        });

        return {
          id: v.id,
          id_product: v.id_product,
          attributeValues: attrValues,
          displayName: displayParts.length > 0 ? displayParts.join(' | ') : 'Variante di default',
        };
      });

      // Se has_variants = false, mostra tutte le varianti (anche senza attributi)
      // Se has_variants = true, filtra solo quelle con attributi
      let variantsToShow = mappedVariants;
      if (hasVariants) {
        variantsToShow = mappedVariants.filter(variant => 
          Object.keys(variant.attributeValues).length > 0
        );
      }

      // Se has_variants = false e non ci sono varianti, crea una variante di default
      if (!hasVariants && variantsToShow.length === 0) {
        // I prezzi non sono più nella tabella product_variants, sono in product_variant_price_list
        const { data: newVariant, error: createError } = await supabase
          .from('product_variants')
          .insert({
            id_product: prodId,
            is_active: true,
          })
          .select('id, id_product, is_active, deposit, images, created_at, updated_at')
          .single();

        if (!createError && newVariant) {
          variantsToShow = [{
            id: newVariant.id,
            id_product: newVariant.id_product,
            attributeValues: {},
            displayName: 'Variante di default',
          }];
        }
      }

      setAllVariants(variantsToShow);
      setFilteredVariants(variantsToShow);
    } catch (error) {
      console.error('Errore nel caricamento varianti:', error);
    }
  };

  const loadUnits = async () => {
    try {
      const variantIds = filteredVariants.map(v => v.id);
      
      if (variantIds.length === 0) {
        setUnits([]);
        return;
      }

      const { data: unitsData, error: unitsError } = await supabase
        .from('product_units')
        .select(`
          *,
          product_unit_status(id, name),
          product_unit_conditions(id, name)
        `)
        .in('id_product_variant', variantIds);

      if (unitsError) throw unitsError;

      const mappedUnits = (unitsData || []).map((u: any) => ({
        id: u.id,
        id_product_variant: u.id_product_variant,
        serial_number: u.serial_number,
        id_product_status: u.id_product_status,
        id_product_condition: u.id_product_condition,
        status_name: u.product_unit_status?.name || '',
        condition_name: u.product_unit_conditions?.name || '',
      }));

      setUnits(mappedUnits);
    } catch (error) {
      console.error('Errore nel caricamento unità:', error);
    }
  };

  // Calcola i valori disponibili per ogni attributo basandosi sulle varianti
  useEffect(() => {
    if (attributes.length === 0 || allVariants.length === 0) {
      setAvailableAttributeValues({});
      return;
    }
    
    const available: { [attributeId: string]: AttributeValue[] } = {};
    
    // Per ogni attributo, trova i valori disponibili nelle varianti compatibili
    for (const attr of attributes) {
      const valueIds = new Set<string>();
      
      // Trova tutti i value_id disponibili per questo attributo nelle varianti compatibili
      allVariants.forEach(variant => {
        const valueId = variant.attributeValues[attr.id];
        if (valueId) {
          // Verifica se questa variante è compatibile con tutte le selezioni attuali
          let isCompatible = true;
          Object.keys(filterAttributes).forEach(selectedAttrId => {
            if (selectedAttrId !== attr.id && filterAttributes[selectedAttrId]) {
              if (variant.attributeValues[selectedAttrId] !== filterAttributes[selectedAttrId]) {
                isCompatible = false;
              }
            }
          });
          
          if (isCompatible) {
            valueIds.add(valueId);
          }
        }
      });
      
      // Carica tutti i valori per questo attributo e filtra quelli disponibili
      if (valueIds.size > 0) {
        const allValues = attributeValues[attr.id] || [];
        available[attr.id] = allValues.filter(val => valueIds.has(val.id));
      } else {
        available[attr.id] = [];
      }
    }
    
    setAvailableAttributeValues(available);
  }, [attributes, allVariants, filterAttributes, attributeValues]);

  // Filtra le varianti in base ai filtri selezionati
  useEffect(() => {
    let filtered = [...allVariants];

    // Applica i filtri
    Object.entries(filterAttributes).forEach(([attrId, valueId]) => {
      if (valueId) {
        filtered = filtered.filter(variant => 
          variant.attributeValues[attrId] === valueId
        );
      }
    });

    setFilteredVariants(filtered);
  }, [filterAttributes, allVariants]);

  // Ricarica le unità quando cambiano le varianti filtrate
  useEffect(() => {
    if (filteredVariants.length > 0) {
      loadUnits();
    } else {
      setUnits([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVariants]);

  const handleCreateUnits = async (variantId: string) => {
    const quantity = parseInt(unitsToAdd, 10);
    if (!unitsToAdd || isNaN(quantity) || quantity < 1) {
      toast({
        title: 'Errore',
        description: 'Inserisci un numero valido di unità da aggiungere',
        variant: 'destructive',
      });
      return;
    }

    // ID predefiniti per stato e condizione
    const defaultStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b'; // Noleggiabile
    const defaultConditionId = 'e915cf03-8bec-4cad-9ed0-9798d8670af6'; // Usato - Ottimo stato

    try {
      // Crea un array di unità da inserire
      const unitsToInsert = Array.from({ length: quantity }, () => ({
        id_product_variant: variantId,
        serial_number: null,
        id_product_status: defaultStatusId,
        id_product_condition: defaultConditionId,
      }));

      const { error } = await supabase
        .from('product_units')
        .insert(unitsToInsert);

      if (error) throw error;

      toast({
        title: 'Successo',
        description: `${quantity} unità ${quantity === 1 ? 'creata' : 'create'} con successo`,
      });

      setUnitsToAdd('1');
      setShowNewUnitForm(null);
      await loadUnits();
      // Lo stock viene ora calcolato dinamicamente contando le product_units
    } catch (error: any) {
      console.error('Errore nella creazione unità:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile creare le unità',
        variant: 'destructive',
      });
    }
  };

  const handleEditUnit = (unit: ProductUnit) => {
    setEditingUnit(unit.id);
    setEditUnitData({
      serial_number: unit.serial_number,
      id_product_status: unit.id_product_status,
      id_product_condition: unit.id_product_condition,
    });
  };

  const handleSaveUnit = async (unitId: string) => {
    if (!editUnitData.id_product_status || !editUnitData.id_product_condition) {
      toast({
        title: 'Errore',
        description: 'Compila tutti i campi obbligatori',
        variant: 'destructive',
      });
      return;
    }

    // Se il serial number è fornito, verifica che sia unico (escludendo l'unità corrente)
    if (editUnitData.serial_number && editUnitData.serial_number.trim() !== '') {
      const { data: existingUnit, error: checkError } = await supabase
        .from('product_units')
        .select('id')
        .eq('serial_number', editUnitData.serial_number.trim())
        .neq('id', unitId)
        .maybeSingle();

      if (checkError) {
        toast({
          title: 'Errore',
          description: 'Errore nel controllo del serial number',
          variant: 'destructive',
        });
        return;
      }

      if (existingUnit) {
        toast({
          title: 'Errore',
          description: 'Il numero di serie è già utilizzato da un\'altra unità',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('product_units')
        .update({
          serial_number: editUnitData.serial_number && editUnitData.serial_number.trim() !== '' ? editUnitData.serial_number.trim() : null,
          id_product_status: editUnitData.id_product_status,
          id_product_condition: editUnitData.id_product_condition,
        })
        .eq('id', unitId);

      if (error) throw error;

      toast({
        title: 'Successo',
        description: 'Unità aggiornata con successo',
      });

      setEditingUnit(null);
      await loadUnits();
      // Lo stock viene ora calcolato dinamicamente contando le product_units
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento unità:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile aggiornare l\'unità',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!window.confirm('Sei sicuro di voler contrassegnare questa unità come non noleggiabile?')) return;

    // ID dello stato "Non noleggiabile"
    const nonRentableStatusId = '1c971f6d-5a0c-4d48-9f12-1f7eaa3ccf43';

    try {
      const { error } = await supabase
        .from('product_units')
        .update({
          id_product_status: nonRentableStatusId,
        })
        .eq('id', unitId);

      if (error) throw error;

      toast({
        title: 'Successo',
        description: 'Unità contrassegnata come non noleggiabile',
      });

      await loadUnits();
      // Lo stock viene ora calcolato dinamicamente contando le product_units
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento unità:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile aggiornare l\'unità',
        variant: 'destructive',
      });
    }
  };

  const getUnitsForVariant = (variantId: string) => {
    let filtered = units.filter(u => u.id_product_variant === variantId);
    
    // Filtra per serial number se presente
    if (serialSearch.trim() !== '') {
      const searchLower = serialSearch.toLowerCase().trim();
      filtered = filtered.filter(u => 
        u.serial_number && u.serial_number.toLowerCase().includes(searchLower)
      );
    }
    
    // Filtra per stato se selezionato
    if (statusFilter !== '') {
      filtered = filtered.filter(u => u.id_product_status === statusFilter);
    }
    
    return filtered;
  };

  const clearFilters = () => {
    setFilterAttributes({});
  };

  const handleDeleteUnits = async (variantId: string) => {
    if (!variantId) return;
    
    setIsDeletingUnits(true);
    try {
      // ID dello stato "Non noleggiabile"
      const nonRentableStatusId = '1c971f6d-5a0c-4d48-9f12-1f7eaa3ccf43';
      
      // Recupera tutte le unità della variante specifica (solo quelle che non sono già non noleggiabili)
      const { data: allUnits, error: unitsError } = await supabase
        .from('product_units')
        .select('id')
        .eq('id_product_variant', variantId)
        .neq('id_product_status', nonRentableStatusId); // Escludi quelle già non noleggiabili
      
      if (unitsError) throw unitsError;
      if (!allUnits || allUnits.length === 0) {
        toast({
          title: 'Info',
          description: 'Nessuna unità noleggiabile trovata per questa variante',
        });
        setIsDeletingUnits(false);
        setShowDeleteUnitsDialog(null);
        return;
      }

      let unitsToMarkList = allUnits;
      
      // Se è stato inserito un numero, contrassegna solo quel numero di unità
      if (unitsToDelete.trim() !== '') {
        const numToMark = parseInt(unitsToDelete.trim());
        if (isNaN(numToMark) || numToMark <= 0) {
          toast({
            title: 'Errore',
            description: 'Inserisci un numero valido maggiore di zero',
            variant: 'destructive',
          });
          setIsDeletingUnits(false);
          return;
        }
        
        if (numToMark > allUnits.length) {
          toast({
            title: 'Errore',
            description: `Il numero inserito (${numToMark}) è maggiore del numero totale di unità noleggiabili (${allUnits.length})`,
            variant: 'destructive',
          });
          setIsDeletingUnits(false);
          return;
        }
        
        // Prendi solo le prime N unità
        unitsToMarkList = allUnits.slice(0, numToMark);
      }

      // Contrassegna le unità selezionate come "Non noleggiabili"
      const unitIdsToMark = unitsToMarkList.map(u => u.id);
      const { error: updateError } = await supabase
        .from('product_units')
        .update({ id_product_status: nonRentableStatusId })
        .in('id', unitIdsToMark);
      
      if (updateError) throw updateError;

      toast({
        title: 'Successo',
        description: `${unitIdsToMark.length} unità contrassegnate come non noleggiabili`,
      });

      setShowDeleteUnitsDialog(null);
      setUnitsToDelete('');
      await loadUnits();
    } catch (error: any) {
      console.error('Errore nel contrassegnare unità come non noleggiabili:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile contrassegnare le unità come non noleggiabili',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingUnits(false);
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
            Gestione Stock - {product.name}
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
            {allVariants.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Nessuna variante disponibile per questo prodotto.</p>
                <p className="text-sm mt-2">Crea prima le varianti nella pagina di gestione varianti.</p>
              </div>
            ) : (
              <>
                {/* Sezione filtri - mostra solo se has_variants = true e ci sono più varianti */}
                {product?.has_variants && allVariants.length > 1 && attributes.length > 0 && (
                  <Card className="mb-6 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filtra varianti per attributi
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {attributes.map(attr => {
                          const values = availableAttributeValues[attr.id] || [];
                          return (
                            <div key={attr.id}>
                              <Label>{attr.name} {attr.unit && `(${attr.unit})`}</Label>
                              <Select
                                value={filterAttributes[attr.id] || ''}
                                onValueChange={(value) => {
                                  setFilterAttributes(prev => ({ 
                                    ...prev, 
                                    [attr.id]: value === 'all' ? '' : value 
                                  }));
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Tutti i ${attr.name.toLowerCase()}`} />
                                </SelectTrigger>
                                <SelectContent side="bottom" className="max-h-[200px]">
                                  <SelectItem value="all">
                                    Tutti i {attr.name.toLowerCase()}
                                  </SelectItem>
                                  {values.map(value => (
                                    <SelectItem key={value.id} value={value.id}>
                                      {value.value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                      {Object.keys(filterAttributes).some(key => filterAttributes[key]) && (
                        <div className="mt-4">
                          <Button
                            variant="outline"
                            onClick={clearFilters}
                            size="sm"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Rimuovi filtri
                          </Button>
                        </div>
                      )}
                      {filteredVariants.length !== allVariants.length && (
                        <p className="text-sm text-gray-600 mt-2">
                          Mostrando {filteredVariants.length} di {allVariants.length} varianti
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Lista varianti filtrate */}
                {filteredVariants.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nessuna variante corrisponde ai filtri selezionati.</p>
                    {allVariants.length > 1 && (
                      <Button
                        variant="outline"
                        onClick={clearFilters}
                        className="mt-4"
                      >
                        Rimuovi filtri
                      </Button>
                    )}
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full space-y-4">
                    {filteredVariants.map(variant => {
                      const variantUnits = getUnitsForVariant(variant.id);
                      const allVariantUnits = units.filter(u => u.id_product_variant === variant.id);
                      const hasActiveFilters = serialSearch.trim() !== '' || statusFilter !== '';
                      return (
                        <AccordionItem key={variant.id} value={variant.id} className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="text-left">
                                <h3 className="text-lg font-semibold">{variant.displayName}</h3>
                                <p className="text-sm text-gray-500">
                                  {hasActiveFilters 
                                    ? `${variantUnits.length} di ${allVariantUnits.length} unità in magazzino`
                                    : `${variantUnits.length} unità in magazzino`
                                  }
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pt-4 pb-2">
                            {/* Filtri per unità */}
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <Label className="flex items-center gap-2">
                                    <Search className="w-4 h-4" />
                                    Cerca per numero di serie
                                  </Label>
                                  <Input
                                    type="text"
                                    value={serialSearch}
                                    onChange={(e) => setSerialSearch(e.target.value)}
                                    placeholder="Inserisci il numero di serie..."
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label>Filtra per stato</Label>
                                  <Select
                                    value={statusFilter}
                                    onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Tutti gli stati" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">Tutti gli stati</SelectItem>
                                      {statuses.map(status => (
                                        <SelectItem key={status.id} value={status.id}>
                                          {status.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              {(serialSearch.trim() !== '' || statusFilter !== '') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSerialSearch('');
                                    setStatusFilter('');
                                  }}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Rimuovi filtri unità
                                </Button>
                              )}
                            </div>
                        {showNewUnitForm === variant.id ? (
                          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-semibold mb-3">Aggiungi unità</h4>
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <Label>Numero di unità da aggiungere</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={unitsToAdd}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    // Permetti input vuoto durante la digitazione
                                    if (value === '') {
                                      setUnitsToAdd('');
                                    } else {
                                      const num = parseInt(value, 10);
                                      if (!isNaN(num) && num > 0) {
                                        setUnitsToAdd(value);
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Quando perde il focus, se è vuoto o invalido, imposta a 1
                                    const value = e.target.value;
                                    if (value === '' || parseInt(value, 10) < 1) {
                                      setUnitsToAdd('1');
                                    }
                                  }}
                                  placeholder="1"
                                  className="mt-1"
                                />
                                <p className="text-sm text-gray-500 mt-2">
                                  Le unità verranno create automaticamente con:
                                  <br />
                                  • Stato: Noleggiabile
                                  <br />
                                  • Condizione: Usato - Ottimo stato
                                  <br />
                                  • Serial number: vuoto
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleCreateUnits(variant.id)}
                                className="bg-[#3fafa3] hover:bg-[#3fafa3] text-white"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Aggiungi {unitsToAdd || '1'} unità
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setShowNewUnitForm(null);
                                  setUnitsToAdd('1');
                                }}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Annulla
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 mb-4">
                            <Button
                              onClick={() => {
                                setShowNewUnitForm(variant.id);
                                setUnitsToAdd('1');
                              }}
                              className="bg-[#3fafa3] hover:bg-[#3fafa3] text-white"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Aggiungi unità
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                setShowDeleteUnitsDialog(variant.id);
                                setUnitsToDelete('');
                              }}
                              className="flex items-center gap-2"
                            >
                              <Ban className="w-4 h-4" />
                              Contrassegna come Non Noleggiabili
                            </Button>
                          </div>
                        )}

                            {variantUnits.length === 0 ? (
                              <p className="text-gray-500 text-center py-4">
                                {allVariantUnits.length === 0 
                                  ? 'Nessuna unità registrata per questa variante'
                                  : (serialSearch.trim() !== '' || statusFilter !== '')
                                    ? 'Nessuna unità corrisponde ai filtri selezionati'
                                    : 'Nessuna unità registrata per questa variante'
                                }
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {variantUnits.map(unit => (
                                  <Card key={unit.id} className="bg-white">
                                    <CardContent className="pt-4">
                                      {editingUnit === unit.id ? (
                                        <div className="space-y-4">
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                              <Label>Numero di serie</Label>
                                              <Input
                                                value={editUnitData.serial_number}
                                                onChange={(e) => setEditUnitData(prev => ({ ...prev, serial_number: e.target.value }))}
                                                placeholder="Es: SN123456"
                                              />
                                            </div>
                                            <div>
                                              <Label>Stato *</Label>
                                              <Select
                                                value={editUnitData.id_product_status}
                                                onValueChange={(value) => setEditUnitData(prev => ({ ...prev, id_product_status: value }))}
                                              >
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Seleziona stato" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {statuses.map(status => (
                                                    <SelectItem key={status.id} value={status.id}>
                                                      {status.name}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div>
                                              <Label>Condizione *</Label>
                                              <Select
                                                value={editUnitData.id_product_condition}
                                                onValueChange={(value) => setEditUnitData(prev => ({ ...prev, id_product_condition: value }))}
                                              >
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Seleziona condizione" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {conditions.map(condition => (
                                                    <SelectItem key={condition.id} value={condition.id}>
                                                      {condition.name}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button
                                              onClick={() => handleSaveUnit(unit.id)}
                                              className="bg-[#3fafa3] hover:bg-[#3fafa3] text-white"
                                            >
                                              <Save className="w-4 h-4 mr-2" />
                                              Salva modifiche
                                            </Button>
                                            <Button
                                              variant="outline"
                                              onClick={() => setEditingUnit(null)}
                                            >
                                              <X className="w-4 h-4 mr-2" />
                                              Annulla
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                              <div>
                                                <span className="text-gray-500">Numero di serie:</span>
                                                <span className="ml-2 font-medium">{unit.serial_number}</span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Stato:</span>
                                                <span className="ml-2 font-medium">{unit.status_name}</span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Condizione:</span>
                                                <span className="ml-2 font-medium">{unit.condition_name}</span>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => handleEditUnit(unit)}
                                              className="text-blue-600 hover:text-blue-700"
                                              title="Modifica"
                                            >
                                              <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => handleDeleteUnit(unit.id)}
                                              className="text-orange-600 hover:text-orange-700"
                                              title="Disabilita"
                                            >
                                              <Ban className="w-4 h-4" />
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
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Dialog per eliminare unità */}
        {showDeleteUnitsDialog && (() => {
          const variantId = showDeleteUnitsDialog;
          const allVariantUnits = units.filter(u => u.id_product_variant === variantId);
          
          return (
            <Dialog open={!!showDeleteUnitsDialog} onOpenChange={(open) => {
              if (!open) {
                setShowDeleteUnitsDialog(null);
                setUnitsToDelete('');
              }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Contrassegna Unità come Non Noleggiabili</DialogTitle>
                  <DialogDescription>
                    Seleziona quante unità contrassegnare come non noleggiabili per questa variante. Lascia vuoto per contrassegnare tutte le unità noleggiabili della variante.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="unitsToDelete">Numero di unità da contrassegnare come non noleggiabili</Label>
                    <Input
                      id="unitsToDelete"
                      type="number"
                      min="1"
                      value={unitsToDelete}
                      onChange={(e) => setUnitsToDelete(e.target.value)}
                      placeholder="Lascia vuoto per contrassegnare tutte le unità noleggiabili"
                      disabled={isDeletingUnits}
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      {unitsToDelete.trim() === '' 
                        ? `Contrassegnerai tutte le ${allVariantUnits.filter(u => u.id_product_status !== '1c971f6d-5a0c-4d48-9f12-1f7eaa3ccf43').length} unità noleggiabili di questa variante come non noleggiabili`
                        : `Contrassegnerai ${unitsToDelete} unità (su ${allVariantUnits.filter(u => u.id_product_status !== '1c971f6d-5a0c-4d48-9f12-1f7eaa3ccf43').length} noleggiabili di questa variante) come non noleggiabili`
                      }
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteUnitsDialog(null);
                      setUnitsToDelete('');
                    }}
                    disabled={isDeletingUnits}
                  >
                    Annulla
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteUnits(variantId)}
                    disabled={isDeletingUnits}
                  >
                    {isDeletingUnits ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Elaborazione...
                      </>
                    ) : (
                      <>
                        <Ban className="w-4 h-4 mr-2" />
                        Contrassegna
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}
      </main>
      <AdminFooter />
    </div>
  );
}

