import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { format, isSameDay, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, Clock, MapPin, Truck, Home, CheckCircle } from "lucide-react";
import { DEFAULT_IMAGES } from "@/constants";
import { BookingService } from "@/services/api";
import type { CreateBookingData } from "@/types";
import { calculateRentalPrice } from "@/lib/pricing";
import { toItalianISOString } from "@/lib/utils";

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

interface BookingDetail {
  id: string;
  booking_id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  delivery_method: 'pickup' | 'delivery';
  ritiro_fasciaoraria_inizio: string | null;
  ritiro_fasciaoraria_fine: string | null;
  riconsegna_fasciaoraria_inizio: string | null;
  riconsegna_fasciaoraria_fine: string | null;
  price: number;
  products?: {
    id: string;
    name: string;
    brand: string;
    model: string;
    images: string[];
    can_be_delivered: boolean;
    can_be_picked_up: boolean;
  };
  product_units?: {
    id_product_variant: string;
  };
  product_variants?: {
    id_product: string;
  };
}

interface CartBooking {
  id: string;
  user_id: string;
  booking_details?: BookingDetail[];
}

interface DetailFormData {
  deliveryMethod: 'pickup' | 'delivery' | '';
  pickupTimeSlot: string;
  returnTimeSlot: string;
}

export default function BookingDetails() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get URL parameters for new product to add
  const urlProductId = searchParams.get("productId");
  const urlStartDate = searchParams.get("startDate");
  const urlEndDate = searchParams.get("endDate");
  const urlVariantId = searchParams.get("variantId");
  const urlStartTime = searchParams.get("startTime");
  const urlEndTime = searchParams.get("endTime");
  
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Fetch cart booking with details
  const { data: cartData, isLoading } = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: allBookings } = await supabase
        .from("bookings")
        .select("id, user_id, cart")
        .eq("user_id", user.id);

      const cartBooking = allBookings?.find(b => b.cart === true);
      
      if (!cartBooking) return null;

      const { data: bookingDetails, error } = await supabase
        .from("booking_details")
        .select(`
          id,
          booking_id,
          unit_id,
          start_date,
          end_date,
          delivery_method,
          ritiro_fasciaoraria_inizio,
          ritiro_fasciaoraria_fine,
          riconsegna_fasciaoraria_inizio,
          riconsegna_fasciaoraria_fine,
          price,
          product_units!inner(
            id_product_variant,
            product_variants!inner(
              id_product,
              products!inner(
                id,
                name,
                images,
                can_be_delivered,
                can_be_picked_up,
                product_brand:product_brand(id, name),
                product_model:product_model(id, name)
              )
            )
          )
        `)
        .eq("booking_id", cartBooking.id);

      if (error) throw error;

      // Transform the data to match our interface
      const transformedDetails: BookingDetail[] = (bookingDetails || []).map((detail: any) => ({
        id: detail.id,
        booking_id: detail.booking_id,
        unit_id: detail.unit_id,
        start_date: detail.start_date,
        end_date: detail.end_date,
        delivery_method: detail.delivery_method,
        ritiro_fasciaoraria_inizio: detail.ritiro_fasciaoraria_inizio,
        ritiro_fasciaoraria_fine: detail.ritiro_fasciaoraria_fine,
        riconsegna_fasciaoraria_inizio: detail.riconsegna_fasciaoraria_inizio,
        riconsegna_fasciaoraria_fine: detail.riconsegna_fasciaoraria_fine,
        price: detail.price,
        products: detail.product_units?.product_variants?.products ? {
          id: detail.product_units.product_variants.products.id,
          name: detail.product_units.product_variants.products.name,
          brand: detail.product_units.product_variants.products.product_brand?.name || '',
          model: detail.product_units.product_variants.products.product_model?.name || '',
          images: detail.product_units.product_variants.products.images || [],
          can_be_delivered: detail.product_units.product_variants.products.can_be_delivered,
          can_be_picked_up: detail.product_units.product_variants.products.can_be_picked_up,
        } : undefined,
      }));

      return {
        id: cartBooking.id,
        user_id: cartBooking.user_id,
        booking_details: transformedDetails,
      } as CartBooking;
    },
    enabled: !!user?.id,
  });

  // State per ogni booking_detail
  const [detailsFormData, setDetailsFormData] = useState<{ [detailId: string]: DetailFormData }>({});

  // State per nuovo prodotto da aggiungere (se ci sono parametri URL)
  const [newProductData, setNewProductData] = useState<{
    productId: string;
    startDate: Date;
    endDate: Date;
    variantId: string;
    startTime: string;
    endTime: string;
    product: any;
    variant: any;
    formData: DetailFormData;
  } | null>(null);

  // Carica dati del prodotto quando ci sono parametri URL
  useEffect(() => {
    const loadNewProductData = async () => {
      if (!user?.id || !urlProductId || !urlStartDate || !urlEndDate) {
        setNewProductData(null);
        return;
      }

      try {
        const startDate = new Date(urlStartDate);
        const endDate = new Date(urlEndDate);

        // Fetch product and variant data
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            images,
            can_be_delivered,
            can_be_picked_up,
            has_variants,
            product_brand:product_brand(id, name),
            product_model:product_model(id, name),
            product_variants(
              id,
              is_active,
              price_hour,
              price_daily,
              price_weekly,
              price_monthly,
              deposit
            )
          `)
          .eq('id', urlProductId)
          .single();
        
        if (productError) throw productError;

        // Get selected variant
        let variantId: string | null = null;
        let selectedVariant: any = null;
        
        if (urlVariantId) {
          variantId = urlVariantId;
          selectedVariant = productData.product_variants?.find((v: any) => v.id === variantId);
        } else if (productData.has_variants === true && productData.product_variants) {
          const activeVariant = productData.product_variants.find((v: any) => v.is_active === true);
          if (activeVariant) {
            variantId = activeVariant.id;
            selectedVariant = activeVariant;
          }
        } else {
          // I prezzi non sono più nella tabella product_variants, sono in product_variant_price_list
          const { data: fallbackVariants } = await supabase
            .from('product_variants')
            .select('id, deposit')
            .eq('id_product', urlProductId)
            .limit(1);
          if (fallbackVariants && fallbackVariants.length > 0) {
            variantId = fallbackVariants[0].id;
            selectedVariant = fallbackVariants[0];
          }
        }

        if (!variantId || !selectedVariant) {
          throw new Error('Prodotto senza varianti valide.');
        }

        setNewProductData({
          productId: urlProductId,
          startDate,
          endDate,
          variantId,
          startTime: urlStartTime || '',
          endTime: urlEndTime || '',
          product: productData,
          variant: selectedVariant,
          formData: {
            deliveryMethod: '',
            pickupTimeSlot: '',
            returnTimeSlot: '',
          },
        });
      } catch (error) {
        console.error('Error loading product data:', error);
        toast({
          title: "Errore",
          description: error instanceof Error ? error.message : 'Errore nel caricamento del prodotto',
          variant: "destructive",
        });
        navigate(-1);
      }
    };

    loadNewProductData();
  }, [user?.id, urlProductId, urlStartDate, urlEndDate, urlVariantId, urlStartTime, urlEndTime, navigate, toast]);

  // Inizializza i form data quando i dati vengono caricati
  useEffect(() => {
    if (cartData?.booking_details) {
      const initialData: { [detailId: string]: DetailFormData } = {};
      cartData.booking_details.forEach((detail) => {
        const pickupSlot = detail.ritiro_fasciaoraria_inizio && detail.ritiro_fasciaoraria_fine
          ? `${detail.ritiro_fasciaoraria_inizio}-${detail.ritiro_fasciaoraria_fine}`
          : '';
        const returnSlot = detail.riconsegna_fasciaoraria_inizio && detail.riconsegna_fasciaoraria_fine
          ? `${detail.riconsegna_fasciaoraria_inizio}-${detail.riconsegna_fasciaoraria_fine}`
          : '';
        
        initialData[detail.id] = {
          deliveryMethod: detail.delivery_method || '',
          pickupTimeSlot: pickupSlot,
          returnTimeSlot: returnSlot,
        };
      });
      setDetailsFormData(initialData);
    }
  }, [cartData]);

  // Update mutation
  const updateDetailMutation = useMutation({
    mutationFn: async ({ detailId, formData }: { detailId: string; formData: DetailFormData }) => {
      const pickupSlot = timeSlots.find(slot => slot.value === formData.pickupTimeSlot);
      const returnSlot = timeSlots.find(slot => slot.value === formData.returnTimeSlot);

      const updateData: any = {
        delivery_method: formData.deliveryMethod,
      };

      if (formData.deliveryMethod === 'pickup') {
        if (pickupSlot) {
          updateData.ritiro_fasciaoraria_inizio = pickupSlot.start;
          updateData.ritiro_fasciaoraria_fine = pickupSlot.end;
        }
        if (returnSlot) {
          updateData.riconsegna_fasciaoraria_inizio = returnSlot.start;
          updateData.riconsegna_fasciaoraria_fine = returnSlot.end;
        }
      } else {
        // Per delivery, rimuovi le fasce orarie
        updateData.ritiro_fasciaoraria_inizio = null;
        updateData.ritiro_fasciaoraria_fine = null;
        updateData.riconsegna_fasciaoraria_inizio = null;
        updateData.riconsegna_fasciaoraria_fine = null;
      }

      const { error } = await supabase
        .from("booking_details")
        .update(updateData)
        .eq("id", detailId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const handleUpdateDetail = (detailId: string, formData: DetailFormData) => {
    setDetailsFormData(prev => ({ ...prev, [detailId]: formData }));
    updateDetailMutation.mutate({ detailId, formData });
  };

  // Funzione per aggiungere il nuovo prodotto al carrello
  const handleAddToCart = async () => {
    if (!user?.id || !newProductData) return;

    // Validazione
    if (!newProductData.formData.deliveryMethod) {
      toast({
        title: "Attenzione",
        description: "Seleziona la modalità di ritiro.",
        variant: "destructive",
      });
      return;
    }

    const isSameDayBooking = isSameDay(newProductData.startDate, newProductData.endDate);
    if (newProductData.formData.deliveryMethod === 'pickup' && !isSameDayBooking) {
      if (!newProductData.formData.pickupTimeSlot || !newProductData.formData.returnTimeSlot) {
        toast({
          title: "Attenzione",
          description: "Seleziona le fasce orarie per il ritiro e la riconsegna.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsAddingToCart(true);

    try {
      const startDate = newProductData.startDate;
      const endDate = newProductData.endDate;
      const isSameDayBooking = isSameDay(startDate, endDate);
      const rentalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
      const rentalHours = newProductData.startTime && newProductData.endTime && isSameDayBooking
        ? Math.max(1, parseInt(newProductData.endTime.split(":")[0]) - parseInt(newProductData.startTime.split(":")[0]))
        : 0;

      // Calculate pricing using new price list system
      const totalPrice = await calculateRentalPrice(
        newProductData.variantId,
        rentalDays,
        rentalHours,
        isSameDayBooking
      );

      // Check availability and get available unit
      const { data: allUnits, error: allUnitsError } = await supabase
        .from('product_units')
        .select('id')
        .eq('id_product_variant', newProductData.variantId);

      if (allUnitsError) throw new Error(`Errore nel recupero delle unità: ${allUnitsError.message}`);
      if (!allUnits || allUnits.length === 0) {
        throw new Error('Prodotto non disponibile. Nessuna unità disponibile per questo prodotto.');
      }

      const unitIds = allUnits.map((u: any) => u.id);
      
      console.log('[BookingDetails] Inserimento booking_details - Date prima della conversione:', {
        startDate,
        endDate,
        startDateType: typeof startDate,
        endDateType: typeof endDate,
      });
      
      const startDateStr = toItalianISOString(startDate);
      const endDateStr = toItalianISOString(endDate);
      
      console.log('[BookingDetails] Inserimento booking_details - Date dopo la conversione:', {
        startDateStr,
        endDateStr,
      });
      
      // Use secure RPC function instead of direct query to avoid exposing sensitive data
      const { data: availabilityData, error: availabilityError } = await supabase
        .rpc('check_unit_availability', {
          p_unit_ids: unitIds,
          p_start_date: startDateStr,
          p_end_date: endDateStr
        });
      
      if (availabilityError) throw new Error(`Errore nel controllo disponibilità: ${availabilityError.message}`);
      
      // Find first available unit
      const availableUnit = allUnits.find((u: any) => {
        const unitAvailability = availabilityData?.find((a: any) => a.unit_id === u.id);
        return unitAvailability?.is_available === true;
      });
      if (!availableUnit) {
        throw new Error('Prodotto non disponibile per il periodo selezionato. Tutte le unità sono già prenotate.');
      }

      // Get or create cart booking
      const { data: existingCartBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('user_id', user.id)
        .eq('cart', true)
        .maybeSingle();

      let bookingId: string;
      if (existingCartBooking) {
        bookingId = existingCartBooking.id;
      } else {
        const bookingData: CreateBookingData = {
          user_id: user.id,
          product_id: newProductData.productId,
          start_date: startDateStr,
          end_date: endDateStr,
          price_total: totalPrice,
          delivery_method: 'pickup', // Default, sarà aggiornato quando l'utente seleziona
          delivery_address: null,
          status: 'cart',
          cart: true,
          price_daily: null,
          price_weekly: null,
          price_hour: null,
          price_month: null,
          deposito: null,
        };
        
        const result = await BookingService.createBooking(bookingData);
        if (result.error) throw new Error(result.error);
        if (!result.data) throw new Error('Errore: prenotazione non creata');
        bookingId = result.data.id;
      }

      // Prepare time slots
      const pickupSlot = timeSlots.find(slot => slot.value === newProductData.formData.pickupTimeSlot);
      const returnSlot = timeSlots.find(slot => slot.value === newProductData.formData.returnTimeSlot);

      // Create booking_details
      const bookingDetailsData: any = {
        booking_id: bookingId,
        user_id: user.id,
        unit_id: availableUnit.id,
        start_date: startDateStr,
        end_date: endDateStr,
        delivery_method: newProductData.formData.deliveryMethod,
        price: totalPrice,
        price_daily: newProductData.variant.price_daily,
        price_weekly: newProductData.variant.price_weekly,
        price_hour: newProductData.variant.price_hour,
        price_month: newProductData.variant.price_monthly,
        deposito: newProductData.variant.deposit,
        status: 'idle',
      };

      if (newProductData.formData.deliveryMethod === 'pickup' && pickupSlot && returnSlot) {
        bookingDetailsData.ritiro_fasciaoraria_inizio = pickupSlot.start;
        bookingDetailsData.ritiro_fasciaoraria_fine = pickupSlot.end;
        bookingDetailsData.riconsegna_fasciaoraria_inizio = returnSlot.start;
        bookingDetailsData.riconsegna_fasciaoraria_fine = returnSlot.end;
      }

      const { error: bookingDetailsError } = await supabase
        .from('booking_details')
        .insert(bookingDetailsData);

      if (bookingDetailsError) throw new Error(`Errore nella creazione dei dettagli: ${bookingDetailsError.message}`);

      // Update booking price_total
      const { data: allDetails } = await supabase
        .from('booking_details')
        .select('price')
        .eq('booking_id', bookingId);

      if (allDetails) {
        const totalPriceSum = allDetails.reduce((sum: number, detail: any) => sum + (Number(detail.price) || 0), 0);
        await supabase
          .from('bookings')
          .update({ price_total: totalPriceSum })
          .eq('id', bookingId);
      }

      // Invalidate queries and clear URL params
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["cartCount"] });
      
      // Remove URL params
      navigate('/booking-details', { replace: true });
      setNewProductData(null);
      
      toast({
        title: "Prodotto aggiunto!",
        description: "Il prodotto è stato aggiunto al carrello.",
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
        variant: "destructive",
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleContinue = () => {
    // Verifica che tutti i dettagli abbiano una modalità di ritiro selezionata
    if (!cartData?.booking_details) return;

    const allDetailsHaveMethod = cartData.booking_details.every(detail => {
      const formData = detailsFormData[detail.id];
      return formData?.deliveryMethod;
    });

    if (!allDetailsHaveMethod) {
      toast({
        title: "Attenzione",
        description: "Seleziona la modalità di ritiro per tutti i prodotti.",
        variant: "destructive",
      });
      return;
    }

    // Verifica che per i pickup siano selezionate le fasce orarie
    const pickupDetailsNeedTimeSlots = cartData.booking_details.filter(detail => {
      const formData = detailsFormData[detail.id];
      return formData?.deliveryMethod === 'pickup';
    });

    const allPickupDetailsHaveTimeSlots = pickupDetailsNeedTimeSlots.every(detail => {
      const formData = detailsFormData[detail.id];
      const startDate = new Date(detail.start_date);
      const endDate = new Date(detail.end_date);
      const isSameDay = startDate.toDateString() === endDate.toDateString();
      
      // Se è stesso giorno, non serve fascia oraria
      if (isSameDay) return true;
      
      return formData?.pickupTimeSlot && formData?.returnTimeSlot;
    });

    if (!allPickupDetailsHaveTimeSlots) {
      toast({
        title: "Attenzione",
        description: "Seleziona le fasce orarie per tutti i ritiri in sede.",
        variant: "destructive",
      });
      return;
    }

    // Naviga al carrello per la conferma finale
    navigate('/cart');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <FixedNavbar />
        <div className="container mx-auto px-4 py-8 pt-20 md:pt-24">
          <div className="text-center">
            Caricamento...
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const hasCartItems = cartData?.booking_details && cartData.booking_details.length > 0;
  const showEmptyState = !newProductData && !hasCartItems;

  if (showEmptyState) {
    return (
      <div className="min-h-screen bg-gray-50">
        <FixedNavbar />
        <div className="container mx-auto px-4 py-8 pt-20 md:pt-24">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">Nessun prodotto nel carrello.</p>
                <Button onClick={() => navigate('/')}>Torna alla home</Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FixedNavbar />
      
      <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-4xl">
        {hasCartItems && (
          <Button variant="ghost" onClick={() => navigate('/cart')} className="mb-6 flex gap-2 items-center">
            <ArrowLeft className="h-4 w-4" /> Torna al carrello
          </Button>
        )}

        <h1 className="text-3xl font-bold mb-8">Dettagli Prenotazione</h1>
        <p className="text-gray-600 mb-8">
          Seleziona la modalità di ritiro e le fasce orarie per ogni prodotto.
        </p>

        <div className="space-y-6">
          {/* Nuovo prodotto da aggiungere */}
          {newProductData && (
            <Card className="mb-6 border-2 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-blue-600">Nuovo prodotto</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Riepilogo Prodotto */}
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    <img 
                      src={newProductData.product.images?.[0] || DEFAULT_IMAGES.PRODUCT} 
                      alt={newProductData.product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_IMAGES.PRODUCT;
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{newProductData.product.name}</h3>
                    {newProductData.product.product_brand?.name && (
                      <p className="text-sm text-gray-600">Marca: {newProductData.product.product_brand.name}</p>
                    )}
                    {newProductData.product.product_model?.name && (
                      <p className="text-sm text-gray-600">Modello: {newProductData.product.product_model.name}</p>
                    )}
                  </div>
                </div>

                {/* Dettagli Prenotazione */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Periodo di noleggio
                  </h4>
                  <p className="text-sm text-gray-600">
                    Dal {format(newProductData.startDate, "dd MMMM yyyy", { locale: it })} al{" "}
                    {format(newProductData.endDate, "dd MMMM yyyy", { locale: it })}
                  </p>
                </div>

                {/* Modalità di Ritiro */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Modalità di Ritiro
                  </h4>
                  <div className="flex gap-4">
                    {newProductData.product.can_be_picked_up && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="newProductDeliveryMethod"
                          value="pickup"
                          checked={newProductData.formData.deliveryMethod === 'pickup'}
                          onChange={(e) => {
                            setNewProductData(prev => prev ? {
                              ...prev,
                              formData: { ...prev.formData, deliveryMethod: e.target.value as 'pickup' | 'delivery' | '' }
                            } : null);
                          }}
                          className="w-4 h-4"
                        />
                        <MapPin className="h-4 w-4" />
                        <span>Ritiro in sede</span>
                      </label>
                    )}
                    {newProductData.product.can_be_delivered && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="newProductDeliveryMethod"
                          value="delivery"
                          checked={newProductData.formData.deliveryMethod === 'delivery'}
                          onChange={(e) => {
                            setNewProductData(prev => prev ? {
                              ...prev,
                              formData: { ...prev.formData, deliveryMethod: e.target.value as 'pickup' | 'delivery' | '' }
                            } : null);
                          }}
                          className="w-4 h-4"
                        />
                        <Home className="h-4 w-4" />
                        <span>Consegna a domicilio</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Fasce Orarie (solo per pickup e non stesso giorno) */}
                {newProductData.formData.deliveryMethod === 'pickup' && !isSameDay(newProductData.startDate, newProductData.endDate) && (
                  <>
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Fascia Oraria Ritiro
                      </h4>
                      <Select
                        value={newProductData.formData.pickupTimeSlot}
                        onValueChange={(value) => {
                          setNewProductData(prev => prev ? {
                            ...prev,
                            formData: { ...prev.formData, pickupTimeSlot: value }
                          } : null);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleziona fascia oraria" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((slot) => (
                            <SelectItem key={slot.value} value={slot.value}>
                              {slot.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Fascia Oraria Riconsegna
                      </h4>
                      <Select
                        value={newProductData.formData.returnTimeSlot}
                        onValueChange={(value) => {
                          setNewProductData(prev => prev ? {
                            ...prev,
                            formData: { ...prev.formData, returnTimeSlot: value }
                          } : null);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleziona fascia oraria" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((slot) => (
                            <SelectItem key={slot.value} value={slot.value}>
                              {slot.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Bottone Aggiungi al Carrello */}
                <div className="border-t pt-4">
                  <Button
                    onClick={handleAddToCart}
                    disabled={isAddingToCart}
                    className="w-full text-white"
                    style={{ backgroundColor: '#E31E24', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#C01A1F')}
                    onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E31E24')}
                  >
                    {isAddingToCart ? "Aggiunta in corso..." : "Aggiungi al carrello"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prodotti già nel carrello */}
          {hasCartItems && cartData.booking_details.map((detail) => {
            const product = detail.products;
            const formData = detailsFormData[detail.id] || {
              deliveryMethod: '',
              pickupTimeSlot: '',
              returnTimeSlot: '',
            };
            const startDate = new Date(detail.start_date);
            const endDate = new Date(detail.end_date);
            const isSameDayBooking = isSameDay(startDate, endDate);

            return (
              <Card key={detail.id} className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    {product?.name || 'Prodotto'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Riepilogo Prodotto */}
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      <img 
                        src={product?.images?.[0] || DEFAULT_IMAGES.PRODUCT} 
                        alt={product?.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_IMAGES.PRODUCT;
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">{product?.name}</h3>
                      {product?.brand && (
                        <p className="text-sm text-gray-600">Marca: {product.brand}</p>
                      )}
                      {product?.model && (
                        <p className="text-sm text-gray-600">Modello: {product.model}</p>
                      )}
                    </div>
                  </div>

                  {/* Dettagli Prenotazione */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Periodo di noleggio
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Data inizio:</span>
                        <p className="font-medium">
                          {format(startDate, "dd MMMM yyyy", { locale: it })}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Data fine:</span>
                        <p className="font-medium">
                          {format(endDate, "dd MMMM yyyy", { locale: it })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Selezione Modalità di Ritiro */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Modalità di Ritiro
                    </h4>
                    <div className="space-y-3">
                      {product?.can_be_picked_up && (
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            id={`pickup-${detail.id}`}
                            name={`deliveryMethod-${detail.id}`}
                            value="pickup"
                            checked={formData.deliveryMethod === 'pickup'}
                            onChange={(e) => {
                              const newFormData = {
                                ...formData,
                                deliveryMethod: e.target.value as 'pickup',
                              };
                              handleUpdateDetail(detail.id, newFormData);
                            }}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                          />
                          <label htmlFor={`pickup-${detail.id}`} className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            Ritiro in sede
                          </label>
                        </div>
                      )}
                      
                      {product?.can_be_delivered && (
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            id={`delivery-${detail.id}`}
                            name={`deliveryMethod-${detail.id}`}
                            value="delivery"
                            checked={formData.deliveryMethod === 'delivery'}
                            onChange={(e) => {
                              const newFormData = {
                                ...formData,
                                deliveryMethod: e.target.value as 'delivery',
                              };
                              handleUpdateDetail(detail.id, newFormData);
                            }}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                          />
                          <label htmlFor={`delivery-${detail.id}`} className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            Consegna a domicilio
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selezione Fasce Orarie - Solo per ritiro in sede e non stesso giorno */}
                  {formData.deliveryMethod === 'pickup' && !isSameDayBooking && (
                    <>
                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Fascia Oraria Ritiro
                        </h4>
                        <Select
                          value={formData.pickupTimeSlot}
                          onValueChange={(value) => {
                            const newFormData = {
                              ...formData,
                              pickupTimeSlot: value,
                            };
                            handleUpdateDetail(detail.id, newFormData);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleziona fascia oraria" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((slot) => (
                              <SelectItem key={slot.value} value={slot.value}>
                                {slot.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Fascia Oraria Riconsegna
                        </h4>
                        <Select
                          value={formData.returnTimeSlot}
                          onValueChange={(value) => {
                            const newFormData = {
                              ...formData,
                              returnTimeSlot: value,
                            };
                            handleUpdateDetail(detail.id, newFormData);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleziona fascia oraria" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((slot) => (
                              <SelectItem key={slot.value} value={slot.value}>
                                {slot.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottone Continua - Solo se ci sono prodotti nel carrello */}
        {hasCartItems && (
          <div className="mt-8 flex justify-end">
            <Button
              onClick={handleContinue}
              className="text-white px-8 py-6 text-lg font-semibold"
              style={{ backgroundColor: '#E31E24', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#C01A1F'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E31E24'}
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Continua al Carrello
            </Button>
          </div>
        )}
      </div>
      
      <Footer />
    </div>
  );
}

