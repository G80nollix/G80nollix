import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon } from 'lucide-react';
import { format, differenceInDays, isWithinInterval, parseISO, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn, toItalianISOString } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Product, ProductVariant } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useShopDaysOff, isDateDisabledForStart, isDateDisabledForEnd, isDateWithEnabledBooking } from '@/hooks/useShopDaysOff';
import { calculateRentalPrice, findHourlyPricePeriodId, findPricePeriodId } from '@/lib/pricing';

interface RentalQuoteCardProps {
  product: Product;
  initialStartDate?: Date;
  initialEndDate?: Date;
  initialVariantId?: string;
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

interface VariantWithAttributes extends ProductVariant {
  attributeValues: { [attributeId: string]: string }; // attribute_id -> value_id
}

// Fasce orarie disponibili per il ritiro e riconsegna
const timeSlots = [
  { value: "08:00-09:00", label: "08:00 - 09:00", start: "08:00", end: "09:00" },
  { value: "09:00-10:00", label: "09:00 - 10:00", start: "09:00", end: "10:00" },
  { value: "10:00-11:00", label: "10:00 - 11:00", start: "10:00", end: "11:00" },
  { value: "11:00-12:00", label: "11:00 - 12:00", start: "11:00", end: "12:00" },
  { value: "12:00-13:00", label: "12:00 - 13:00", start: "12:00", end: "13:00" },
  { value: "13:00-14:00", label: "13:00 - 14:00", start: "13:00", end: "14:00" },
  { value: "14:00-15:00", label: "14:00 - 15:00", start: "14:00", end: "15:00" },
  { value: "15:00-16:00", label: "15:00 - 16:00", start: "15:00", end: "16:00" },
  { value: "16:00-17:00", label: "16:00 - 17:00", start: "16:00", end: "17:00" },
  { value: "17:00-18:00", label: "17:00 - 18:00", start: "17:00", end: "18:00" },
  { value: "18:00-19:00", label: "18:00 - 19:00", start: "18:00", end: "19:00" },
  { value: "19:00-20:00", label: "19:00 - 20:00", start: "19:00", end: "20:00" },
];

const RentalQuoteCard: React.FC<RentalQuoteCardProps> = ({ 
  product, 
  initialStartDate, 
  initialEndDate,
  initialVariantId
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Stato per l'alert dialog di chiusura negozio
  const [showClosedShopAlert, setShowClosedShopAlert] = useState(false);
  const [closedShopAlertData, setClosedShopAlertData] = useState<{ date: Date; nextDay: Date } | null>(null);
  const [closedShopWarningAcknowledged, setClosedShopWarningAcknowledged] = useState(false);
  
  // Carica le impostazioni del negozio per l'anticipo prenotazione
  const { data: shopSettings } = useQuery({
    queryKey: ['shop_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('anticipo_prenotazioneGiorni')
        .maybeSingle();
      
      if (error) {
        console.error('Error loading shop settings:', error);
        return { anticipo_prenotazioneGiorni: 0 };
      }
      
      return data || { anticipo_prenotazioneGiorni: 0 };
    },
  });
  
  const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate);
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);
  const [endCalendarMonth, setEndCalendarMonth] = useState<Date | undefined>(undefined);
  
  // State per varianti e attributi
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [variants, setVariants] = useState<VariantWithAttributes[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<{ [key: string]: string }>({}); // attribute_id -> value_id
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [availableAttributeValues, setAvailableAttributeValues] = useState<{ [key: string]: AttributeValue[] }>({});
  const [openAttributePopovers, setOpenAttributePopovers] = useState<{ [key: string]: boolean }>({});
  const [quantity, setQuantity] = useState<number>(1);

  // Update dates when initial props change - fixed implementation
  useEffect(() => {
    console.log('Initial dates received:', { initialStartDate, initialEndDate });
    if (initialStartDate && !startDate) {
      setStartDate(initialStartDate);
    }
    if (initialEndDate && !endDate) {
      setEndDate(initialEndDate);
    }
  }, [initialStartDate, initialEndDate, startDate, endDate]);


  // Carica attributi e varianti quando il prodotto ha varianti
  useEffect(() => {
    const loadVariantsAndAttributes = async () => {
      if (!product || !product.id_product_subcategory) {
        setAttributes([]);
        setVariants([]);
        return;
      }
      
      try {
        // Carica gli attributi variabili per la sottocategoria (solo se il prodotto ha varianti)
        if (product.has_variants) {
          const { data: allowedAttrs, error: attrsError } = await supabase
            .from('allowed_subcategories_attributes')
            .select(`
              id_product_attribute,
              is_variable,
              product_attributes!inner(id, name, unit)
            `)
            .eq('id_product_subcategory', product.id_product_subcategory)
            .eq('is_variable', true);
          
          if (attrsError) throw attrsError;
          
          const attrs = (allowedAttrs || []).map((a: any) => ({
            id: a.product_attributes.id,
            name: a.product_attributes.name,
            unit: a.product_attributes.unit,
          }));
          
          setAttributes(attrs);
        } else {
          // Se il prodotto non ha varianti, non carica attributi
          setAttributes([]);
        }
        
        // Carica tutte le varianti attive del prodotto (anche se has_variants = false)
        // I prezzi non sono più nella tabella product_variants, sono in product_variant_price_list
        const { data: productVariants, error: variantsError } = await supabase
          .from('product_variants')
          .select(`
            id,
            id_product,
            is_active,
            deposit,
            images,
            created_at,
            updated_at
          `)
          .eq('id_product', product.id)
          .eq('is_active', true);
        
        if (variantsError) {
          console.error('[RentalQuoteCard] Errore nel caricamento varianti:', variantsError);
          throw variantsError;
        }
        
        console.log('[RentalQuoteCard] Varianti caricate dal database:', {
          productId: product.id,
          has_variants: product.has_variants,
          variantsCount: productVariants?.length || 0,
          variants: productVariants
        });
        
        if (!productVariants || productVariants.length === 0) {
          console.warn('[RentalQuoteCard] Nessuna variante trovata per il prodotto:', {
            productId: product.id,
            has_variants: product.has_variants
          });
          setVariants([]);
          return;
        }
        
        // ID dello status "Noleggiabile" - solo queste unità possono essere prenotate
        const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b';
        
        // Conta le unità con status "Noleggiabile" per ogni variante
        const variantIds = productVariants.map((v: any) => v.id);
        const { data: productUnits, error: unitsError } = await supabase
          .from('product_units')
          .select('id, id_product_variant')
          .in('id_product_variant', variantIds)
          .eq('id_product_status', rentableStatusId);
        
        // Crea una mappa per contare le unità noleggiabili per variante
        const variantRentableUnitsCount = new Map<string, number>();
        if (!unitsError && productUnits) {
          productUnits.forEach((unit: any) => {
            const variantId = unit.id_product_variant;
            variantRentableUnitsCount.set(variantId, (variantRentableUnitsCount.get(variantId) || 0) + 1);
          });
        }
        
        // Filtra solo le varianti che hanno almeno un'unità in stato "Noleggiabile"
        // Se il prodotto non ha varianti, accetta tutte le varianti (potrebbero non avere unità associate)
        const rentableVariants = productVariants.filter((variant: any) => {
          if (product.has_variants === false) {
            // Per prodotti senza varianti, accetta tutte le varianti
            return true;
          }
          const rentableCount = variantRentableUnitsCount.get(variant.id) || 0;
          return rentableCount > 0;
        });
        
        console.log('[RentalQuoteCard] Varianti noleggiabili filtrate:', {
          totalVariants: productVariants.length,
          rentableVariants: rentableVariants.length,
          has_variants: product.has_variants,
          rentableVariantsIds: rentableVariants.map((v: any) => v.id)
        });
        
        // Carica i valori degli attributi per ogni variante noleggiabile
        const variantsWithAttrs: VariantWithAttributes[] = [];
        
        for (const variant of rentableVariants) {
          // Se il prodotto non ha varianti, non carica gli attributi (la variante non ha attributi)
          if (product.has_variants === false) {
            variantsWithAttrs.push({
              ...variant,
              attributeValues: {}, // Nessun attributo per prodotti senza varianti
            });
          } else {
            // Se il prodotto ha varianti, carica gli attributi
            const { data: variantAttrValues, error: attrValuesError } = await supabase
              .from('product_variant_attribute_values')
              .select(`
                id_product_attribute_value,
                product_attributes_values!inner(id, value, id_product_attribute)
              `)
              .eq('id_product_variant', variant.id);
            
            if (attrValuesError) continue;
            
            const attributeValues: { [key: string]: string } = {};
            (variantAttrValues || []).forEach((vav: any) => {
              const attrValue = vav.product_attributes_values;
              if (attrValue) {
                attributeValues[attrValue.id_product_attribute] = attrValue.id;
              }
            });
            
            variantsWithAttrs.push({
              ...variant,
              attributeValues,
            });
          }
        }
        
        console.log('[RentalQuoteCard] Varianti finali da settare:', {
          count: variantsWithAttrs.length,
          has_variants: product.has_variants,
          variants: variantsWithAttrs.map(v => ({ 
            id: v.id, 
            hasAttributes: Object.keys(v.attributeValues || {}).length > 0 
          }))
        });
        
        setVariants(variantsWithAttrs);
      } catch (error) {
        console.error('Errore nel caricamento varianti:', error);
        setAttributes([]);
        setVariants([]);
      }
    };
    
    loadVariantsAndAttributes();
  }, [product]);

  // Carica i valori disponibili per ogni attributo basandosi sulle varianti disponibili
  useEffect(() => {
    const loadAvailableValues = async () => {
      if (attributes.length === 0 || variants.length === 0) {
        setAvailableAttributeValues({});
        return;
      }
      
      const available: { [attributeId: string]: AttributeValue[] } = {};
      
      // Per ogni attributo, trova i valori disponibili nelle varianti compatibili
      for (const attr of attributes) {
        const valueIds = new Set<string>();
        
        // Trova tutti i value_id disponibili per questo attributo nelle varianti compatibili
        variants.forEach(variant => {
          const valueId = variant.attributeValues[attr.id];
          if (valueId) {
            // Verifica se questa variante è compatibile con tutte le selezioni attuali
            let isCompatible = true;
            Object.keys(selectedAttributes).forEach(selectedAttrId => {
              if (selectedAttrId !== attr.id && variant.attributeValues[selectedAttrId] !== selectedAttributes[selectedAttrId]) {
                isCompatible = false;
              }
            });
            
            if (isCompatible) {
              valueIds.add(valueId);
            }
          }
        });
        
        // Carica tutti i valori per questo attributo e filtra quelli disponibili
        if (valueIds.size > 0) {
          const { data: allValues } = await supabase
            .from('product_attributes_values')
            .select('*')
            .eq('id_product_attribute', attr.id);
          
          if (allValues) {
            available[attr.id] = allValues.filter(val => valueIds.has(val.id));
          }
        } else {
          available[attr.id] = [];
        }
      }
      
      setAvailableAttributeValues(available);
    };
    
    loadAvailableValues();
  }, [attributes, variants, selectedAttributes]);

  // Preseleziona la variante se initialVariantId è fornito
  useEffect(() => {
    if (initialVariantId && variants.length > 0 && attributes.length > 0 && Object.keys(selectedAttributes).length === 0) {
      const variantToSelect = variants.find(v => v.id === initialVariantId);
      if (variantToSelect) {
        // Imposta gli attributi selezionati basandosi sulla variante
        const attributesToSet: { [key: string]: string } = {};
        Object.keys(variantToSelect.attributeValues).forEach(attrId => {
          attributesToSet[attrId] = variantToSelect.attributeValues[attrId];
        });
        setSelectedAttributes(attributesToSet);
        console.log('Preselezionata variante:', {
          variantId: initialVariantId,
          attributes: attributesToSet
        });
      }
    }
  }, [initialVariantId, variants, attributes, selectedAttributes]);

  // Se il prodotto non ha varianti ma ha una variante associata, selezionala automaticamente
  useEffect(() => {
    console.log('[RentalQuoteCard] Check auto-select variant:', {
      has_variants: product.has_variants,
      variantsLength: variants.length,
      selectedVariant: selectedVariant?.id,
      productId: product.id
    });

    // Per prodotti senza varianti, seleziona sempre la prima variante disponibile
    if (product.has_variants === false) {
      if (variants.length > 0) {
        const firstVariant = variants[0];
        // Seleziona sempre la prima variante, anche se già selezionata (per assicurarsi che sia valorizzata)
        if (!selectedVariant || selectedVariant.id !== firstVariant.id) {
          console.log('[RentalQuoteCard] Selezionando automaticamente la prima variante:', firstVariant);
          setSelectedVariant(firstVariant);
          console.log('[RentalQuoteCard] Variante automaticamente selezionata per prodotto senza varianti:', {
            variantId: firstVariant.id,
            variant: firstVariant,
            productId: product.id,
            productName: product.name
          });
        }
      } else {
        console.warn('[RentalQuoteCard] Prodotto senza varianti ma nessuna variante caricata!', {
          productId: product.id,
          productName: product.name,
          has_variants: product.has_variants
        });
      }
    }
  }, [product.has_variants, variants, selectedVariant, product.id, product.name]);

  // Trova la variante corrispondente alle selezioni
  useEffect(() => {
    if (attributes.length === 0 || Object.keys(selectedAttributes).length !== attributes.length) {
      setSelectedVariant(null);
      if (attributes.length > 0) {
        console.log('Variant not selected - missing attributes:', {
          attributesLength: attributes.length,
          selectedAttributesLength: Object.keys(selectedAttributes).length,
          missingAttributes: attributes.filter(attr => !selectedAttributes[attr.id]).map(a => ({ id: a.id, name: a.name })),
          selectedAttributes,
          allAttributes: attributes.map(a => ({ id: a.id, name: a.name }))
        });
      }
      return;
    }
    
    const matchingVariant = variants.find(variant => {
      const matches = attributes.every(attr => {
        const variantValue = variant.attributeValues[attr.id];
        const selectedValue = selectedAttributes[attr.id];
        const match = variantValue === selectedValue;
        if (!match) {
          console.log('Variant mismatch for attribute:', {
            attributeId: attr.id,
            attributeName: attr.name,
            variantValue,
            selectedValue,
            variantId: variant.id
          });
        }
        return match;
      });
      return matches;
    });
    
    if (matchingVariant) {
      console.log('✅ Variant found:', {
        variantId: matchingVariant.id,
        selectedAttributes
      });
    } else {
      console.warn('❌ No matching variant found:', {
        selectedAttributes,
        variantsCount: variants.length,
        variants: variants.map(v => ({
          id: v.id,
          attributeValues: v.attributeValues
        }))
      });
    }
    
    setSelectedVariant(matchingVariant || null);
  }, [selectedAttributes, attributes, variants]);

  // Gestisce la selezione di un valore di attributo
  const handleAttributeChange = (attributeId: string, valueId: string) => {
    setSelectedAttributes(prev => {
      const newSelection = { ...prev, [attributeId]: valueId };
      
      // Verifica se la nuova selezione crea una combinazione incompatibile
      const compatibleVariants = variants.filter(variant => {
        return Object.keys(newSelection).every(attrId => {
          return variant.attributeValues[attrId] === newSelection[attrId];
        });
      });
      
      // Se non ci sono varianti compatibili con tutte le selezioni, 
      // mantieni solo le selezioni che hanno almeno una variante compatibile
      if (compatibleVariants.length === 0 && Object.keys(newSelection).length > 1) {
        const validSelection: { [key: string]: string } = { [attributeId]: valueId };
        
        // Per ogni altra selezione, verifica se esiste almeno una variante compatibile
        Object.keys(newSelection).forEach(attrId => {
          if (attrId !== attributeId) {
            const hasCompatibleVariant = variants.some(variant => {
              return variant.attributeValues[attributeId] === valueId &&
                     variant.attributeValues[attrId] === newSelection[attrId];
            });
            
            if (hasCompatibleVariant) {
              validSelection[attrId] = newSelection[attrId];
            }
          }
        });
        
        return validSelection;
      }
      
      return newSelection;
    });
  };

  // Fetch product_units count and booking_details filtered by selected variant
  const { data: productUnitsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ["product-units-and-bookings", product.id, selectedVariant?.id],
    queryFn: async () => {
      if (!product.id) return { units: [], bookingDetails: [], totalUnits: 0 };
      
      // Get product_units for the selected variant (or all variants if none selected)
      let variantIds: string[] = [];
      
      if (selectedVariant?.id) {
        // If variant is selected, use only that variant
        variantIds = [selectedVariant.id];
      } else if (product.has_variants === true) {
        // If no variant selected but product has variants, we can't determine availability
        // Return empty array to disable all dates until variant is selected
        return { units: [], bookingDetails: [], totalUnits: 0 };
      } else {
        // Product without variants - get any variant for this product
        const { data: variants, error: variantsError } = await supabase
          .from('product_variants')
          .select('id')
          .eq('id_product', product.id)
          .limit(1);
        
        if (!variantsError && variants && variants.length > 0) {
          variantIds = variants.map((v: any) => v.id);
        } else {
          return { units: [], bookingDetails: [], totalUnits: 0 };
        }
      }
      
      // ID dello stato "Noleggiabile" - solo queste unità possono essere prenotate
      const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b';
      
      // Get product_units for these variants - ONLY those with "Noleggiabile" status
      const { data: productUnits, error: unitsError } = await supabase
        .from('product_units')
        .select('id')
        .in('id_product_variant', variantIds)
        .eq('id_product_status', rentableStatusId);
      
      // If no product_units exist, return empty (no bookings to check)
      // This is OK - units will be created at booking time if stock > 0
      if (unitsError || !productUnits || productUnits.length === 0) {
        console.log('No rentable product_units found for variants:', { variantIds, unitsError });
        return { units: [], bookingDetails: [], totalUnits: 0 };
      }
      
      const unitIds = productUnits.map((u: any) => u.id);
      console.log('Found product_units:', { unitIds, count: unitIds.length });
      
      // Use secure RPC function to get booking_details dates without exposing sensitive data
      // This function only returns: id, booking_id, unit_id, start_date, end_date
      // It filters for confirmed bookings only (cart = false)
      const { data: bookingDetails, error: detailsError } = await supabase
        .rpc('get_booking_details_dates', {
          p_unit_ids: unitIds
        });
      
      if (detailsError) {
        console.error('Error fetching booking_details:', detailsError);
        return { units: unitIds, bookingDetails: [], totalUnits: unitIds.length };
      }
      
      // If no booking_details, return empty array (all dates are available)
      if (!bookingDetails || bookingDetails.length === 0) {
        console.log('No booking_details found for units:', { unitIds });
        return { units: unitIds, bookingDetails: [], totalUnits: unitIds.length };
      }
      
      // Get current user ID to check for cart bookings
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      
      // Get booking_ids from the returned booking_details
      const bookingIds = [...new Set(bookingDetails.map((d: any) => d.booking_id))];
      
      // Get cart bookings from current user to include them in unavailable dates
      // (The RPC function only returns confirmed bookings, so we need to add cart bookings from current user)
      const { data: cartBookings, error: cartBookingsError } = await supabase
        .from("bookings")
        .select("id")
        .in("id", bookingIds)
        .eq("cart", true)
        .eq("user_id", currentUserId || '');
      
      if (cartBookingsError) {
        console.error('Error fetching cart bookings:', cartBookingsError);
      }
      
      // The RPC function already filters for confirmed bookings (cart = false)
      // So all returned booking_details are from active bookings
      // We just need to add cart bookings from current user if any
      const activeDetails = bookingDetails || [];
      
      console.log('Active booking_details:', { 
        total: activeDetails.length,
        cartBookings: cartBookings?.length || 0
      });
      
      return { units: unitIds, bookingDetails: activeDetails, totalUnits: unitIds.length };
    },
    enabled: !!product.id,
  });

  const bookingDetails = productUnitsData?.bookingDetails || [];
  const actualTotalUnits = productUnitsData?.totalUnits || 0;
  
  // Fetch product variants to calculate total stock
  const { data: productWithVariants } = useQuery({
    queryKey: ['product-variants', product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          has_variants,
          product_variants(
            id,
            is_active
          )
        `)
        .eq('id', product.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!product.id,
  });
  
  // Calculate total stock based on actual product_units available, not qty_stock
  const totalStock = useMemo(() => {
    // Se abbiamo il numero effettivo di unità, usalo
    if (actualTotalUnits > 0) {
      console.log('totalStock calculated from actualTotalUnits:', { actualTotalUnits });
      return actualTotalUnits;
    }
    
    // Fallback: se non ci sono unità ma il prodotto non ha varianti, assume 1
    if (!productWithVariants) {
      const stock = product.has_variants === false ? 1 : 0;
      console.log('totalStock calculated (no productWithVariants, fallback):', { stock, has_variants: product.has_variants });
      return stock;
    }
    
    if (productWithVariants.has_variants === false) {
      console.log('totalStock calculated (no variants, fallback):', { stock: 1 });
      return 1;
    }
    
    // Se non ci sono unità e il prodotto ha varianti, return 0
    // User must select a variant first and units must exist
    console.log('totalStock calculated (no units found):', { stock: 0 });
    return 0;
  }, [actualTotalUnits, productWithVariants, product.has_variants]);

  // Prodotto da usare per i prezzi (usa variante selezionata o prodotto base)
  // I prezzi non sono più nella variante, sono in product_variant_price_list
  const displayProduct = useMemo(() => {
    if (!product) return product;
    
    if (selectedVariant && product.has_variants) {
      // Crea un prodotto con i dati della variante selezionata
      // I prezzi verranno recuperati da product_variant_price_list quando necessario
      return {
        ...product,
        deposit: selectedVariant.deposit,
      };
    }
    
    return product;
  }, [product, selectedVariant]);

  const rentalDays = useMemo(() => {
    if (startDate && endDate) {
      // Per il noleggio, includiamo anche il giorno di inizio
      // Se seleziono dal 10 al 11 agosto, sono 2 giorni (10 e 11)
      return Math.max(1, differenceInDays(endDate, startDate) + 1);
    }
    return 1;
  }, [startDate, endDate]);



  // Calculate booked units per date (count unique unit_ids per date)
  const bookedUnitsPerDate = useMemo(() => {
    const dateMap = new Map<string, Set<string>>(); // date -> Set of unit_ids
    
    if (!bookingDetails || bookingDetails.length === 0) {
      return new Map<string, number>();
    }
    
    bookingDetails.forEach((detail: any) => {
      const start = parseISO(detail.start_date);
      const end = parseISO(detail.end_date);
      const unitId = detail.unit_id;
      
      const current = new Date(start);
      while (current <= end) {
        const dateKey = toItalianISOString(current).split('T')[0];
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, new Set<string>());
        }
        dateMap.get(dateKey)!.add(unitId);
        current.setDate(current.getDate() + 1);
      }
    });
    
    // Convert Set sizes to numbers
    const result = new Map<string, number>();
    dateMap.forEach((unitIds, dateKey) => {
      result.set(dateKey, unitIds.size);
    });
    
    return result;
  }, [bookingDetails]);

  // Calcola quante unità sono completamente disponibili per l'intero periodo selezionato
  const maxAvailableUnitsForPeriod = useMemo(() => {
    if (!startDate || !endDate) {
      // Se non ci sono date, usa actualTotalUnits se disponibile, altrimenti totalStock
      return actualTotalUnits > 0 ? actualTotalUnits : totalStock;
    }

    // Usa il numero effettivo di unità se disponibile, altrimenti usa totalStock
    const baseStock = actualTotalUnits > 0 ? actualTotalUnits : totalStock;
    
    // Se baseStock è 0, mostra 0 disponibili
    if (baseStock === 0) {
      return 0;
    }

    // Trova tutte le unità che sono prenotate in almeno un giorno del periodo
    const bookedUnitIdsInPeriod = new Set<string>();
    
    if (bookingDetails && Array.isArray(bookingDetails) && bookingDetails.length > 0) {
      bookingDetails.forEach((detail: any) => {
        if (!detail.start_date || !detail.end_date || !detail.unit_id) {
          return; // Skip invalid details
        }
        
        try {
          const detailStart = parseISO(detail.start_date);
          const detailEnd = parseISO(detail.end_date);
          const unitId = String(detail.unit_id); // Ensure it's a string
          
          // Normalizza le date per il confronto (solo la parte data, senza ora)
          const detailStartDate = new Date(detailStart.getFullYear(), detailStart.getMonth(), detailStart.getDate());
          const detailEndDate = new Date(detailEnd.getFullYear(), detailEnd.getMonth(), detailEnd.getDate());
          const periodStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          const periodEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
          
          // Verifica se questa prenotazione si sovrappone al periodo selezionato
          // Due periodi si sovrappongono se: start_date <= endDate AND end_date >= startDate
          if (detailStartDate <= periodEndDate && detailEndDate >= periodStartDate) {
            bookedUnitIdsInPeriod.add(unitId);
          }
        } catch (error) {
          console.error('Error parsing booking detail dates:', error, detail);
        }
      });
    }
    
    // Il numero massimo di unità prenotabili è il totale unità meno quelle già prenotate
    const availableUnits = baseStock - bookedUnitIdsInPeriod.size;
    
    console.log('maxAvailableUnitsForPeriod calculated:', {
      actualTotalUnits,
      totalStock,
      baseStock,
      bookedUnitIdsInPeriod: bookedUnitIdsInPeriod.size,
      bookedUnitIds: Array.from(bookedUnitIdsInPeriod),
      availableUnits,
      startDate: startDate ? toItalianISOString(startDate) : undefined,
      endDate: endDate ? toItalianISOString(endDate) : undefined,
      bookingDetailsCount: bookingDetails?.length || 0
    });
    
    return Math.max(0, availableUnits);
  }, [startDate, endDate, totalStock, actualTotalUnits, bookingDetails]);

  // Carica i giorni di chiusura del negozio
  const { data: shopDaysOff = [] } = useShopDaysOff();

  const isStartDateDisabled = (date: Date) => {
    // Calcola la data minima consentita (oggi + giorni di anticipo)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const anticipoGiorni = shopSettings?.anticipo_prenotazioneGiorni || 0;
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + anticipoGiorni);
    minDate.setHours(0, 0, 0, 0);
    
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    
    // Disable dates before minimum date (today + anticipo giorni)
    if (dateToCheck < minDate) {
      console.log('Date disabled: before minimum date', { 
        date: dateToCheck, 
        minDate, 
        anticipoGiorni,
        today 
      });
      return true;
    }
    
    // Disable dates that fall within shop days off periods (per data di inizio)
    if (isDateDisabledForStart(dateToCheck, shopDaysOff)) {
      console.log('Date disabled: in shop days off period (start)', { date: dateToCheck });
      return true;
    }
    
    // If product has variants but no variant is selected, disable all dates
    if (product.has_variants === true && !selectedVariant) {
      console.log('Date disabled: no variant selected', {
        has_variants: product.has_variants,
        selectedVariant: selectedVariant,
        attributesLength: attributes.length,
        selectedAttributesLength: Object.keys(selectedAttributes).length,
        selectedAttributes
      });
      return true;
    }
    
    // If we're still loading data, allow selection (will be validated later)
    if (bookingsLoading || !productWithVariants) {
      console.log('Date check: still loading', { bookingsLoading, productWithVariants: !!productWithVariants });
      return false;
    }
    
    // Allow date selection even if stock is 0
    // Stock can be updated later, and availability will be checked at booking time
    if (totalStock === 0) {
      console.log('Date allowed: stock is 0 but allowing selection (stock can be updated)', {
        totalStock,
        has_variants: product.has_variants,
        selectedVariant: selectedVariant?.id
      });
      // Allow selection - availability will be checked at booking time
      return false;
    }
    
    // Check if all units are booked for this date
    const dateKey = toItalianISOString(dateToCheck).split('T')[0];
    const bookedUnits = bookedUnitsPerDate.get(dateKey) || 0;
    
    // Disable date if all units are booked
    if (bookedUnits >= totalStock) {
      console.log('Date disabled: all units booked', { dateKey, bookedUnits, totalStock });
      return true;
    }
    
    console.log('Date enabled:', { dateKey, bookedUnits, totalStock, available: totalStock - bookedUnits });
    return false;
  };

  const isEndDateDisabled = (date: Date) => {
    // Calcola la data minima consentita (oggi + giorni di anticipo)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const anticipoGiorni = shopSettings?.anticipo_prenotazioneGiorni || 0;
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + anticipoGiorni);
    minDate.setHours(0, 0, 0, 0);
    
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    
    // Disable dates before minimum date (today + anticipo giorni)
    if (dateToCheck < minDate) {
      console.log('Date disabled: before minimum date', { 
        date: dateToCheck, 
        minDate, 
        anticipoGiorni,
        today 
      });
      return true;
    }
    
    // Disable dates that fall within shop days off periods (per data di fine)
    // Le date con enable_booking=true POSSONO essere selezionate come data di fine
    if (isDateDisabledForEnd(dateToCheck, shopDaysOff)) {
      console.log('Date disabled: in shop days off period (end)', { date: dateToCheck });
      return true;
    }
    
    // If no start date is selected, disable all dates
    if (!startDate) {
      return true;
    }
    
    // Disable dates before start date
    if (dateToCheck < startDate) {
      return true;
    }
    
    // If product has variants but no variant is selected, disable all dates
    if (product.has_variants === true && !selectedVariant) {
      console.log('Date disabled: no variant selected', {
        has_variants: product.has_variants,
        selectedVariant: selectedVariant,
        attributesLength: attributes.length,
        selectedAttributesLength: Object.keys(selectedAttributes).length,
        selectedAttributes
      });
      return true;
    }
    
    // If we're still loading data, allow selection (will be validated later)
    if (bookingsLoading || !productWithVariants) {
      console.log('Date check: still loading', { bookingsLoading, productWithVariants: !!productWithVariants });
      return false;
    }
    
    // Allow date selection even if stock is 0
    // Stock can be updated later, and availability will be checked at booking time
    // We only disable dates if all units are booked, not if stock is 0
    if (totalStock === 0) {
      console.log('Date allowed: stock is 0 but allowing selection (stock can be updated)', {
        totalStock,
        has_variants: product.has_variants,
        selectedVariant: selectedVariant?.id
      });
      // Allow selection - availability will be checked at booking time
      return false;
    }
    
    // Check if all units are booked for this date
    const dateKey = toItalianISOString(dateToCheck).split('T')[0];
    const bookedUnits = bookedUnitsPerDate.get(dateKey) || 0;
    
    // Disable date if all units are booked
    if (bookedUnits >= totalStock) {
      console.log('Date disabled: all units booked', { dateKey, bookedUnits, totalStock });
      return true;
    }
    
    console.log('Date enabled:', { dateKey, bookedUnits, totalStock, available: totalStock - bookedUnits });
    return false;
  };

  // Check if date range has at least one unit available
  const isDateRangeAvailable = (start: Date, end: Date) => {
    // If product has variants but no variant is selected, range is not available
    if (product.has_variants === true && !selectedVariant) {
      return false;
    }
    
    // If we're still loading data, assume available (will be validated later)
    if (bookingsLoading || !productWithVariants) {
      return true;
    }
    
    // Allow selection even if stock is 0 - availability will be checked at booking time
    // We only check if all units are booked, not if stock is 0
    if (totalStock === 0) {
      // Allow selection - stock can be updated later
      return true;
    }
    
    const current = new Date(start);
    while (current <= end) {
      const dateKey = toItalianISOString(current).split('T')[0];
      const bookedUnits = bookedUnitsPerDate.get(dateKey) || 0;
      
      // If all units are booked for any day in the range, the range is not available
      // But only if totalStock > 0 (if stock is 0, we allow selection)
      if (totalStock > 0 && bookedUnits >= totalStock) {
        return false;
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return true;
  };

  // Quantità sempre impostata a 1 - nessun reset necessario
  useEffect(() => {
    setQuantity(1);
  }, [startDate, endDate]);

  // Verifica disponibilità del periodo e mostra toast se non disponibile
  useEffect(() => {
    // Mostra toast solo se entrambe le date sono selezionate, c'è stock, e i dati sono caricati
    if (startDate && endDate && totalStock > 0 && !bookingsLoading && productWithVariants) {
      const isAvailable = isDateRangeAvailable(startDate, endDate);
      if (!isAvailable) {
        toast({
          title: "Periodo non disponibile",
          description: "Il prodotto non è disponibile per tutti i giorni selezionati. Seleziona un periodo diverso per proseguire.",
          variant: "destructive",
        });
      }
    }
  }, [startDate, endDate, totalStock, bookingsLoading, productWithVariants, bookedUnitsPerDate]);

  useEffect(() => {
    console.log('startDate', startDate);
    console.log('endDate', endDate);
  }, [startDate, endDate]);

  // Orari disponibili (8-20) per prenotazioni orarie
  const hourlyTimeSlots = Array.from({ length: 12 }, (_, i) => {
    const h = i + 8;
    return { label: `${h}:00`, value: `${String(h).padStart(2, "0")}:00` };
  });
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [timeError, setTimeError] = useState<string>("");
  const [durationError, setDurationError] = useState<string>("");
  const [fullDayBooking, setFullDayBooking] = useState<boolean>(false);
  const [showAddMoreProductsDialog, setShowAddMoreProductsDialog] = useState<boolean>(false);
  const [pendingNavigationParams, setPendingNavigationParams] = useState<string | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [selectedRelatedProducts, setSelectedRelatedProducts] = useState<Set<string>>(new Set());
  const [loadingRelatedProducts, setLoadingRelatedProducts] = useState<boolean>(false);
  const [relatedProductsAvailability, setRelatedProductsAvailability] = useState<Map<string, boolean>>(new Map());
  const [relatedProductsPrices, setRelatedProductsPrices] = useState<{ [variantId: string]: number }>({});
  const isSameDayBooking = Boolean(startDate && endDate && startDate.toDateString() === endDate.toDateString());
  
  // Verifica se la variante ha sia prezzo orario che giornaliero nella product_variant_price_list
  const variantId = selectedVariant?.id || (product.has_variants === false ? variants[0]?.id : null);
  const { data: variantPricingInfo } = useQuery({
    queryKey: ['variant-pricing-info', variantId],
    queryFn: async () => {
      if (!variantId) return { hasHourly: false, hasDaily: false, hourlyPrice: null, dailyPrice: null };
      
      const hourlyPeriodId = await findHourlyPricePeriodId();
      const dailyPeriodId = await findPricePeriodId(1); // Periodo per 1 giorno
      
      const [hourlyResult, dailyResult] = await Promise.all([
        hourlyPeriodId ? supabase
          .from('product_variant_price_list')
          .select('price')
          .eq('id_product_variant', variantId)
          .eq('id_price_period', hourlyPeriodId)
          .maybeSingle() : Promise.resolve({ data: null, error: null }),
        dailyPeriodId ? supabase
          .from('product_variant_price_list')
          .select('price')
          .eq('id_product_variant', variantId)
          .eq('id_price_period', dailyPeriodId)
          .maybeSingle() : Promise.resolve({ data: null, error: null })
      ]);
      
      const hourlyPrice = hourlyResult.data?.price ? Number(hourlyResult.data.price) : null;
      const dailyPrice = dailyResult.data?.price ? Number(dailyResult.data.price) : null;
      
      return {
        hasHourly: hourlyPrice !== null && hourlyPrice > 0,
        hasDaily: dailyPrice !== null && dailyPrice > 0,
        hourlyPrice,
        dailyPrice
      };
    },
    enabled: !!variantId,
  });
  
  const hasBothPricing = variantPricingInfo?.hasHourly && variantPricingInfo?.hasDaily;
  const minDurationDays = product.min_rent_days || 0;
  const minDurationHours = product.min_rent_hours || 0;
  const canShowFullDayOption = minDurationDays === 1 && minDurationHours === 0;
  const showTimeFields = isSameDayBooking && hasBothPricing && !fullDayBooking;

  // Validazione durata minima del noleggio
  const validateDuration = () => {
    if (!startDate || !endDate) {
      setDurationError("");
      return true;
    }

    const minDurationDays = product.min_rent_days || 0;
    const minDurationHours = product.min_rent_hours || 0;

    if (isSameDayBooking && minDurationHours > 0 && !fullDayBooking) {
      // Validazione per noleggio orario - solo se entrambi gli orari sono selezionati e non è giorno intero
      if (startTime && endTime && rentalHours < minDurationHours) {
        setDurationError(`Durata minima richiesta: ${minDurationHours} ${minDurationHours === 1 ? 'ora' : 'ore'}`);
        return false;
      }
    } else if (minDurationDays > 0) {
      // Validazione per noleggio giornaliero (incluso giorno intero)
      if (rentalDays < minDurationDays) {
        setDurationError(`Durata minima richiesta: ${minDurationDays} ${minDurationDays === 1 ? 'giorno' : 'giorni'}`);
        return false;
      }
    }

    setDurationError("");
    return true;
  };

  // Calcolo delle ore di noleggio quando sono selezionati gli orari
  const rentalHours = useMemo(() => {
    if (startDate && endDate && startTime && endTime && isSameDayBooking) {
      const startHour = parseInt(startTime.split(":")[0]);
      const endHour = parseInt(endTime.split(":")[0]);
      return Math.max(1, endHour - startHour);
    }
    return 0;
  }, [startDate, endDate, startTime, endTime, isSameDayBooking]);

  // Validazione durata quando cambiano le date o gli orari
  useEffect(() => {
    validateDuration();
  }, [startDate, endDate, rentalHours, rentalDays, isSameDayBooking]);

  // Calculate pricing using new price list system
  // variantId è già definito sopra per variantPricingInfo
  
  const { data: pricingData, isLoading: pricingLoading } = useQuery({
    queryKey: ['rental-price', variantId, rentalDays, rentalHours, isSameDayBooking, fullDayBooking],
    queryFn: async () => {
      if (!variantId || !startDate || !endDate) {
        return {
          totalPrice: 0,
          hourlyPrice: 0,
          appliedDiscount: null,
          discountAmount: 0,
          originalPrice: 0,
          rentalHours: rentalHours
        };
      }

      // Se è un noleggio orario (stesso giorno con orari e non giorno intero), usa il prezzo orario
      const useHourlyPrice = rentalHours > 0 && isSameDayBooking && !fullDayBooking;
      
      let totalPrice = await calculateRentalPrice(
        variantId,
        rentalDays,
        rentalHours,
        isSameDayBooking
      );

      // Recupera il prezzo giornaliero per il breakdown e per il calcolo fallback
      let dailyPrice = 0;
      if (!useHourlyPrice) {
        const dailyPeriodId = await findPricePeriodId(1); // Periodo per 1 giorno
        
        if (dailyPeriodId) {
          const { data: dailyPriceEntry } = await supabase
            .from('product_variant_price_list')
            .select('price')
            .eq('id_product_variant', variantId)
            .eq('id_price_period', dailyPeriodId)
            .maybeSingle();
          
          if (dailyPriceEntry && dailyPriceEntry.price !== null && dailyPriceEntry.price !== undefined) {
            dailyPrice = Number(dailyPriceEntry.price);
          }
        }
        
        // Se findPricePeriodId(1) non funziona, cerca tra tutti i prezzi un periodo che corrisponde a 1 giorno
        if (dailyPrice === 0) {
          const { data: allPrices } = await supabase
            .from('product_variant_price_list')
            .select('id_price_period, price')
            .eq('id_product_variant', variantId);
          
          const { data: allPeriods } = await supabase
            .from('price_periods')
            .select('*');
          
          if (allPrices && allPeriods) {
            for (const priceEntry of allPrices) {
              if (!priceEntry.price) continue;
              
              const period = allPeriods.find((p: any) => p.id === priceEntry.id_price_period);
              if (!period) continue;
              
              // Cerca campi che potrebbero rappresentare giorni
              const possibleFields = ['days', 'day', 'num_days', 'duration_days', 'min_days', 'days_from', 'start_days'];
              for (const field of possibleFields) {
                if (field in period && typeof period[field] === 'number' && period[field] === 1) {
                  dailyPrice = Number(priceEntry.price);
                  break;
                }
              }
              if (dailyPrice > 0) break;
            }
          }
        }
        
        // Se abbiamo trovato il prezzo giornaliero, verifica se il prezzo restituito
        // corrisponde al prezzo giornaliero (non moltiplicato) e, in quel caso, moltiplicalo per i giorni
        if (dailyPrice > 0 && rentalDays > 1) {
          const expectedPrice = dailyPrice * rentalDays;
          
          // Verifica se il prezzo restituito è uguale o molto vicino al prezzo giornaliero
          // (con una tolleranza per arrotondamenti)
          const priceDifference = Math.abs(totalPrice - dailyPrice);
          const isDailyPriceOnly = priceDifference < 0.01;
          
          // Se il prezzo è 0, molto basso, corrisponde al prezzo giornaliero, o è molto più basso di quello atteso,
          // calcola il prezzo moltiplicando il prezzo giornaliero per i giorni
          if (totalPrice === 0 || totalPrice < 1 || isDailyPriceOnly || totalPrice < expectedPrice * 0.8) {
            const previousPrice = totalPrice;
            totalPrice = dailyPrice * rentalDays;
            console.log('[RentalQuoteCard] Calcolato prezzo usando prezzo giornaliero:', {
              previousPrice,
              dailyPrice,
              rentalDays,
              totalPrice,
              expectedPrice,
              isDailyPriceOnly,
              reason: previousPrice === 0 ? 'prezzo zero' : 
                      previousPrice < 1 ? 'prezzo troppo basso' : 
                      isDailyPriceOnly ? 'prezzo corrisponde al giornaliero' :
                      'prezzo molto più basso di quello atteso'
            });
          }
        }
      }

      // Recupera il prezzo orario dalla tabella se necessario per il breakdown
      let hourlyPrice = 0;
      if (useHourlyPrice) {
        const hourlyPeriodId = await findHourlyPricePeriodId();
        if (hourlyPeriodId) {
          const { data: hourlyPriceEntry } = await supabase
            .from('product_variant_price_list')
            .select('price')
            .eq('id_product_variant', variantId)
            .eq('id_price_period', hourlyPeriodId)
            .maybeSingle();
          hourlyPrice = hourlyPriceEntry?.price ? Number(hourlyPriceEntry.price) : 0;
        }
      }

      return {
        dailyPrice: dailyPrice, // Prezzo giornaliero per il breakdown
        totalPrice,
        hourlyPrice: hourlyPrice,
        appliedDiscount: null, // Non più necessario con il nuovo sistema
        discountAmount: 0, // Non più necessario con il nuovo sistema
        originalPrice: totalPrice, // Il prezzo dalla price list è già il prezzo finale
        rentalHours: rentalHours
      };
    },
    enabled: !!variantId && !!startDate && !!endDate,
  });

  const pricingBreakdown = pricingData || {
    totalPrice: 0,
    hourlyPrice: 0,
    appliedDiscount: null,
    discountAmount: 0,
    originalPrice: 0,
    rentalHours: rentalHours
  };

  // Helper per settare solo l'orario su una data
  function setTimeOnDate(date: Date, time: string): Date {
    const [hours, minutes] = time.split(":").map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  }

  // Funzione per validare gli orari
  const validateTimes = () => {
    // Se è selezionato il flag "giorno intero", non serve validare gli orari
    if (fullDayBooking) {
      setTimeError("");
      return true;
    }
    
    // Valida solo se entrambi gli orari sono valorizzati
    if (startTime && endTime) {
      const startHour = parseInt(startTime.split(":")[0]);
      const endHour = parseInt(endTime.split(":")[0]);
      
      if (endHour <= startHour) {
        setTimeError("L'orario di fine deve essere successivo all'orario di inizio");
        return false;
      }
    }
    setTimeError("");
    return true;
  };

  const handleBookNow = async () => {
    console.log('[RentalQuoteCard] 🚀 handleBookNow chiamata - Aggiungi al carrello cliccato');
    
    // Validazioni comuni (sia per utenti loggati che non loggati)
    console.log('[RentalQuoteCard] 🔍 Validazione orari...');
    if (!validateTimes()) {
      console.log('[RentalQuoteCard] ❌ Validazione orari fallita');
      return;
    }
    console.log('[RentalQuoteCard] ✅ Validazione orari OK');
    
    console.log('[RentalQuoteCard] 🔍 Validazione durata...');
    if (!validateDuration()) {
      console.log('[RentalQuoteCard] ❌ Validazione durata fallita');
      return;
    }
    console.log('[RentalQuoteCard] ✅ Validazione durata OK');
    
    // Check if we have all required data
    if (!startDate || !endDate || !product) {
      toast({
        title: "Errore",
        description: "Dati mancanti per la prenotazione",
        variant: "destructive",
      });
      return;
    }
    
    // Assicurati che la variante sia sempre valorizzata
    let variantIdToUse = selectedVariant?.id;
    if (!variantIdToUse && variants.length > 0) {
      variantIdToUse = variants[0].id;
    }
    
    // Se il prodotto ha varianti, verifica che una variante sia selezionata
    if (product.has_variants && !variantIdToUse) {
      toast({
        title: "Errore",
        description: "Seleziona tutte le opzioni del prodotto prima di aggiungere al carrello",
        variant: "destructive",
      });
      return;
    }
    
    // Verifica disponibilità del periodo selezionato
    if (startDate && endDate && totalStock > 0 && !bookingsLoading) {
      const isPeriodAvailable = isDateRangeAvailable(startDate, endDate);
      if (!isPeriodAvailable) {
        toast({
          title: "Periodo non disponibile",
          description: "Il prodotto non è disponibile per tutti i giorni selezionati. Seleziona un periodo diverso per proseguire.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Check if user is logged in
    if (!user) {
      // Costruisci il returnUrl con i parametri delle date selezionate
      const returnUrlParams = new URLSearchParams(location.search);
      if (startDate) {
        returnUrlParams.set('startDate', toItalianISOString(startDate));
      }
      if (endDate) {
        returnUrlParams.set('endDate', toItalianISOString(endDate));
      }
      if (variantIdToUse) {
        returnUrlParams.set('variantId', variantIdToUse);
      }
      if (startTime) {
        returnUrlParams.set('startTime', startTime);
      }
      if (endTime) {
        returnUrlParams.set('endTime', endTime);
      }
      const returnUrl = `${location.pathname}?${returnUrlParams.toString()}`;
      
      // Salva i dati del prodotto in localStorage prima del redirect
      const pendingCartData = {
        productId: product.id,
        variantId: variantIdToUse,
        startDate: toItalianISOString(startDate),
        endDate: toItalianISOString(endDate),
        startTime: startTime || '',
        endTime: endTime || '',
        quantity: quantity,
        returnUrl: returnUrl,
      };
      
      console.log('[RentalQuoteCard] Salvando pendingCartItem:', {
        returnUrl,
        productId: product.id,
        variantId: variantIdToUse,
        startDate: toItalianISOString(startDate),
        endDate: toItalianISOString(endDate),
      });
      localStorage.setItem('pendingCartItem', JSON.stringify(pendingCartData));
      navigate('/auth?redirect=checkout');
      return;
    }
    
    // Log della variante selezionata
    console.log('[RentalQuoteCard] Variante selezionata quando si clicca "Aggiungi al carrello":', {
      variantId: variantIdToUse || 'ERRORE: Nessuna variante disponibile',
      variant: selectedVariant || (variants.length > 0 ? variants[0] : null),
      productId: product.id,
      productName: product.name,
      hasVariants: product.has_variants,
      selectedAttributes: product.has_variants ? selectedAttributes : null,
      displayProduct: displayProduct, // Prodotto/variante effettivamente usato per i prezzi
      displayProductPriceDaily: displayProduct?.price_daily,
      displayProductPriceHour: displayProduct?.price_hour,
      displayProductDeposit: displayProduct?.deposit,
      variantsAvailable: variants.length
    });
    
    // Verifica che ci sia una variante disponibile
    if (!variantIdToUse) {
      console.error('[RentalQuoteCard] ERRORE: Nessuna variante disponibile!', {
        productId: product.id,
        has_variants: product.has_variants,
        variantsLength: variants.length,
        selectedVariant: selectedVariant
      });
      toast({
        title: "Errore",
        description: "Nessuna variante disponibile per questo prodotto",
        variant: "destructive",
      });
      return;
    }

    // Verifica disponibilità per la quantità richiesta
    if (totalStock > 0 && quantity > totalStock) {
      toast({
        title: "Errore",
        description: `Quantità non disponibile. Stock disponibile: ${totalStock}`,
        variant: "destructive",
      });
      return;
    }

    // Verifica che ci siano abbastanza unità disponibili per il periodo selezionato
    if (quantity > maxAvailableUnitsForPeriod) {
      toast({
        title: "Errore",
        description: `Non ci sono abbastanza unità disponibili per il periodo selezionato. Disponibili: ${maxAvailableUnitsForPeriod}`,
        variant: "destructive",
      });
      return;
    }

    // Prepare navigation params - usa sempre variantIdToUse che è garantito essere valorizzato
    const params = new URLSearchParams({
      productId: product.id,
      startDate: toItalianISOString(startDate),
      endDate: toItalianISOString(endDate),
      variantId: variantIdToUse, // Sempre valorizzato grazie al controllo sopra
      startTime: startTime || '',
      endTime: endTime || '',
      quantity: quantity.toString(),
    });

    // Prepara i parametri di navigazione
    setPendingNavigationParams(params.toString());
    setSelectedRelatedProducts(new Set());
    
    // Verifica se i prodotti correlati sono già stati caricati dal useEffect
    // (potrebbero essere già stati caricati quando è cambiata la variante o le date)
    if (relatedProducts.length > 0) {
      // Prodotti già caricati, mostra direttamente il dialog
      console.log('[RentalQuoteCard] Prodotti correlati già caricati, mostro il dialog', {
        count: relatedProducts.length
      });
      setShowAddMoreProductsDialog(true);
    } else {
      // Carica i prodotti correlati prima di decidere se mostrare il dialog
      // Load related products - usa variantIdToUse che è garantito essere valorizzato
      console.log('[RentalQuoteCard] Caricamento prodotti correlati per variantId:', variantIdToUse, 'date:', { startDate, endDate });
      
      // Carica i prodotti correlati e verifica se ce ne sono
      loadRelatedProducts(variantIdToUse, startDate, endDate).then((result) => {
        // Mostra il dialog se ci sono prodotti correlati (anche se non disponibili)
        // Il dialog mostrerà quali sono disponibili e quali no
        if (result && result.totalProducts > 0) {
          console.log('[RentalQuoteCard] Prodotti correlati trovati, mostro il dialog', {
            count: result.totalProducts,
            hasAvailable: result.hasAvailableProducts
          });
          setShowAddMoreProductsDialog(true);
        } else {
          // Se non ci sono prodotti correlati, naviga direttamente al checkout
          console.log('[RentalQuoteCard] Nessun prodotto correlato trovato, navigazione diretta al checkout');
          navigate(`/checkout?${params.toString()}`);
        }
      }).catch((error) => {
        console.error('[RentalQuoteCard] Errore nel caricamento prodotti correlati:', error);
        // In caso di errore, naviga direttamente al checkout
        navigate(`/checkout?${params.toString()}`);
      });
    }
  };

  // Function to load related products
  const loadRelatedProducts = async (variantId: string, startDate?: Date, endDate?: Date): Promise<{ hasAvailableProducts: boolean; totalProducts: number } | null> => {
    console.log('[RentalQuoteCard] loadRelatedProducts chiamata con variantId:', variantId, 'date range:', { startDate, endDate });
    
    if (!variantId) {
      console.warn('[RentalQuoteCard] variantId vuoto, nessun prodotto correlato da caricare');
      setRelatedProducts([]);
      setRelatedProductsAvailability(new Map());
      return;
    }

    if (!startDate || !endDate) {
      console.warn('[RentalQuoteCard] Date non disponibili per verificare disponibilità');
      setRelatedProducts([]);
      setRelatedProductsAvailability(new Map());
      return;
    }

    setLoadingRelatedProducts(true);
    try {
      // Step 1: Find all product_related entries for the current variant
      console.log('[RentalQuoteCard] Step 1: Cercando product_related per variantId:', variantId, 'tipo:', typeof variantId);
      const { data: currentProductRelated, error: error1 } = await supabase
        .from('product_related')
        .select('id_related, id_product_variant')
        .eq('id_product_variant', variantId);

      console.log('[RentalQuoteCard] Step 1 risultato:', {
        currentProductRelated,
        error: error1,
        count: currentProductRelated?.length || 0,
        variantIdCercato: variantId,
        entriesTrovate: currentProductRelated?.map(pr => ({
          id_product_variant: pr.id_product_variant,
          id_related: pr.id_related,
          tipo_id_related: typeof pr.id_related
        }))
      });

      if (error1) {
        console.error('[RentalQuoteCard] Error loading current product_related:', error1);
        setRelatedProducts([]);
        setRelatedProductsAvailability(new Map());
        return { hasAvailableProducts: false, totalProducts: 0 };
      }

      if (!currentProductRelated || currentProductRelated.length === 0) {
        console.log('[RentalQuoteCard] Nessuna entry in product_related per questa variante. Nessun prodotto correlato.');
        setRelatedProducts([]);
        setRelatedProductsAvailability(new Map());
        return { hasAvailableProducts: false, totalProducts: 0 };
      }

      // Step 2: Get all id_related values
      const relatedIds = currentProductRelated.map(pr => pr.id_related);
      console.log('[RentalQuoteCard] Step 2: id_related trovati:', relatedIds, 'tipo:', relatedIds.map(id => typeof id));

      // Step 3: Find all other product_related entries with the same id_related but different id_product_variant
      console.log('[RentalQuoteCard] Step 3: Cercando altre varianti con gli stessi id_related...', {
        relatedIds,
        variantIdDaEscludere: variantId,
        tipoVariantId: typeof variantId
      });
      
      // Prima verifica quante entry ci sono con questi id_related (senza escludere la variante corrente)
      const { data: allRelatedEntries, error: allError } = await supabase
        .from('product_related')
        .select('id_product_variant, id_related')
        .in('id_related', relatedIds);
      
      console.log('[RentalQuoteCard] Step 3a: Tutte le entry con questi id_related (prima del filtro):', {
        allRelatedEntries,
        count: allRelatedEntries?.length || 0,
        error: allError
      });
      
      // Prova prima senza la join per vedere se trova le entry
      const { data: relatedEntriesWithoutJoin, error: testError } = await supabase
        .from('product_related')
        .select('id_product_variant, id_related')
        .in('id_related', relatedIds)
        .neq('id_product_variant', variantId);
      
      console.log('[RentalQuoteCard] Step 3b: Entry trovate senza join:', {
        relatedEntriesWithoutJoin,
        count: relatedEntriesWithoutJoin?.length || 0,
        error: testError
      });
      
      const { data: relatedVariants, error: error2 } = await supabase
        .from('product_related')
        .select(`
          id_product_variant,
          id_related,
          product_variants(
            id,
            id_product,
            deposit,
            products(
              id,
              name,
              description,
              images
            )
          )
        `)
        .in('id_related', relatedIds)
        .neq('id_product_variant', variantId);

      console.log('[RentalQuoteCard] Step 3 risultato:', {
        relatedVariants,
        error: error2,
        errorDetails: error2 ? {
          message: error2.message,
          details: error2.details,
          hint: error2.hint,
          code: error2.code
        } : null,
        count: relatedVariants?.length || 0,
        variantIdsTrovati: relatedVariants?.map(rv => ({
          id_product_variant: rv.id_product_variant,
          id_related: rv.id_related,
          productName: rv.product_variants?.products?.name,
          variantId: rv.product_variants?.id
        }))
      });
      
      // Se la query con join fallisce, prova a caricare i dati separatamente
      if (error2 || !relatedVariants || relatedVariants.length === 0) {
        console.log('[RentalQuoteCard] Step 3 fallito, provo a caricare i dati separatamente...');
        
        if (relatedEntriesWithoutJoin && relatedEntriesWithoutJoin.length > 0) {
          const variantIds = relatedEntriesWithoutJoin.map(e => e.id_product_variant);
          console.log('[RentalQuoteCard] Caricamento varianti separate:', variantIds);
          
          // Carica le varianti separatamente
          const { data: variantsData, error: variantsError } = await supabase
            .from('product_variants')
            .select(`
              id,
              id_product,
              deposit,
              products(
                id,
                name,
                description,
                images
              )
            `)
            .in('id', variantIds);
          
          console.log('[RentalQuoteCard] Varianti caricate separatamente:', {
            variantsData,
            variantsError: variantsError ? {
              message: variantsError.message,
              details: variantsError.details,
              hint: variantsError.hint,
              code: variantsError.code
            } : null,
            count: variantsData?.length || 0
          });
          
          if (variantsData && variantsData.length > 0) {
            // Ricostruisci la struttura come se fosse venuta dalla join
            const reconstructedVariants = relatedEntriesWithoutJoin.map(entry => {
              const variant = variantsData.find(v => v.id === entry.id_product_variant);
              return {
                id_product_variant: entry.id_product_variant,
                id_related: entry.id_related,
                product_variants: variant || null
              };
            }).filter(rv => rv.product_variants !== null); // Filtra solo quelle con variante valida
            
            console.log('[RentalQuoteCard] Varianti ricostruite:', reconstructedVariants);
            
            // Usa le varianti ricostruite invece di quelle dalla join
            const transformedProducts = reconstructedVariants.map((rv: any) => ({
              variantId: rv.id_product_variant,
              relatedId: rv.id_related,
              variant: rv.product_variants,
              product: rv.product_variants?.products
            }));
            
            console.log('[RentalQuoteCard] Step 4: Prodotti correlati trasformati (metodo alternativo):', {
              count: transformedProducts.length,
              products: transformedProducts.map(p => ({
                variantId: p.variantId,
                productName: p.product?.name,
                productId: p.product?.id
              }))
            });
            
            // Continua con la verifica disponibilità...
            const availabilityMap = new Map<string, boolean>();
            const startDateStr = toItalianISOString(startDate!);
            const endDateStr = toItalianISOString(endDate!);

            // ID dello stato "Noleggiabile" - solo queste unità possono essere prenotate
            const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b';

            for (const relatedProduct of transformedProducts) {
              try {
                // Carica TUTTE le unità con status "Noleggiabile" per questa variante (non solo 1)
                const { data: units, error: unitsError } = await supabase
                  .from('product_units')
                  .select('id')
                  .eq('id_product_variant', relatedProduct.variantId)
                  .eq('id_product_status', rentableStatusId);

                if (unitsError || !units || units.length === 0) {
                  availabilityMap.set(relatedProduct.variantId, false);
                  continue;
                }

                const unitIds = units.map((u: any) => u.id);
                const totalUnits = unitIds.length;

                // Carica i booking_details per queste unità usando la stessa RPC del prodotto principale
                const { data: bookingDetails, error: detailsError } = await supabase
                  .rpc('get_booking_details_dates', {
                    p_unit_ids: unitIds
                  });

                if (detailsError) {
                  // Se c'è un errore ma ci sono unità, considera disponibile (fallback conservativo)
                  availabilityMap.set(relatedProduct.variantId, totalUnits > 0);
                  continue;
                }

                // Calcola le unità disponibili usando la stessa logica di maxAvailableUnitsForPeriod
                const bookedUnitIdsInPeriod = new Set<string>();
                
                if (bookingDetails && Array.isArray(bookingDetails) && bookingDetails.length > 0) {
                  bookingDetails.forEach((detail: any) => {
                    if (!detail.start_date || !detail.end_date || !detail.unit_id) {
                      return; // Skip invalid details
                    }
                    
                    try {
                      const detailStart = parseISO(detail.start_date);
                      const detailEnd = parseISO(detail.end_date);
                      const unitId = String(detail.unit_id);
                      
                      // Normalizza le date per il confronto (solo la parte data, senza ora)
                      const detailStartDate = new Date(detailStart.getFullYear(), detailStart.getMonth(), detailStart.getDate());
                      const detailEndDate = new Date(detailEnd.getFullYear(), detailEnd.getMonth(), detailEnd.getDate());
                      const periodStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                      const periodEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
                      
                      // Verifica se questa prenotazione si sovrappone al periodo selezionato
                      if (detailStartDate <= periodEndDate && detailEndDate >= periodStartDate) {
                        bookedUnitIdsInPeriod.add(unitId);
                      }
                    } catch (error) {
                      console.error('[RentalQuoteCard] Errore nel parsing date booking_detail (fallback):', error, detail);
                    }
                  });
                }
                
                // Il numero massimo di unità prenotabili è il totale unità meno quelle già prenotate
                const availableUnits = totalUnits - bookedUnitIdsInPeriod.size;
                const isAvailable = availableUnits > 0;

                availabilityMap.set(relatedProduct.variantId, isAvailable);
              } catch (error) {
                console.error('[RentalQuoteCard] Errore nel controllo disponibilità (fallback):', error);
                availabilityMap.set(relatedProduct.variantId, false);
              }
            }

            setRelatedProducts(transformedProducts);
            setRelatedProductsAvailability(availabilityMap);
            
            const hasAvailableProducts = Array.from(availabilityMap.values()).some(available => available === true);
            
            return { hasAvailableProducts, totalProducts: transformedProducts.length };
          }
        }
        
        // Se siamo qui, il fallback non ha funzionato, restituisci errore
        console.error('[RentalQuoteCard] Fallback fallito, nessun prodotto correlato caricato');
        setRelatedProducts([]);
        setRelatedProductsAvailability(new Map());
        return { hasAvailableProducts: false, totalProducts: 0 };
      }

      // Se la query con join ha funzionato, continua con il flusso normale
      if (error2) {
        console.error('[RentalQuoteCard] Error loading related variants:', error2);
        setRelatedProducts([]);
        setRelatedProductsAvailability(new Map());
        return { hasAvailableProducts: false, totalProducts: 0 };
      }

      // Step 4: Transform and check availability for each product
      const transformedProducts = (relatedVariants || []).map((rv: any) => ({
        variantId: rv.id_product_variant,
        relatedId: rv.id_related,
        variant: rv.product_variants,
        product: rv.product_variants?.products
      }));

      console.log('[RentalQuoteCard] Step 4: Prodotti correlati trasformati:', {
        count: transformedProducts.length,
        products: transformedProducts.map(p => ({
          variantId: p.variantId,
          productName: p.product?.name,
          productId: p.product?.id
        }))
      });

      // Step 5: Verifica disponibilità per ogni prodotto correlato usando la stessa logica del prodotto principale
      const availabilityMap = new Map<string, boolean>();
      const startDateStr = toItalianISOString(startDate);
      const endDateStr = toItalianISOString(endDate);

      // ID dello stato "Noleggiabile" - solo queste unità possono essere prenotate
      const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b';

      for (const relatedProduct of transformedProducts) {
        try {
          // Carica TUTTE le unità con status "Noleggiabile" per questa variante (non solo 1)
          const { data: units, error: unitsError } = await supabase
            .from('product_units')
            .select('id')
            .eq('id_product_variant', relatedProduct.variantId)
            .eq('id_product_status', rentableStatusId);

          if (unitsError || !units || units.length === 0) {
            console.log('[RentalQuoteCard] Nessuna unità noleggiabile per:', relatedProduct.product?.name);
            availabilityMap.set(relatedProduct.variantId, false);
            continue;
          }

          const unitIds = units.map((u: any) => u.id);
          const totalUnits = unitIds.length;

          // Carica i booking_details per queste unità usando la stessa RPC del prodotto principale
          const { data: bookingDetails, error: detailsError } = await supabase
            .rpc('get_booking_details_dates', {
              p_unit_ids: unitIds
            });

          if (detailsError) {
            console.warn('[RentalQuoteCard] Errore nel caricamento booking_details per:', relatedProduct.product?.name, detailsError);
            // Se c'è un errore ma ci sono unità, considera disponibile (fallback conservativo)
            availabilityMap.set(relatedProduct.variantId, totalUnits > 0);
            continue;
          }

          // Calcola le unità disponibili usando la stessa logica di maxAvailableUnitsForPeriod
          const bookedUnitIdsInPeriod = new Set<string>();
          
          if (bookingDetails && Array.isArray(bookingDetails) && bookingDetails.length > 0) {
            bookingDetails.forEach((detail: any) => {
              if (!detail.start_date || !detail.end_date || !detail.unit_id) {
                return; // Skip invalid details
              }
              
              try {
                const detailStart = parseISO(detail.start_date);
                const detailEnd = parseISO(detail.end_date);
                const unitId = String(detail.unit_id);
                
                // Normalizza le date per il confronto (solo la parte data, senza ora)
                const detailStartDate = new Date(detailStart.getFullYear(), detailStart.getMonth(), detailStart.getDate());
                const detailEndDate = new Date(detailEnd.getFullYear(), detailEnd.getMonth(), detailEnd.getDate());
                const periodStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                const periodEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
                
                // Verifica se questa prenotazione si sovrappone al periodo selezionato
                // Due periodi si sovrappongono se: start_date <= endDate AND end_date >= startDate
                if (detailStartDate <= periodEndDate && detailEndDate >= periodStartDate) {
                  bookedUnitIdsInPeriod.add(unitId);
                }
              } catch (error) {
                console.error('[RentalQuoteCard] Errore nel parsing date booking_detail:', error, detail);
              }
            });
          }
          
          // Il numero massimo di unità prenotabili è il totale unità meno quelle già prenotate
          const availableUnits = totalUnits - bookedUnitIdsInPeriod.size;
          const isAvailable = availableUnits > 0;

          availabilityMap.set(relatedProduct.variantId, isAvailable);
          console.log('[RentalQuoteCard] Disponibilità per', relatedProduct.product?.name, ':', {
            isAvailable,
            totalUnits,
            bookedUnits: bookedUnitIdsInPeriod.size,
            availableUnits
          });
        } catch (error) {
          console.error('[RentalQuoteCard] Errore nel controllo disponibilità:', error);
          availabilityMap.set(relatedProduct.variantId, false);
        }
      }

      setRelatedProducts(transformedProducts);
      setRelatedProductsAvailability(availabilityMap);
      
      // Verifica se ci sono prodotti disponibili
      const hasAvailableProducts = Array.from(availabilityMap.values()).some(available => available === true);
      
      console.log('[RentalQuoteCard] Risultato caricamento prodotti correlati:', {
        totalProducts: transformedProducts.length,
        availableProducts: Array.from(availabilityMap.values()).filter(a => a === true).length,
        hasAvailableProducts
      });
      
      return { hasAvailableProducts, totalProducts: transformedProducts.length };
    } catch (error) {
      console.error('[RentalQuoteCard] Error loading related products:', error);
      setRelatedProducts([]);
      setRelatedProductsAvailability(new Map());
      return { hasAvailableProducts: false, totalProducts: 0 };
    } finally {
      setLoadingRelatedProducts(false);
    }
  };

  // Handle related product selection
  const handleRelatedProductToggle = (variantId: string) => {
    setSelectedRelatedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(variantId)) {
        newSet.delete(variantId);
      } else {
        newSet.add(variantId);
      }
      return newSet;
    });
  };

  // Carica i prodotti correlati quando cambiano variante o date
  useEffect(() => {
    if (variantId && startDate && endDate) {
      console.log('[RentalQuoteCard] Caricamento prodotti correlati (useEffect):', { variantId, startDate, endDate });
      loadRelatedProducts(variantId, startDate, endDate).catch((error) => {
        console.error('[RentalQuoteCard] Errore nel caricamento prodotti correlati (useEffect):', error);
      });
    } else {
      console.log('[RentalQuoteCard] Condizioni non soddisfatte per caricare prodotti correlati:', { variantId, startDate, endDate });
      setRelatedProducts([]);
      setRelatedProductsAvailability(new Map());
      setSelectedRelatedProducts(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId, startDate, endDate]);

  // Calcola i prezzi dei prodotti correlati usando product_variant_price_list
  useEffect(() => {
    const calculateRelatedPrices = async () => {
      if (!startDate || !endDate || relatedProducts.length === 0) {
        console.log('[RentalQuoteCard] Condizioni non soddisfatte per calcolo prezzi:', {
          hasStartDate: !!startDate,
          hasEndDate: !!endDate,
          relatedProductsCount: relatedProducts.length
        });
        setRelatedProductsPrices({});
        return;
      }

      const isSameDayBooking = isSameDay(startDate, endDate);
      const rentalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
      
      // Calcola le ore solo se abbiamo orari validi nel formato "HH:MM"
      let rentalHours = 0;
      if (startTime && endTime && isSameDayBooking) {
        try {
          const startHour = parseInt(startTime.split(":")[0]);
          const endHour = parseInt(endTime.split(":")[0]);
          if (!isNaN(startHour) && !isNaN(endHour)) {
            rentalHours = Math.max(1, endHour - startHour);
          }
        } catch (error) {
          console.warn('[RentalQuoteCard] Errore nel calcolo delle ore:', error);
          rentalHours = 0;
        }
      }

      console.log('[RentalQuoteCard] Calcolo prezzi prodotti correlati:', {
        relatedProductsCount: relatedProducts.length,
        rentalDays,
        rentalHours,
        isSameDayBooking,
        startTime,
        endTime
      });

      const prices: { [variantId: string]: number } = {};

      for (const relatedProduct of relatedProducts) {
        try {
          console.log(`[RentalQuoteCard] Calcolo prezzo per prodotto correlato:`, {
            variantId: relatedProduct.variantId,
            productName: relatedProduct.product?.name
          });

          const totalPrice = await calculateRentalPrice(
            relatedProduct.variantId,
            rentalDays,
            rentalHours,
            isSameDayBooking
          );

          console.log(`[RentalQuoteCard] ✅ Prezzo calcolato per prodotto correlato ${relatedProduct.variantId}:`, totalPrice);
          prices[relatedProduct.variantId] = totalPrice;
        } catch (error) {
          console.error(`[RentalQuoteCard] ❌ Errore nel calcolo prezzo per prodotto correlato ${relatedProduct.variantId}:`, error);
          // Imposta 0 invece di undefined per evitare che rimanga in "Calcolo prezzo..."
          prices[relatedProduct.variantId] = 0;
        }
      }

      console.log('[RentalQuoteCard] Prezzi prodotti correlati calcolati:', prices);
      setRelatedProductsPrices(prices);
    };

    calculateRelatedPrices();
  }, [relatedProducts, startDate, endDate, startTime, endTime]);

  // Handle dialog confirmation - navigate to checkout
  const handleConfirmAddToCart = () => {
    if (pendingNavigationParams) {
      // Aggiungi i prodotti correlati selezionati ai parametri
      const params = new URLSearchParams(pendingNavigationParams);
      
      // Aggiungi gli ID delle varianti dei prodotti correlati selezionati
      if (selectedRelatedProducts.size > 0) {
        const relatedVariantIds = Array.from(selectedRelatedProducts);
        params.set('relatedVariantIds', relatedVariantIds.join(','));
        console.log('[RentalQuoteCard] Navigazione al checkout con prodotti correlati:', {
          relatedVariantIds,
          count: relatedVariantIds.length
        });
      }
      
      // Navigate to checkout with main product params and related products
      navigate(`/checkout?${params.toString()}`);
    }
    setShowAddMoreProductsDialog(false);
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    // Imposta l'orario a mezzanotte se viene selezionata una data
    const dateAtMidnight = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0) : undefined;
    setStartDate(dateAtMidnight);
    setIsStartCalendarOpen(false);
    
    if (dateAtMidnight) {
      // Imposta il mese del calendario della fine allo stesso mese della data di inizio
      setEndCalendarMonth(new Date(dateAtMidnight.getFullYear(), dateAtMidnight.getMonth(), 1));
      
      // Se non c'è una data di fine o se è prima della data di inizio, imposta la data di fine alla data di inizio
      if (!endDate || endDate < dateAtMidnight) {
        setEndDate(new Date(dateAtMidnight));
        // Apri automaticamente il calendario della data di fine
        setTimeout(() => {
          setIsEndCalendarOpen(true);
        }, 100);
      } else {
        // Se c'è già una data di fine valida, verifica che il range sia ancora disponibile
        if (!isDateRangeAvailable(dateAtMidnight, endDate)) {
          // Se il range non è più disponibile, imposta la data di fine alla data di inizio
          setEndDate(new Date(dateAtMidnight));
          setTimeout(() => {
            setIsEndCalendarOpen(true);
          }, 100);
        } else {
          // Resetta la mezzanotte di endDate se è già valida
          setEndDate(new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0));
        }
      }
    }
    
    // Reset entrambi gli orari quando cambia qualsiasi data
    setStartTime("");
    setEndTime("");
    // Reset flag "giorno intero" quando cambiano le date
    setFullDayBooking(false);
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (!date || !startDate) return;
    
    // Imposta sempre la data, anche se il range potrebbe non essere disponibile
    // La validazione verrà fatta quando l'utente cerca di prenotare
    const dateAtMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    
    // Verifica se il range è disponibile, ma imposta comunque la data
    const isAvailable = isDateRangeAvailable(startDate, dateAtMidnight);
    
    setEndDate(dateAtMidnight);
    setIsEndCalendarOpen(false);
    
    // Mostra un toast se il periodo non è completamente disponibile
    if (!isAvailable && totalStock > 0 && !bookingsLoading) {
      toast({
        title: "Periodo non disponibile",
        description: "Il prodotto non è disponibile per tutti i giorni selezionati. Seleziona un periodo diverso per proseguire.",
        variant: "destructive",
      });
    }
    
    // Verifica se la data selezionata ha enable_booking=true
    if (isDateWithEnabledBooking(dateAtMidnight, shopDaysOff)) {
      const nextDay = new Date(dateAtMidnight);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Mostra l'alert dialog
      setClosedShopAlertData({ date: dateAtMidnight, nextDay });
      setShowClosedShopAlert(true);
      setClosedShopWarningAcknowledged(false); // Reset quando cambia la data
    } else {
      // Se la data non ha più enable_booking, rimuovi l'avviso
      setClosedShopAlertData(null);
      setClosedShopWarningAcknowledged(false);
    }
    
    // Resetto la mezzanotte di startDate
    setStartDate(prev => prev ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), 0, 0, 0, 0) : prev);
    
    // Reset entrambi gli orari quando cambia qualsiasi data
    setStartTime("");
    setEndTime("");
    
    // Reset flag "giorno intero" quando cambiano le date
    setFullDayBooking(false);
    
    // Mostra un avviso se il range non è disponibile
    if (!isAvailable && totalStock > 0) {
      toast({
        title: "Attenzione",
        description: "Il periodo selezionato potrebbe non essere completamente disponibile. Verifica la disponibilità prima di procedere.",
        variant: "destructive",
      });
    }
  };

  // Aggiorna startDate e endDate con orario se necessario
  useEffect(() => {
    if (showTimeFields && startDate && startTime) {
      setStartDate(prev => prev ? setTimeOnDate(prev, startTime) : prev);
    }
  }, [showTimeFields, startTime]);

  useEffect(() => {
    if (showTimeFields && endDate && endTime) {
      setEndDate(prev => prev ? setTimeOnDate(prev, endTime) : prev);
    }
  }, [showTimeFields, endTime]);

  return (
    <>
      {/* Alert Dialog per negozio chiuso */}
      <AlertDialog open={showClosedShopAlert} onOpenChange={setShowClosedShopAlert}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <span className="text-2xl">⚠️</span>
              Attenzione: Negozio Chiuso
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {closedShopAlertData && (
                <>
                  Ti informiamo che il <strong>{format(closedShopAlertData.date, "dd/MM/yyyy", { locale: it })}</strong> il negozio sarà chiuso, 
                  pertanto la riconsegna del prodotto avverrà il giorno successivo (<strong>{format(closedShopAlertData.nextDay, "dd/MM/yyyy", { locale: it })}</strong>). 
                  Il prezzo verrà comunque calcolato sui giorni di prenotazione selezionati.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowClosedShopAlert(false);
              setClosedShopWarningAcknowledged(true);
            }}>
              Ho capito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="sticky top-24 z-30 shadow-lg border-gray-200">
      <CardHeader className="pb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold">Controlla la disponibilità</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Selezione varianti se il prodotto ha varianti */}
        {product.has_variants && attributes.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-2">Seleziona opzioni</div>
            {attributes.map((attr) => {
              const availableValues = availableAttributeValues[attr.id] || [];
              const isSelected = !!selectedAttributes[attr.id];
              const selectedValue = isSelected 
                ? availableValues.find(v => v.id === selectedAttributes[attr.id])
                : null;
              const isOpen = openAttributePopovers[attr.id] || false;
              
              return (
                <Popover 
                  key={attr.id} 
                  open={isOpen} 
                  onOpenChange={(open) => {
                    setOpenAttributePopovers(prev => ({ ...prev, [attr.id]: open }));
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full h-14 justify-start text-left font-normal border border-gray-300 rounded-lg hover:bg-gray-50",
                        !isSelected && "text-muted-foreground"
                      )}
                      disabled={availableValues.length === 0}
                    >
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-medium text-gray-600 uppercase">
                          {attr.name}
                          {attr.unit && <span className="normal-case"> ({attr.unit})</span>}
                        </span>
                        <span className="text-sm">
                          {selectedValue ? selectedValue.value : `Seleziona ${attr.name}`}
                        </span>
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="p-2">
                      {selectedAttributes[attr.id] && (
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 mb-2"
                          onClick={() => {
                            setSelectedAttributes(prev => {
                              const newSelection = { ...prev };
                              delete newSelection[attr.id];
                              return newSelection;
                            });
                            setOpenAttributePopovers(prev => ({ ...prev, [attr.id]: false }));
                          }}
                        >
                          ✕ Rimuovi selezione
                        </Button>
                      )}
                      {availableValues.length === 0 ? (
                        <div className="p-4 text-sm text-amber-600">
                          ⚠️ Nessun valore disponibile per questa combinazione. Prova a cambiare altre selezioni.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {availableValues.map((val) => (
                            <Button
                              key={val.id}
                              variant={selectedAttributes[attr.id] === val.id ? "default" : "ghost"}
                              className={cn(
                                "w-full justify-start",
                                selectedAttributes[attr.id] === val.id && "bg-blue-600 text-white hover:bg-blue-700"
                              )}
                              onClick={() => {
                                handleAttributeChange(attr.id, val.id);
                                setOpenAttributePopovers(prev => ({ ...prev, [attr.id]: false }));
                              }}
                            >
                              {val.value}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
        )}
        
        
        {/* Date Selection */}
        <div className="grid grid-cols-2 gap-0 border border-gray-300 rounded-lg overflow-hidden">
          <Popover open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-14 justify-start text-left font-normal border-r border-gray-300 rounded-none hover:bg-gray-50",
                  !startDate && "text-muted-foreground"
                )}
              >
                <div className="flex flex-col items-start">
                  <span className="text-xs font-medium text-gray-600 uppercase">Inizio noleggio</span>
                  <span className="text-sm">
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: it }) : "Data inizio"}
                  </span>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                mode="single"
                selected={startDate}
                onSelect={handleStartDateSelect}
                disabled={isStartDateDisabled}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-14 justify-start text-left font-normal rounded-none hover:bg-gray-50",
                  !endDate && "text-muted-foreground"
                )}
              >
                <div className="flex flex-col items-start">
                  <span className="text-xs font-medium text-gray-600 uppercase">Fine noleggio</span>
                  <span className="text-sm">
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: it }) : "Data fine"}
                  </span>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={handleEndDateSelect}
                disabled={isEndDateDisabled}
                month={endCalendarMonth}
                onMonthChange={setEndCalendarMonth}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Campo Quantità - Nascosto, quantità sempre impostata a 1 */}

        {/* Flag "Prenota per il giorno intero" - solo se ha entrambi i prezzi e durata minima è 0 o 1 giorno */}
        {isSameDayBooking && hasBothPricing && canShowFullDayOption && (
          <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <input
              type="checkbox"
              id="fullDayBooking"
              checked={fullDayBooking}
              onChange={(e) => {
                setFullDayBooking(e.target.checked);
                if (e.target.checked) {
                  // Reset orari quando si attiva il flag
                  setStartTime("");
                  setEndTime("");
                }
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="fullDayBooking" className="text-sm font-medium text-blue-900">
              Prenota per il giorno intero
            </label>
            <span className="text-xs text-blue-700">
              {variantPricingInfo?.dailyPrice && variantPricingInfo?.hourlyPrice ? (
                <>€{variantPricingInfo.dailyPrice.toFixed(2)} invece di €{variantPricingInfo.hourlyPrice.toFixed(2)}/ora</>
              ) : (
                <>Prezzo giornaliero invece di orario</>
              )}
            </span>
          </div>
        )}

        {/* Selezione orari solo se stesso giorno e prezzo orario */}
        {showTimeFields && (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase">Orario inizio</span>
                <select
                  className="w-full border rounded px-2 py-1 mt-1"
                  value={startTime}
                  onChange={e => {
                    setStartTime(e.target.value);
                    // Valida in tempo reale se entrambi gli orari sono valorizzati
                    if (e.target.value && endTime) {
                      const startHour = parseInt(e.target.value.split(":")[0]);
                      const endHour = parseInt(endTime.split(":")[0]);
                      if (endHour <= startHour) {
                        setTimeError("L'orario di fine deve essere successivo all'orario di inizio");
                      } else {
                        setTimeError("");
                      }
                    } else {
                      setTimeError("");
                    }
                  }}
                >
                  <option value="">Seleziona</option>
                  {hourlyTimeSlots.map(slot => (
                    <option key={slot.value} value={slot.value}>{slot.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase">Orario fine</span>
                <select
                  className="w-full border rounded px-2 py-1 mt-1"
                  value={endTime}
                  onChange={e => {
                    setEndTime(e.target.value);
                    // Valida in tempo reale se entrambi gli orari sono valorizzati
                    if (e.target.value && startTime) {
                      const startHour = parseInt(startTime.split(":")[0]);
                      const endHour = parseInt(e.target.value.split(":")[0]);
                      if (endHour <= startHour) {
                        setTimeError("L'orario di fine deve essere successivo all'orario di inizio");
                      } else {
                        setTimeError("");
                      }
                    } else {
                      setTimeError("");
                    }
                  }}
                >
                  <option value="">Seleziona</option>
                  {hourlyTimeSlots.map(slot => (
                    <option key={slot.value} value={slot.value}>{slot.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Error Message - ora vicino agli orari */}
            {timeError && (
              <p className="text-sm text-red-600 text-center">
                {timeError}
              </p>
            )}
            {durationError && (
              <p className="text-sm text-red-600 text-center">
                {durationError}
              </p>
            )}
          </div>
        )}

        {/* Price Breakdown */}
        {startDate && endDate && !timeError && (
          <div className="space-y-3 pt-4 border-t border-gray-200">
            {/* Mostra calcolo orario se applicabile, altrimenti calcolo giornaliero */}
            {rentalHours > 0 && isSameDayBooking && !fullDayBooking ? (
              <div className="flex justify-between text-sm">
                <span className="underline">
                  €{pricingBreakdown.hourlyPrice} x {rentalHours} {rentalHours === 1 ? 'ora' : 'ore'}
                </span>
                <span>€{pricingBreakdown.originalPrice.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="underline">
                  {pricingBreakdown.dailyPrice > 0 ? (
                    <>€{pricingBreakdown.dailyPrice.toFixed(2)} × {rentalDays} {rentalDays === 1 ? 'giorno' : 'giorni'}</>
                  ) : (
                    <>{rentalDays} {rentalDays === 1 ? 'giorno' : 'giorni'}</>
                  )}
                </span>
                <span>€{pricingBreakdown.originalPrice.toFixed(2)}</span>
              </div>
            )}
            
            {pricingBreakdown.discountAmount > 0 && (
              <>
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>
                    💰 Sconto {pricingBreakdown.appliedDiscount === 'weekly' ? 'settimanale' : 'mensile'} applicato
                  </span>
                  <span>-€{pricingBreakdown.discountAmount.toFixed(2)}</span>
                </div>
                <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                  <span>🎉 Hai risparmiato €{pricingBreakdown.discountAmount.toFixed(2)} grazie al noleggio {pricingBreakdown.appliedDiscount === 'weekly' ? 'settimanale' : 'mensile'}!</span>
                </div>
              </>
            )}
            
            <div className="flex justify-between font-semibold text-base pt-3 border-t border-gray-200">
              <span>Totale noleggio {quantity > 1 && `(${quantity} pezzi)`}</span>
              <span>€{(pricingBreakdown.totalPrice * quantity).toFixed(2)}</span>
            </div>
          </div>
        )}


        {/* Error Message for Duration */}
        {durationError && (
          <div className="text-center text-sm text-red-600 p-2 bg-red-50 rounded border border-red-200">
            ⚠️ {durationError}
          </div>
        )}

        {/* Book Now Button */}
        <Button 
          onClick={() => {
            console.log('[RentalQuoteCard] 🖱️ Pulsante "Aggiungi al carrello" cliccato');
            console.log('[RentalQuoteCard] 📊 Stato validazioni:', {
              hasStartDate: !!startDate,
              hasEndDate: !!endDate,
              bookingsLoading,
              showTimeFields,
              hasStartTime: !!startTime,
              hasEndTime: !!endTime,
              durationError,
              timeError,
              hasSelectedVariant: !!selectedVariant,
              quantity,
              maxAvailableUnitsForPeriod,
              isDisabled: !startDate || 
                !endDate || 
                bookingsLoading || 
                (showTimeFields && (!startTime || !endTime)) || 
                durationError !== "" || 
                timeError !== "" ||
                (product.has_variants && !selectedVariant) ||
                quantity < 1 ||
                (maxAvailableUnitsForPeriod > 0 && quantity > maxAvailableUnitsForPeriod) ||
                (startDate && endDate && totalStock > 0 && !bookingsLoading && !isDateRangeAvailable(startDate, endDate))
            });
            handleBookNow();
          }}
          disabled={
            !startDate || 
            !endDate || 
            bookingsLoading || 
            (showTimeFields && (!startTime || !endTime)) || 
            durationError !== "" || 
            timeError !== "" ||
            (product.has_variants && !selectedVariant) ||
            quantity < 1 ||
            (maxAvailableUnitsForPeriod > 0 && quantity > maxAvailableUnitsForPeriod) ||
            (startDate && endDate && totalStock > 0 && !bookingsLoading && !isDateRangeAvailable(startDate, endDate))
          }
          className="w-full h-12 text-white font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#E31E24', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#C01A1F')}
          onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E31E24')}
        >
          {bookingsLoading ? 'Caricamento...' : 'Aggiungi al carrello'}
        </Button>

        {/* Avviso persistente negozio chiuso */}
        {closedShopWarningAcknowledged && closedShopAlertData && (
          <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-900 font-medium flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              Il {format(closedShopAlertData.date, "dd/MM/yyyy", { locale: it })} il negozio sarà chiuso.
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Riconsegna prevista: {format(closedShopAlertData.nextDay, "dd/MM/yyyy", { locale: it })}
            </p>
          </div>
        )}

        {/* Info message about adding more products */}
        {startDate && endDate && (
          <div className="text-center text-sm text-gray-600 mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="font-medium text-blue-900 mb-1">💡 Puoi aggiungere altri prodotti</p>
            <p className="text-xs text-blue-700">
              Dopo aver aggiunto questo prodotto al carrello, potrai continuare a navigare e aggiungere altri prodotti alla tua prenotazione.
            </p>
          </div>
        )}

        {/* Messaggio cauzione sotto il pulsante */}
        {startDate && endDate && !timeError && (
          displayProduct.deposit && Number(displayProduct.deposit) > 0 ? (
            <div className="text-center text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
              <span>ℹ️ Cauzione richiesta: €{displayProduct.deposit}</span>
              <br />
              <span className="text-xs">Oltre al costo totale del noleggio, in fase di ritiro del prodotto ti sarà richiesta una cauzione di €{displayProduct.deposit}. La cauzione verrà restituita al termine del periodo di noleggio.</span>
            </div>
          ) : (
            <div className="text-center text-sm text-green-600 mt-2 p-2 bg-green-50 rounded">
              <span>✅ Questo articolo non richiede cauzione</span>
            </div>
          )
        )}
{/* 
        {startDate && endDate && (
          <p className="text-center text-sm text-gray-500">
            Non verrai addebitato subito
          </p>
        )} */}

        {bookingsLoading && (
          <p className="text-center text-sm text-gray-400">
            Verifica disponibilità...
          </p>
        )}
      </CardContent>
    </Card>

    {/* Dialog per chiedere se vuole aggiungere altri prodotti */}
    <Dialog open={showAddMoreProductsDialog} onOpenChange={setShowAddMoreProductsDialog}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vuoi aggiungere altri prodotti?</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {loadingRelatedProducts ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Caricamento prodotti correlati...</p>
            </div>
          ) : relatedProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Nessun prodotto correlato disponibile</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Seleziona i prodotti correlati che vuoi aggiungere al carrello:
              </p>
              {relatedProducts.map((relatedProduct) => {
                const product = relatedProduct.product;
                const variant = relatedProduct.variant;
                const isSelected = selectedRelatedProducts.has(relatedProduct.variantId);
                const isAvailable = relatedProductsAvailability.get(relatedProduct.variantId) ?? false;
                
                return (
                  <div
                    key={relatedProduct.variantId}
                    className={`flex items-start space-x-3 p-3 border rounded-lg transition-colors ${
                      isAvailable 
                        ? `cursor-pointer hover:bg-gray-50 ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-200'}`
                        : 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-300'
                    }`}
                    onClick={() => {
                      if (isAvailable) {
                        handleRelatedProductToggle(relatedProduct.variantId);
                      }
                    }}
                  >
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        disabled={!isAvailable}
                        onCheckedChange={(checked) => {
                          if (isAvailable) {
                            handleRelatedProductToggle(relatedProduct.variantId);
                          }
                        }}
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        {product?.images && product.images.length > 0 && (
                          <img
                            src={product.images[0]}
                            alt={product?.name || 'Prodotto'}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{product?.name || 'Prodotto'}</h4>
                          {product?.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          {variant && (() => {
                            const productPrice = relatedProductsPrices[relatedProduct.variantId];
                            // Considera "loading" solo se la chiave non esiste nello stato (undefined)
                            // Se esiste ma è 0, significa che è stato calcolato e il prezzo è 0
                            const isLoadingPrice = !(relatedProduct.variantId in relatedProductsPrices);
                            
                            return (
                              <div className="mt-2 space-y-1">
                                <div className="text-sm font-semibold text-gray-900">
                                  {isLoadingPrice ? (
                                    <span className="text-gray-400 text-xs">Calcolo prezzo...</span>
                                  ) : (
                                    <>Totale: €{(productPrice ?? 0).toFixed(2)}</>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {variant.deposit && Number(variant.deposit) > 0 && (
                                    <span>Cauzione: €{Number(variant.deposit).toFixed(2)}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                          {!isAvailable && (
                            <div className="mt-2 text-xs text-red-600 font-medium">
                              ⚠️ Non ci sono unità disponibili per il periodo selezionato
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowAddMoreProductsDialog(false)}
          >
            Annulla
          </Button>
          <Button
            onClick={handleConfirmAddToCart}
          >
            Continua al checkout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default RentalQuoteCard;
