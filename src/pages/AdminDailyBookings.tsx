import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar as CalendarIcon, ArrowLeft, Clock, ArrowRight, Search, X, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import { format, parseISO, startOfDay, endOfDay, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn, toItalianISOString } from "@/lib/utils";

interface BookingDetail {
  booking_id: string;
  rifPrenotazione: number;
  start_date: string;
  end_date: string;
  product_title: string;
  user_name: string;
  status: string;
  delivery_method: string;
  price_total: number;
  products_status?: string; // Stato dei prodotti: 'Da ritirare', 'Parz. ritirato', 'Ritirato', 'Parz. consegnato', 'Consegnato'
}

interface BookingDetailInformation {
  id: string;
  information_id: string;
  value: string;
  information?: {
    id: string;
    name: string;
    type: string;
  };
}

interface BookingItem {
  id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  status: string | null;
  product_title: string;
  product_brand: string;
  product_model: string;
  price: number;
  informations?: BookingDetailInformation[];
}

const AdminDailyBookings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  // Initialize with today's date in YYYY-MM-DD format
  const today = format(new Date(), "yyyy-MM-dd");
  // Check if we have a date from navigation state
  const dateFromState = location.state?.date;
  const [searchDate, setSearchDate] = useState<string>(dateFromState || today);
  const [searchTermStart, setSearchTermStart] = useState<string>("");
  const [searchTermEnd, setSearchTermEnd] = useState<string>("");
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [bookingDetailsData, setBookingDetailsData] = useState<any[]>([]); // Store filtered booking_details
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [bookingItems, setBookingItems] = useState<BookingItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [bookingSection, setBookingSection] = useState<'start' | 'end' | null>(null); // 'start' = Inizi Noleggio, 'end' = Fine Noleggi
  const [selectedBookingStatus, setSelectedBookingStatus] = useState<string | null>(null);
  const [showOtherItems, setShowOtherItems] = useState(false);

  // Auto-search when date changes
  useEffect(() => {
    if (searchDate) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDate]);

  const handleSearch = async () => {
    if (!searchDate) {
      setError("Inserisci una data");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Convert search date to start and end of day in ISO format
      const selectedDate = new Date(searchDate + "T00:00:00");
      const dayStart = toItalianISOString(startOfDay(selectedDate));
      const dayEnd = toItalianISOString(endOfDay(selectedDate));

      console.log("Searching for date:", searchDate);
      console.log("Day range:", dayStart, "to", dayEnd);

      // Query booking_details where start_date or end_date falls on the selected day
      // We query for overlapping dates, then filter in JavaScript for exact day match
      const { data: bookingDetails, error: detailsError } = await supabase
        .from("booking_details")
        .select("booking_id, unit_id, start_date, end_date, status")
        .lte("start_date", dayEnd)
        .gte("end_date", dayStart)
        .order("start_date", { ascending: true });

      if (detailsError) {
        console.error("Error fetching booking_details:", detailsError);
        throw detailsError;
      }

      if (!bookingDetails || bookingDetails.length === 0) {
        setBookings([]);
        return;
      }

      // Filter to only include booking_details where start_date or end_date is exactly on the selected day
      const selectedDayStart = startOfDay(selectedDate);
      const filteredDetails = bookingDetails.filter((detail: any) => {
        const startDate = new Date(detail.start_date);
        const endDate = new Date(detail.end_date);
        
        const startDay = startOfDay(startDate);
        const endDay = startOfDay(endDate);
        
        return startDay.getTime() === selectedDayStart.getTime() || 
               endDay.getTime() === selectedDayStart.getTime();
      });

      if (filteredDetails.length === 0) {
        setBookings([]);
        return;
      }

      // Get unique booking IDs from filtered details
      const bookingIds = [...new Set(filteredDetails.map((d: any) => d.booking_id))];

      // Fetch booking information
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, rifPrenotazione, status, user_id, delivery_method, price_total, cart")
        .in("id", bookingIds)
        .eq("cart", false); // Exclude cart bookings

      if (bookingsError) {
        console.error("Error fetching bookings:", bookingsError);
        throw bookingsError;
      }

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        return;
      }

      // Get user names
      const userIds = [...new Set(bookingsData.map((b: any) => b.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);

      const profilesMap = new Map(
        (profilesData || []).map((p: any) => [
          p.id,
          `${p.first_name || ""} ${p.last_name || ""}`.trim(),
        ])
      );

      // Get product titles from booking_details -> unit_id -> product_variant -> product
      const unitIds = [...new Set(filteredDetails.map((d: any) => d.unit_id).filter(Boolean))];
      let productsMap = new Map();

      if (unitIds.length > 0) {
        const { data: productUnits } = await supabase
          .from("product_units")
          .select("id, id_product_variant")
          .in("id", unitIds);

        if (productUnits && productUnits.length > 0) {
          const variantIds = [...new Set(productUnits.map((u: any) => u.id_product_variant).filter(Boolean))];
          
          if (variantIds.length > 0) {
            const { data: variants } = await supabase
              .from("product_variants")
              .select("id, id_product")
              .in("id", variantIds);

            if (variants && variants.length > 0) {
              const productIds = [...new Set(variants.map((v: any) => v.id_product))];
              const unitToVariantMap = new Map(productUnits.map((u: any) => [u.id, u.id_product_variant]));
              const variantToProductMap = new Map(variants.map((v: any) => [v.id, v.id_product]));

              const { data: productsData } = await supabase
                .from("products")
                .select("id, name")
                .in("id", productIds);

              const productMap = new Map((productsData || []).map((p: any) => [p.id, p.name]));

              // Map booking_id to product name (use first product found for each booking)
              filteredDetails.forEach((detail: any) => {
                const unitId = detail.unit_id;
                const variantId = unitToVariantMap.get(unitId);
                const productId = variantId ? variantToProductMap.get(variantId) : null;
                if (productId && !productsMap.has(detail.booking_id)) {
                  productsMap.set(detail.booking_id, productMap.get(productId) || "Prodotto sconosciuto");
                }
              });
            }
          }
        }
      }

      // Get all booking_details for these bookings to calculate products status
      const { data: allBookingDetails } = await supabase
        .from("booking_details")
        .select("booking_id, status")
        .in("booking_id", bookingIds);

      // Calculate products status for each booking
      const productsStatusMap = new Map<string, string>();
      if (allBookingDetails) {
        const detailsByBooking = new Map<string, string[]>();
        allBookingDetails.forEach((detail: any) => {
          if (!detailsByBooking.has(detail.booking_id)) {
            detailsByBooking.set(detail.booking_id, []);
          }
          detailsByBooking.get(detail.booking_id)?.push(detail.status || 'toPickup');
        });

        detailsByBooking.forEach((statuses, bookingId) => {
          const booking = bookingsData.find((b: any) => b.id === bookingId);
          if (booking) {
            // Normalizza gli status: gestisce sia 'to_pickup' che 'toPickup' (compatibilità)
            const normalizedStatuses = statuses.map((s: string) => {
              if (!s || s === 'to_pickup' || s === 'toPickup' || s === 'idle') return 'toPickup';
              if (s === 'picked_up') return 'pickedUp';
              return s;
            });
            
            const allToPickup = normalizedStatuses.every((s: string) => s === 'toPickup');
            const allPickedUp = normalizedStatuses.every((s: string) => s === 'pickedUp');
            const allReturned = normalizedStatuses.every((s: string) => s === 'returned');
            const somePickedUp = normalizedStatuses.some((s: string) => s === 'pickedUp');
            const someReturned = normalizedStatuses.some((s: string) => s === 'returned');
            
            // Solo per prenotazioni confermate o completate
            if (booking.status === 'confirmed' || booking.status === 'completed') {
              if (allReturned && normalizedStatuses.length > 0) {
                productsStatusMap.set(bookingId, 'Consegnato');
              } else if (someReturned && !allReturned && normalizedStatuses.length > 0) {
                productsStatusMap.set(bookingId, 'Parz. consegnato');
              } else if (allPickedUp && normalizedStatuses.length > 0) {
                productsStatusMap.set(bookingId, 'Ritirato');
              } else if (somePickedUp && !allPickedUp && normalizedStatuses.length > 0) {
                productsStatusMap.set(bookingId, 'Parz. ritirato');
              } else if (allToPickup && normalizedStatuses.length > 0) {
                productsStatusMap.set(bookingId, 'Da ritirare');
              }
            }
          }
        });
      }

      // Store all booking_details for this booking to find min/max dates
      const detailsByBookingId = new Map<string, any[]>();
      filteredDetails.forEach((detail: any) => {
        if (!detailsByBookingId.has(detail.booking_id)) {
          detailsByBookingId.set(detail.booking_id, []);
        }
        detailsByBookingId.get(detail.booking_id)?.push(detail);
      });

      // Combine data - store all details for each booking
      const bookingsWithDetails: BookingDetail[] = bookingsData.map((booking: any) => {
        const bookingDetailsForBooking = detailsByBookingId.get(booking.id) || [];
        // Find min start_date and max end_date from all details for this booking
        const minStartDate = bookingDetailsForBooking.length > 0
          ? bookingDetailsForBooking.reduce((min, d) => 
              new Date(d.start_date) < new Date(min.start_date) ? d : min
            ).start_date
          : "";
        const maxEndDate = bookingDetailsForBooking.length > 0
          ? bookingDetailsForBooking.reduce((max, d) => 
              new Date(d.end_date) > new Date(max.end_date) ? d : max
            ).end_date
          : "";

        return {
          booking_id: booking.id,
          rifPrenotazione: booking.rifPrenotazione,
          start_date: minStartDate,
          end_date: maxEndDate,
          product_title: productsMap.get(booking.id) || "Prodotto sconosciuto",
          user_name: profilesMap.get(booking.user_id) || "Utente sconosciuto",
          status: booking.status,
          delivery_method: booking.delivery_method,
          price_total: booking.price_total,
          products_status: productsStatusMap.get(booking.id) || undefined,
        };
      });

      setBookings(bookingsWithDetails);
      setBookingDetailsData(filteredDetails); // Store filtered booking_details for filtering
    } catch (err) {
      console.error("Error searching bookings:", err);
      setError(err instanceof Error ? err.message : "Errore nella ricerca");
      setBookings([]);
      setBookingDetailsData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Separate bookings into starts and ends, with independent search filters
  // startBookings: tutte le prenotazioni che hanno ALMENO un prodotto con data di inizio noleggio uguale alla data selezionata
  const startBookings = useMemo(() => {
    if (!searchDate || bookingDetailsData.length === 0) return [];
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    
    // Find all booking_ids that have at least one product with start_date on the selected day
    const bookingIdsWithStartOnDate = new Set(
      bookingDetailsData
        .filter((detail: any) => {
          const startDate = new Date(detail.start_date);
          const startDay = startOfDay(startDate);
          return startDay.getTime() === selectedDayStart.getTime();
        })
        .map((detail: any) => detail.booking_id)
    );

    // Filter bookings to only include those with at least one product starting on the selected date
    let filtered = bookings.filter((booking) => 
      bookingIdsWithStartOnDate.has(booking.booking_id)
    );

    // Apply search filter if searchTermStart is provided
    if (searchTermStart.trim()) {
      const term = searchTermStart.toLowerCase().trim();
      filtered = filtered.filter((booking) => {
        const rifStr = booking.rifPrenotazione.toString();
        const userStr = booking.user_name.toLowerCase();
        const productStr = booking.product_title.toLowerCase();
        return rifStr.includes(term) || 
               userStr.includes(term) || 
               productStr.includes(term);
      });
    }

    // Ordina le prenotazioni: prima quelle da ritirare/parz. ritirate, poi quelle completamente ritirate
    // All'interno di ciascun gruppo, ordina per numero prenotazione crescente
    const toPickup = filtered.filter(b => 
      b.products_status === 'Da ritirare' || 
      b.products_status === 'Parz. ritirato'
    ).sort((a, b) => a.rifPrenotazione - b.rifPrenotazione);
    
    const pickedUp = filtered.filter(b => 
      b.products_status === 'Ritirato' || 
      b.products_status === 'Parz. consegnato' ||
      b.products_status === 'Consegnato'
    ).sort((a, b) => a.rifPrenotazione - b.rifPrenotazione);

    return [...toPickup, ...pickedUp];
  }, [bookings, bookingDetailsData, searchDate, searchTermStart]);

  // endBookings: tutte le prenotazioni che hanno ALMENO un prodotto con fine noleggio uguale alla data selezionata
  const endBookings = useMemo(() => {
    if (!searchDate || bookingDetailsData.length === 0) return [];
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    
    // Find all booking_ids that have at least one product with end_date on the selected day
    const bookingIdsWithEndOnDate = new Set(
      bookingDetailsData
        .filter((detail: any) => {
          const endDate = new Date(detail.end_date);
          const endDay = startOfDay(endDate);
          return endDay.getTime() === selectedDayStart.getTime();
        })
        .map((detail: any) => detail.booking_id)
    );

    // Filter bookings to only include those with at least one product ending on the selected date
    let filtered = bookings.filter((booking) => 
      bookingIdsWithEndOnDate.has(booking.booking_id)
    );

    // Apply search filter if searchTermEnd is provided
    if (searchTermEnd.trim()) {
      const term = searchTermEnd.toLowerCase().trim();
      filtered = filtered.filter((booking) => {
        const rifStr = booking.rifPrenotazione.toString();
        const userStr = booking.user_name.toLowerCase();
        const productStr = booking.product_title.toLowerCase();
        return rifStr.includes(term) || 
               userStr.includes(term) || 
               productStr.includes(term);
      });
    }

    // Mostra tutte le prenotazioni indipendentemente dallo stato, ordinate per numero prenotazione crescente
    return filtered.sort((a, b) => a.rifPrenotazione - b.rifPrenotazione);
  }, [bookings, bookingDetailsData, searchDate, searchTermEnd]);

  // Determine which quick button is active
  const getActiveButton = () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
    const dayAfterTomorrowStr = format(addDays(new Date(), 2), "yyyy-MM-dd");
    
    if (searchDate === todayStr) return "today";
    if (searchDate === tomorrowStr) return "tomorrow";
    if (searchDate === dayAfterTomorrowStr) return "dayAfterTomorrow";
    return null;
  };

  const activeButton = getActiveButton();

  // Convert searchDate string to Date object for Calendar
  const selectedDate = useMemo(() => {
    if (!searchDate) return new Date();
    try {
      return new Date(searchDate + "T00:00:00");
    } catch {
      return new Date();
    }
  }, [searchDate]);

  // Handle date selection from Calendar
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const dateString = format(date, "yyyy-MM-dd");
      setSearchDate(dateString);
      // handleSearch will be called automatically via useEffect
    }
  };

  // Quick date buttons
  const setToday = () => {
    setSearchDate(format(new Date(), "yyyy-MM-dd"));
  };

  const setTomorrow = () => {
    setSearchDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  };

  const setDayAfterTomorrow = () => {
    setSearchDate(format(addDays(new Date(), 2), "yyyy-MM-dd"));
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd/MM/yyyy HH:mm", { locale: it });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'cart':
        return <Badge variant="secondary">Nel carrello</Badge>;
      case 'confirmed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">Confermata</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annullata</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">Completata</Badge>;
      case 'inPayment':
        return <Badge variant="secondary">Pagamento in corso</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getProductsStatusBadge = (productsStatus?: string) => {
    if (!productsStatus) return null;
    
    switch (productsStatus) {
      case 'Da ritirare':
        return <Badge variant="secondary" className="bg-red-900 text-red-100 border-red-800">Da ritirare</Badge>;
      case 'Parz. ritirato':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">Parz. ritirato</Badge>;
      case 'Ritirato':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">Ritirato</Badge>;
      case 'Parz. consegnato':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">Parz. consegnato</Badge>;
      case 'Consegnato':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">Consegnato</Badge>;
      default:
        return null;
    }
  };

  // Verifica se tutti i prodotti con start_date nella data selezionata sono già stati ritirati
  const areAllStartProductsPickedUp = (bookingId: string): boolean => {
    if (!searchDate || bookingDetailsData.length === 0) return false;
    
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    
    // Filtra i booking_details per questa prenotazione che hanno start_date nella data selezionata
    const startDetailsForBooking = bookingDetailsData.filter((detail: any) => {
      if (detail.booking_id !== bookingId) return false;
      const startDate = new Date(detail.start_date);
      const startDay = startOfDay(startDate);
      return startDay.getTime() === selectedDayStart.getTime();
    });
    
    if (startDetailsForBooking.length === 0) return false;
    
    // Verifica se tutti i prodotti sono già stati ritirati (pickedUp o returned)
    const allPickedUp = startDetailsForBooking.every((detail: any) => {
      const status = detail.status;
      // Normalizza gli status
      if (!status || status === 'to_pickup' || status === 'toPickup' || status === 'idle') return false;
      return status === 'pickedUp' || status === 'picked_up' || status === 'returned';
    });
    
    return allPickedUp;
  };

  // Verifica se ci sono prodotti con end_date nella data selezionata che non sono stati ancora ritirati
  const hasEndProductsNotPickedUp = (bookingId: string): boolean => {
    if (!searchDate || bookingDetailsData.length === 0) return false;
    
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    
    // Filtra i booking_details per questa prenotazione che hanno end_date nella data selezionata
    const endDetailsForBooking = bookingDetailsData.filter((detail: any) => {
      if (detail.booking_id !== bookingId) return false;
      const endDate = new Date(detail.end_date);
      const endDay = startOfDay(endDate);
      return endDay.getTime() === selectedDayStart.getTime();
    });
    
    if (endDetailsForBooking.length === 0) return false;
    
    // Verifica se c'è almeno un prodotto che non è stato ancora ritirato
    const hasNotPickedUp = endDetailsForBooking.some((detail: any) => {
      const status = detail.status;
      // Normalizza gli status - se è null, to_pickup, toPickup o idle, non è stato ritirato
      if (!status || status === 'to_pickup' || status === 'toPickup' || status === 'idle') return true;
      // Se è pickedUp, picked_up o returned, è stato ritirato
      return !(status === 'pickedUp' || status === 'picked_up' || status === 'returned');
    });
    
    return hasNotPickedUp;
  };

  // Conta i prodotti da ritirare con start_date nella data selezionata
  const countProductsToPickup = (bookingId: string): number => {
    if (!searchDate || bookingDetailsData.length === 0) return 0;
    
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    
    // Filtra i booking_details per questa prenotazione che hanno start_date nella data selezionata
    const startDetailsForBooking = bookingDetailsData.filter((detail: any) => {
      if (detail.booking_id !== bookingId) return false;
      const startDate = new Date(detail.start_date);
      const startDay = startOfDay(startDate);
      return startDay.getTime() === selectedDayStart.getTime();
    });
    
    // Conta i prodotti che non sono ancora stati ritirati
    const toPickupCount = startDetailsForBooking.filter((detail: any) => {
      const status = detail.status;
      // Prodotti da ritirare: null, to_pickup, toPickup, idle
      return !status || status === 'to_pickup' || status === 'toPickup' || status === 'idle';
    }).length;
    
    return toPickupCount;
  };

  // Conta i prodotti da riconsegnare con end_date nella data selezionata
  const countProductsToReturn = (bookingId: string): number => {
    if (!searchDate || bookingDetailsData.length === 0) return 0;
    
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    
    // Filtra i booking_details per questa prenotazione che hanno end_date nella data selezionata
    const endDetailsForBooking = bookingDetailsData.filter((detail: any) => {
      if (detail.booking_id !== bookingId) return false;
      const endDate = new Date(detail.end_date);
      const endDay = startOfDay(endDate);
      return endDay.getTime() === selectedDayStart.getTime();
    });
    
    // Conta i prodotti che sono stati ritirati ma non ancora riconsegnati
    const toReturnCount = endDetailsForBooking.filter((detail: any) => {
      const status = detail.status;
      // Prodotti da riconsegnare: pickedUp o picked_up ma non returned
      return status === 'pickedUp' || status === 'picked_up';
    }).length;
    
    return toReturnCount;
  };

  // Carica gli articoli della prenotazione
  const fetchBookingItems = async (bookingId: string) => {
    try {
      setIsLoadingItems(true);
      
      // Carica anche lo status della prenotazione se non è già stato caricato
      if (!selectedBookingStatus) {
        const { data: bookingData } = await supabase
          .from('bookings')
          .select('status')
          .eq('id', bookingId)
          .single();
        
        if (bookingData) {
          setSelectedBookingStatus(bookingData.status);
        }
      }
      
      // Fetch booking_details
      const { data: detailsData, error: detailsError } = await supabase
        .from('booking_details')
        .select('id, unit_id, start_date, end_date, status, price')
        .eq('booking_id', bookingId);

      if (detailsError) {
        console.error('Error fetching booking_details:', detailsError);
        throw detailsError;
      }

      if (!detailsData || detailsData.length === 0) {
        setBookingItems([]);
        return;
      }

      // Get product data for each detail
      const unitIds = [...new Set(detailsData.map(d => d.unit_id).filter(Boolean))] as string[];
      
      if (unitIds.length > 0) {
        // Get product_units
        const { data: productUnits, error: unitsError } = await supabase
          .from('product_units')
          .select('id, id_product_variant')
          .in('id', unitIds);

        if (!unitsError && productUnits && productUnits.length > 0) {
          const variantIds = [...new Set(productUnits.map((u: any) => u.id_product_variant).filter(Boolean))];
          
          // Get variants
          const { data: variants, error: variantsError } = await supabase
            .from('product_variants')
            .select('id, id_product')
            .in('id', variantIds);

          if (!variantsError && variants && variants.length > 0) {
            const productIdsFromVariants = [...new Set(variants.map((v: any) => v.id_product).filter(Boolean))];
            
            // Get products
            const { data: productsData, error: productsError } = await supabase
              .from('products')
              .select(`
                id,
                name,
                product_brand:id_brand(id, name),
                product_model:id_model(id, name)
              `)
              .in('id', productIdsFromVariants);

            if (!productsError && productsData) {
              // Create maps: unit_id -> variant_id -> product_id -> product
              const unitToVariantMap = new Map((productUnits || []).map((u: any) => [u.id, u.id_product_variant]));
              const variantToProductMap = new Map((variants || []).map((v: any) => [v.id, v.id_product]));
              const productsMapById = new Map((productsData || []).map((p: any) => [p.id, {
                title: p.name,
                brand: p.product_brand?.name || '',
                model: p.product_model?.name || '',
              }]));

              // Map booking_details to products
              const itemsWithProducts: BookingItem[] = detailsData.map((detail: any) => {
                const variantId = unitToVariantMap.get(detail.unit_id);
                const productId = variantId ? variantToProductMap.get(variantId) : null;
                const product = productId ? productsMapById.get(productId) : null;
                
                return {
                  id: detail.id,
                  unit_id: detail.unit_id,
                  start_date: detail.start_date,
                  end_date: detail.end_date,
                  status: detail.status || null,
                  product_title: product?.title || 'Prodotto non trovato',
                  product_brand: product?.brand || '',
                  product_model: product?.model || '',
                  price: detail.price || 0,
                  informations: [],
                };
              });

              // Fetch booking_details_informations for all details
              const detailIds = itemsWithProducts.map(d => d.id);
              let informationsMap = new Map<string, BookingDetailInformation[]>();
              
              if (detailIds.length > 0) {
                const { data: bookingDetailsInformations, error: informationsError } = await supabase
                  .from("booking_details_informations")
                  .select(`
                    id,
                    booking_details_id,
                    information_id,
                    value,
                    informations:information_id (
                      id,
                      name,
                      type
                    )
                  `)
                  .in("booking_details_id", detailIds);

                if (!informationsError && bookingDetailsInformations) {
                  // Raggruppa per booking_details_id
                  bookingDetailsInformations.forEach((info: any) => {
                    const detailId = String(info.booking_details_id);
                    if (!informationsMap.has(detailId)) {
                      informationsMap.set(detailId, []);
                    }
                    
                    let informationObj = null;
                    if (info.informations) {
                      if (Array.isArray(info.informations) && info.informations.length > 0) {
                        informationObj = info.informations[0];
                      } else if (typeof info.informations === 'object') {
                        informationObj = info.informations;
                      }
                    }
                    
                    informationsMap.get(detailId)!.push({
                      id: info.id,
                      information_id: String(info.information_id),
                      value: info.value,
                      information: informationObj ? {
                        id: String(informationObj.id),
                        name: informationObj.name,
                        type: String(informationObj.type)
                      } : undefined
                    });
                  });
                } else if (informationsError) {
                  console.error('Error fetching booking_details_informations:', informationsError);
                }
              }

              // Aggiungi informations a ogni item
              const itemsWithInformations = itemsWithProducts.map(item => ({
                ...item,
                informations: informationsMap.get(String(item.id)) || []
              }));

              setBookingItems(itemsWithInformations);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching booking items:', err);
      setBookingItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Gestisce l'apertura del popup
  const handleBookingClick = async (bookingId: string, section: 'start' | 'end') => {
    setSelectedBookingId(bookingId);
    setBookingSection(section);
    
    // Carica lo status della prenotazione
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .single();
    
    if (bookingData) {
      setSelectedBookingStatus(bookingData.status);
    }
    
    fetchBookingItems(bookingId);
  };

  // Verifica se un articolo deve essere ritirato nella data selezionata
  const isItemToPickupToday = (item: BookingItem): boolean => {
    if (!searchDate) return false;
    
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    const itemStartDate = new Date(item.start_date);
    const itemStartDay = startOfDay(itemStartDate);
    
    // Verifica se la data di inizio coincide con la data selezionata
    const isStartDateToday = itemStartDay.getTime() === selectedDayStart.getTime();
    
    // Verifica se il prodotto non è ancora stato ritirato
    const status = item.status;
    const isNotPickedUp = !status || status === 'to_pickup' || status === 'toPickup' || status === 'idle';
    
    return isStartDateToday && isNotPickedUp;
  };

  // Verifica se un articolo è stato ritirato
  const isItemPickedUp = (item: BookingItem): boolean => {
    const status = item.status;
    return status === 'pickedUp' || status === 'picked_up';
  };

  // Verifica se un articolo ritirato ha la data di inizio nella data selezionata
  const isPickedUpItemToday = (item: BookingItem): boolean => {
    if (!searchDate || !isItemPickedUp(item)) return false;
    
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    const itemStartDate = new Date(item.start_date);
    const itemStartDay = startOfDay(itemStartDate);
    
    return itemStartDay.getTime() === selectedDayStart.getTime();
  };

  // Verifica se un articolo deve essere riconsegnato nella data selezionata
  const isItemToReturnToday = (item: BookingItem): boolean => {
    if (!searchDate) return false;
    
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    const itemEndDate = new Date(item.end_date);
    const itemEndDay = startOfDay(itemEndDate);
    
    // Verifica se la data di fine coincide con la data selezionata
    const isEndDateToday = itemEndDay.getTime() === selectedDayStart.getTime();
    
    // Verifica se il prodotto è stato ritirato ma non ancora riconsegnato
    const isPickedUp = isItemPickedUp(item);
    const isNotReturned = item.status !== 'returned';
    
    return isEndDateToday && isPickedUp && isNotReturned;
  };

  // Verifica se un articolo è stato riconsegnato
  const isItemReturned = (item: BookingItem): boolean => {
    return item.status === 'returned';
  };

  // Verifica se un articolo riconsegnato ha la data di fine nella data selezionata
  const isReturnedItemToday = (item: BookingItem): boolean => {
    if (!searchDate || !isItemReturned(item)) return false;
    
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    const itemEndDate = new Date(item.end_date);
    const itemEndDay = startOfDay(itemEndDate);
    
    return itemEndDay.getTime() === selectedDayStart.getTime();
  };

  // Verifica se un articolo NON ha la data di inizio nella data selezionata (per sezione start)
  const isItemNotTodayStart = (item: BookingItem): boolean => {
    if (!searchDate) return false;
    
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    const itemStartDate = new Date(item.start_date);
    const itemStartDay = startOfDay(itemStartDate);
    
    return itemStartDay.getTime() !== selectedDayStart.getTime();
  };

  // Verifica se un articolo NON ha la data di fine nella data selezionata (per sezione end)
  const isItemNotTodayEnd = (item: BookingItem): boolean => {
    if (!searchDate) return false;
    
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    const itemEndDate = new Date(item.end_date);
    const itemEndDay = startOfDay(itemEndDate);
    
    return itemEndDay.getTime() !== selectedDayStart.getTime();
  };

  // Verifica se tutti i prodotti della prenotazione sono stati riconsegnati
  const areAllItemsReturned = (): boolean => {
    if (bookingItems.length === 0) return false;
    return bookingItems.every(item => isItemReturned(item));
  };

  // Completa la prenotazione
  const handleCompleteBooking = async () => {
    if (!selectedBookingId) return;

    try {
      setIsUpdatingStatus(true);
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBookingId);

      if (error) throw error;

      setSelectedBookingStatus('completed');

      toast({
        title: "Prenotazione completata",
        description: "La prenotazione è stata segnata come completata.",
      });

      // Ricarica i dati
      if (searchDate) {
        handleSearch();
      }
    } catch (err) {
      console.error('Error completing booking:', err);
      toast({
        title: "Errore",
        description: "Errore durante il completamento della prenotazione.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Annulla il completamento della prenotazione
  const handleCancelCompleteBooking = async () => {
    if (!selectedBookingId) return;

    try {
      setIsUpdatingStatus(true);
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBookingId);

      if (error) throw error;

      setSelectedBookingStatus('confirmed');

      toast({
        title: "Completamento annullato",
        description: "La prenotazione è stata riportata allo stato confermato.",
      });

      // Ricarica i dati
      if (searchDate) {
        handleSearch();
      }
    } catch (err) {
      console.error('Error canceling complete booking:', err);
      toast({
        title: "Errore",
        description: "Errore durante l'annullamento del completamento.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Ritira un singolo prodotto
  const handlePickupItem = async (itemId: string) => {
    try {
      setIsUpdatingStatus(true);
      
      const { error } = await supabase
        .from('booking_details')
        .update({ status: 'pickedUp' })
        .eq('id', itemId);

      if (error) throw error;

      // Aggiorna lo stato locale
      setBookingItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId ? { ...item, status: 'pickedUp' } : item
        )
      );

      toast({
        title: "Prodotto ritirato",
        description: "Il prodotto è stato segnato come ritirato.",
      });

      // Ricarica i dati della prenotazione per aggiornare la lista
      if (selectedBookingId) {
        fetchBookingItems(selectedBookingId);
      }

      // Aggiorna la lista principale
      if (searchDate) {
        handleSearch();
      }
    } catch (err) {
      console.error('Error picking up item:', err);
      toast({
        title: "Errore",
        description: "Errore durante il ritiro del prodotto.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Ritira tutti i prodotti da ritirare oggi
  const handlePickupAll = async () => {
    if (!selectedBookingId || !searchDate) return;

    const itemsToPickup = bookingItems.filter(item => isItemToPickupToday(item));
    
    if (itemsToPickup.length === 0) {
      toast({
        title: "Nessun prodotto da ritirare",
        description: "Non ci sono prodotti da ritirare per oggi.",
      });
      return;
    }

    try {
      setIsUpdatingStatus(true);
      
      const itemIds = itemsToPickup.map(item => item.id);
      
      const { error } = await supabase
        .from('booking_details')
        .update({ status: 'pickedUp' })
        .in('id', itemIds);

      if (error) throw error;

      // Aggiorna lo stato locale
      setBookingItems(prevItems =>
        prevItems.map(item =>
          isItemToPickupToday(item) ? { ...item, status: 'pickedUp' } : item
        )
      );

      toast({
        title: "Prodotti ritirati",
        description: `${itemsToPickup.length} prodotto/i segnato/i come ritirato/i.`,
      });

      // Ricarica i dati della prenotazione per aggiornare la lista
      if (selectedBookingId) {
        fetchBookingItems(selectedBookingId);
      }

      // Aggiorna la lista principale
      if (searchDate) {
        handleSearch();
      }
    } catch (err) {
      console.error('Error picking up all items:', err);
      toast({
        title: "Errore",
        description: "Errore durante il ritiro dei prodotti.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Annulla il ritiro di un singolo prodotto
  const handleCancelPickupItem = async (itemId: string) => {
    try {
      setIsUpdatingStatus(true);
      
      const { error } = await supabase
        .from('booking_details')
        .update({ status: 'toPickup' })
        .eq('id', itemId);

      if (error) throw error;

      // Aggiorna lo stato locale
      setBookingItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId ? { ...item, status: 'toPickup' } : item
        )
      );

      toast({
        title: "Ritiro annullato",
        description: "Il ritiro del prodotto è stato annullato.",
      });

      // Ricarica i dati della prenotazione per aggiornare la lista
      if (selectedBookingId) {
        fetchBookingItems(selectedBookingId);
      }

      // Aggiorna la lista principale
      if (searchDate) {
        handleSearch();
      }
    } catch (err) {
      console.error('Error canceling pickup item:', err);
      toast({
        title: "Errore",
        description: "Errore durante l'annullamento del ritiro.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Riconsegna un singolo prodotto
  const handleReturnItem = async (itemId: string) => {
    try {
      setIsUpdatingStatus(true);
      
      const { error } = await supabase
        .from('booking_details')
        .update({ status: 'returned' })
        .eq('id', itemId);

      if (error) throw error;

      // Aggiorna lo stato locale
      setBookingItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId ? { ...item, status: 'returned' } : item
        )
      );

      toast({
        title: "Prodotto riconsegnato",
        description: "Il prodotto è stato segnato come riconsegnato.",
      });

      // Ricarica i dati della prenotazione per aggiornare la lista
      if (selectedBookingId) {
        fetchBookingItems(selectedBookingId);
      }

      // Aggiorna la lista principale
      if (searchDate) {
        handleSearch();
      }
    } catch (err) {
      console.error('Error returning item:', err);
      toast({
        title: "Errore",
        description: "Errore durante la riconsegna del prodotto.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Riconsegna tutti i prodotti da riconsegnare oggi
  const handleReturnAll = async () => {
    if (!selectedBookingId || !searchDate) return;

    const itemsToReturn = bookingItems.filter(item => isItemToReturnToday(item));
    
    if (itemsToReturn.length === 0) {
      toast({
        title: "Nessun prodotto da riconsegnare",
        description: "Non ci sono prodotti da riconsegnare per oggi.",
      });
      return;
    }

    try {
      setIsUpdatingStatus(true);
      
      const itemIds = itemsToReturn.map(item => item.id);
      
      const { error } = await supabase
        .from('booking_details')
        .update({ status: 'returned' })
        .in('id', itemIds);

      if (error) throw error;

      // Aggiorna lo stato locale
      setBookingItems(prevItems =>
        prevItems.map(item =>
          isItemToReturnToday(item) ? { ...item, status: 'returned' } : item
        )
      );

      toast({
        title: "Prodotti riconsegnati",
        description: `${itemsToReturn.length} prodotto/i segnato/i come riconsegnato/i.`,
      });

      // Ricarica i dati della prenotazione per aggiornare la lista
      if (selectedBookingId) {
        fetchBookingItems(selectedBookingId);
      }

      // Aggiorna la lista principale
      if (searchDate) {
        handleSearch();
      }
    } catch (err) {
      console.error('Error returning all items:', err);
      toast({
        title: "Errore",
        description: "Errore durante la riconsegna dei prodotti.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Annulla la riconsegna di un singolo prodotto
  const handleCancelReturnItem = async (itemId: string) => {
    try {
      setIsUpdatingStatus(true);
      
      const { error } = await supabase
        .from('booking_details')
        .update({ status: 'pickedUp' })
        .eq('id', itemId);

      if (error) throw error;

      // Aggiorna lo stato locale
      setBookingItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId ? { ...item, status: 'pickedUp' } : item
        )
      );

      toast({
        title: "Riconsegna annullata",
        description: "La riconsegna del prodotto è stata annullata.",
      });

      // Ricarica i dati della prenotazione per aggiornare la lista
      if (selectedBookingId) {
        fetchBookingItems(selectedBookingId);
      }

      // Aggiorna la lista principale
      if (searchDate) {
        handleSearch();
      }
    } catch (err) {
      console.error('Error canceling return item:', err);
      toast({
        title: "Errore",
        description: "Errore durante l'annullamento della riconsegna.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Annulla la riconsegna di tutti i prodotti riconsegnati
  const handleCancelReturnAll = async () => {
    if (!selectedBookingId || !searchDate) return;

    const returnedItemsToday = bookingItems.filter(item => isReturnedItemToday(item));
    
    if (returnedItemsToday.length === 0) {
      toast({
        title: "Nessun prodotto da annullare",
        description: "Non ci sono prodotti riconsegnati da annullare per oggi.",
      });
      return;
    }

    try {
      setIsUpdatingStatus(true);
      
      const itemIds = returnedItemsToday.map(item => item.id);
      
      const { error } = await supabase
        .from('booking_details')
        .update({ status: 'pickedUp' })
        .in('id', itemIds);

      if (error) throw error;

      // Aggiorna lo stato locale
      setBookingItems(prevItems =>
        prevItems.map(item =>
          returnedItemsToday.some(returned => returned.id === item.id) ? { ...item, status: 'pickedUp' } : item
        )
      );

      toast({
        title: "Riconsegne annullate",
        description: `${returnedItemsToday.length} prodotto/i riportato/i allo stato ritirato.`,
      });

      // Ricarica i dati della prenotazione per aggiornare la lista
      if (selectedBookingId) {
        fetchBookingItems(selectedBookingId);
      }

      // Aggiorna la lista principale
      if (searchDate) {
        handleSearch();
      }
    } catch (err) {
      console.error('Error canceling return all items:', err);
      toast({
        title: "Errore",
        description: "Errore durante l'annullamento delle riconsegne.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Annulla il ritiro di tutti i prodotti ritirati
  const handleCancelPickupAll = async () => {
    if (!selectedBookingId || !searchDate) return;

    const pickedUpItems = bookingItems.filter(item => isItemPickedUp(item) && isItemToPickupToday({ ...item, status: 'toPickup' }));
    
    // Filtra solo i prodotti ritirati che hanno start_date nella data selezionata
    const pickedUpItemsToday = bookingItems.filter(item => isPickedUpItemToday(item));
    
    if (pickedUpItemsToday.length === 0) {
      toast({
        title: "Nessun prodotto da annullare",
        description: "Non ci sono prodotti ritirati da annullare per oggi.",
      });
      return;
    }

    try {
      setIsUpdatingStatus(true);
      
      const itemIds = pickedUpItemsToday.map(item => item.id);
      
      const { error } = await supabase
        .from('booking_details')
        .update({ status: 'toPickup' })
        .in('id', itemIds);

      if (error) throw error;

      // Aggiorna lo stato locale
      setBookingItems(prevItems =>
        prevItems.map(item =>
          pickedUpItemsToday.some(picked => picked.id === item.id) ? { ...item, status: 'toPickup' } : item
        )
      );

      toast({
        title: "Ritiri annullati",
        description: `${pickedUpItemsToday.length} prodotto/i riportato/i allo stato da ritirare.`,
      });

      // Ricarica i dati della prenotazione per aggiornare la lista
      if (selectedBookingId) {
        fetchBookingItems(selectedBookingId);
      }

      // Aggiorna la lista principale
      if (searchDate) {
        handleSearch();
      }
    } catch (err) {
      console.error('Error canceling pickup all items:', err);
      toast({
        title: "Errore",
        description: "Errore durante l'annullamento dei ritiri.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminHeader />

      <div className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => navigate("/admin/home")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Indietro
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">
              Noleggi Giornalieri
            </h1>
            <div className="flex-1" />
          </div>

          {/* Search Bar */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Date field */}
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !searchDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {searchDate ? (
                          format(selectedDate, "dd MMMM yyyy", { locale: it })
                        ) : (
                          <span>Seleziona una data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        initialFocus
                        locale={it}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Quick date buttons */}
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 opacity-0">
                    &nbsp;
                  </label>
                  <Button
                    variant={activeButton === "today" ? "default" : "outline"}
                    onClick={setToday}
                    className={`w-full ${
                      activeButton === "today"
                        ? "bg-[#3fafa3] hover:bg-[#3fafa3] text-white font-semibold shadow-md"
                        : ""
                    }`}
                  >
                    Oggi
                  </Button>
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 opacity-0">
                    &nbsp;
                  </label>
                  <Button
                    variant={activeButton === "tomorrow" ? "default" : "outline"}
                    onClick={setTomorrow}
                    className={`w-full ${
                      activeButton === "tomorrow"
                        ? "bg-[#3fafa3] hover:bg-[#3fafa3] text-white font-semibold shadow-md"
                        : ""
                    }`}
                  >
                    Domani
                  </Button>
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 opacity-0">
                    &nbsp;
                  </label>
                  <Button
                    variant={activeButton === "dayAfterTomorrow" ? "default" : "outline"}
                    onClick={setDayAfterTomorrow}
                    className={`w-full ${
                      activeButton === "dayAfterTomorrow"
                        ? "bg-[#3fafa3] hover:bg-[#3fafa3] text-white font-semibold shadow-md"
                        : ""
                    }`}
                  >
                    Dopodomani
                  </Button>
                </div>
              </div>

              {error && (
                <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}

              {isLoading && (
                <div className="mt-4 text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Caricamento...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results - Split in two columns */}
          {!isLoading && searchDate && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Inizi Noleggio - Left Side */}
              <Card>
                <CardHeader className="bg-green-50 border-b-2 border-green-200">
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <ArrowRight className="h-5 w-5" />
                    Inizi Noleggio - Ritiro ({startBookings.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {/* Search bar for ritiri */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Cerca per RIF, cliente, prodotto..."
                        value={searchTermStart}
                        onChange={(e) => setSearchTermStart(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  {startBookings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nessun inizio noleggio per questa data</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {startBookings.map((booking) => {
                        const allPickedUp = areAllStartProductsPickedUp(booking.booking_id);
                        const toPickupCount = countProductsToPickup(booking.booking_id);
                        return (
                          <Card
                            key={`start-${booking.booking_id}`}
                            className={cn(
                              "cursor-pointer hover:shadow-md transition-shadow border-l-4",
                              (booking.products_status === 'Da ritirare' || booking.products_status === 'Parz. ritirato')
                                ? "border-l-orange-500"
                                : "border-l-green-500",
                              allPickedUp && "opacity-50"
                            )}
                            onClick={() => handleBookingClick(booking.booking_id, 'start')}
                          >
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3 flex-wrap">
                                  <span className="font-mono font-bold text-2xl text-blue-600">
                                    #{booking.rifPrenotazione}
                                  </span>
                                  {getStatusBadge(booking.status)}
                                  {getProductsStatusBadge(booking.products_status)}
                                  {toPickupCount > 0 && (
                                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">
                                      {toPickupCount} da ritirare
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-base font-semibold text-gray-800 mb-2">
                                  {booking.user_name}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-green-700">
                                  €{booking.price_total.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Fine Noleggi - Right Side */}
              <Card>
                <CardHeader className="bg-blue-50 border-b-2 border-blue-200">
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    <ArrowLeft className="h-5 w-5" />
                    Fine Noleggi - Riconsegna ({endBookings.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {/* Search bar for riconsegne */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Cerca per RIF, cliente, prodotto..."
                        value={searchTermEnd}
                        onChange={(e) => setSearchTermEnd(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  {endBookings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nessuna fine noleggio per questa data</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {endBookings.map((booking) => {
                        const hasNotPickedUp = hasEndProductsNotPickedUp(booking.booking_id);
                        const toReturnCount = countProductsToReturn(booking.booking_id);
                        const isCompleted = booking.status === 'completed';
                        return (
                          <Card
                            key={`end-${booking.booking_id}`}
                            className={cn(
                              "cursor-pointer hover:shadow-md transition-shadow border-l-4",
                              (booking.products_status === 'Ritirato' || booking.products_status === 'Parz. consegnato')
                                ? "border-l-purple-500"
                                : "border-l-green-500",
                              hasNotPickedUp && "opacity-50",
                              isCompleted && "bg-green-50/30 border-green-200"
                            )}
                            onClick={() => handleBookingClick(booking.booking_id, 'end')}
                          >
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3 flex-wrap">
                                  <span className="font-mono font-bold text-2xl text-blue-600">
                                    #{booking.rifPrenotazione}
                                  </span>
                                  {getStatusBadge(booking.status)}
                                  {getProductsStatusBadge(booking.products_status)}
                                  {toReturnCount > 0 && (
                                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-300">
                                      {toReturnCount} da riconsegnare
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-base font-semibold text-gray-800 mb-2">
                                  {booking.user_name}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-green-700">
                                  €{booking.price_total.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <AdminFooter />

      {/* Popup Articoli Prenotazione */}
      <Dialog open={selectedBookingId !== null} onOpenChange={(open) => {
        if (!open) {
          setSelectedBookingId(null);
          setBookingSection(null);
          setSelectedBookingStatus(null);
          setShowOtherItems(false);
          // Ricarica i dati quando si chiude il popup per aggiornare la lista principale
          if (searchDate) {
            handleSearch();
          }
        }
      }}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] m-0 translate-x-0 translate-y-0 top-[2.5vh] left-[2.5vw] rounded-lg overflow-hidden flex flex-col p-0 [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b bg-white relative pr-12">
            <div className="flex items-center justify-between gap-4">
              {/* Sinistra: Tasto Vai alla prenotazione */}
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedBookingId) {
                    navigate(`/admin/bookings/${selectedBookingId}`, { state: { from: 'daily-bookings', date: searchDate } });
                  }
                }}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
                Vai alla prenotazione
              </Button>

              {/* Centro: Titolo */}
              <DialogTitle className="text-xl font-bold text-center flex-1">
                Articoli Prenotazione #{bookings.find(b => b.booking_id === selectedBookingId)?.rifPrenotazione || ''}
              </DialogTitle>

              {/* Destra: Pulsanti azione */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {/* Pulsanti per sezione Inizi Noleggio */}
                  {bookingSection === 'start' && (
                    <>
                      {bookingItems.some(item => isItemToPickupToday(item)) && (
                        <Button
                          onClick={handlePickupAll}
                          disabled={isUpdatingStatus}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          RITIRA TUTTO
                        </Button>
                      )}
                      {bookingItems.some(item => isPickedUpItemToday(item)) && (
                        <Button
                          onClick={handleCancelPickupAll}
                          disabled={isUpdatingStatus}
                          variant="outline"
                          className="bg-gray-500 hover:bg-gray-600 text-white border-gray-600"
                        >
                          ANNULLA RITIRO TUTTO
                        </Button>
                      )}
                    </>
                  )}
                  {/* Pulsanti per sezione Fine Noleggi */}
                  {bookingSection === 'end' && (
                    <>
                      {bookingItems.some(item => isItemToReturnToday(item)) && (
                        <Button
                          onClick={handleReturnAll}
                          disabled={isUpdatingStatus}
                          className="bg-purple-500 hover:bg-purple-600 text-white"
                        >
                          RICONSEGNA TUTTO
                        </Button>
                      )}
                      {bookingItems.some(item => isReturnedItemToday(item)) && (
                        <Button
                          onClick={handleCancelReturnAll}
                          disabled={isUpdatingStatus}
                          variant="outline"
                          className="bg-gray-500 hover:bg-gray-600 text-white border-gray-600"
                        >
                          ANNULLA RICONSEGNA TUTTO
                        </Button>
                      )}
                    {areAllItemsReturned() && selectedBookingStatus !== 'completed' && (
                      <Button
                        onClick={handleCompleteBooking}
                        disabled={isUpdatingStatus}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        COMPLETA PRENOTAZIONE
                      </Button>
                    )}
                    {areAllItemsReturned() && selectedBookingStatus === 'completed' && (
                      <Button
                        onClick={handleCancelCompleteBooking}
                        disabled={isUpdatingStatus}
                        variant="outline"
                        className="bg-gray-500 hover:bg-gray-600 text-white border-gray-600"
                      >
                        ANNULLA COMPLETAMENTO
                      </Button>
                    )}
                    </>
                  )}
                </div>
                {/* Disclaimer */}
                {((bookingSection === 'start' && (bookingItems.some(item => isItemToPickupToday(item)) || bookingItems.some(item => isPickedUpItemToday(item)))) ||
                  (bookingSection === 'end' && (bookingItems.some(item => isItemToReturnToday(item)) || bookingItems.some(item => isReturnedItemToday(item))))) && (
                  <span className="text-xs text-gray-500">Solo per la giornata odierna</span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedBookingId(null)}
              className="absolute right-2 top-2 h-8 w-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 hover:text-gray-900"
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3">

            {isLoadingItems ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="ml-3 text-gray-600">Caricamento articoli...</p>
              </div>
            ) : bookingItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Nessun articolo trovato per questa prenotazione</p>
              </div>
            ) : (
              <>
                {/* Articoli nella data odierna */}
                <div className="grid grid-cols-2 gap-3">
                  {bookingItems
                    .filter((item) => {
                      if (bookingSection === 'start') {
                        return isItemToPickupToday(item) || isPickedUpItemToday(item);
                      } else {
                        return isItemToReturnToday(item) || isReturnedItemToday(item);
                      }
                    })
                    .sort((a, b) => {
                      if (bookingSection === 'start') {
                        // Ordina: prima quelli da ritirare oggi, poi gli altri
                        const aToPickup = isItemToPickupToday(a);
                        const bToPickup = isItemToPickupToday(b);
                        if (aToPickup && !bToPickup) return -1;
                        if (!aToPickup && bToPickup) return 1;
                      } else if (bookingSection === 'end') {
                        // Ordina: prima quelli da riconsegnare oggi, poi gli altri
                        const aToReturn = isItemToReturnToday(a);
                        const bToReturn = isItemToReturnToday(b);
                        if (aToReturn && !bToReturn) return -1;
                        if (!aToReturn && bToReturn) return 1;
                      }
                      return 0;
                    })
                    .map((item) => {
                    const isToPickup = isItemToPickupToday(item);
                    const isToReturn = isItemToReturnToday(item);
                    return (
                      <Card
                        key={item.id}
                        className={cn(
                          "transition-all",
                          // Stili per sezione Inizi Noleggio
                          bookingSection === 'start' && isToPickup && !isItemPickedUp(item) && "border-2 border-orange-500 bg-orange-50 shadow-lg",
                          bookingSection === 'start' && isItemPickedUp(item) && !isItemNotTodayStart(item) && "border-2 border-orange-400 bg-orange-100 opacity-90",
                          bookingSection === 'start' && isItemNotTodayStart(item) && "border-2 border-gray-300 bg-gray-50 opacity-60",
                          // Stili per sezione Fine Noleggi
                          bookingSection === 'end' && isToReturn && !isItemReturned(item) && "border-2 border-purple-500 bg-purple-50 shadow-lg",
                          bookingSection === 'end' && isItemReturned(item) && !isItemNotTodayEnd(item) && "border-2 border-green-300 bg-green-50 opacity-75",
                          bookingSection === 'end' && isItemNotTodayEnd(item) && "border-2 border-gray-300 bg-gray-50 opacity-60"
                        )}
                      >
                        <CardContent className="p-3">
                          <div className="flex flex-col gap-2">
                            {/* Header con titolo, badge e prezzo */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="text-base font-semibold text-gray-900 truncate">
                                    {item.product_title}
                                  </h3>
                                  {bookingSection === 'start' && isToPickup && !isItemPickedUp(item) && (
                                    <Badge variant="secondary" className="bg-orange-500 text-white border-orange-600 text-xs px-1.5 py-0">
                                      Da ritirare oggi
                                    </Badge>
                                  )}
                                  {bookingSection === 'end' && isToReturn && !isItemReturned(item) && (
                                    <Badge variant="secondary" className="bg-purple-500 text-white border-purple-600 text-xs px-1.5 py-0">
                                      Da riconsegnare oggi
                                    </Badge>
                                  )}
                                  {isItemPickedUp(item) && !isItemReturned(item) && (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300 text-xs px-1.5 py-0">
                                      Ritirato
                                    </Badge>
                                  )}
                                  {isItemReturned(item) && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300 text-xs px-1.5 py-0">
                                      Consegnato
                                    </Badge>
                                  )}
                                </div>
                                {(item.product_brand || item.product_model) && (
                                  <p className="text-sm text-gray-600">
                                    {[item.product_brand, item.product_model].filter(Boolean).join(' - ')}
                                  </p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-xl font-bold text-green-700">
                                  €{item.price.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            
                            {/* Sezione con date a sinistra e info aggiuntive a destra */}
                            <div className="grid grid-cols-2 gap-3 mt-1">
                              {/* Sinistra: Date */}
                              <div className="flex flex-col gap-1 text-sm">
                                <div>
                                  <span className="font-medium text-gray-700">Inizio:</span>
                                  <p className="text-gray-900">{formatDate(item.start_date)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Fine:</span>
                                  <p className="text-gray-900">{formatDate(item.end_date)}</p>
                                </div>
                              </div>
                              
                              {/* Destra: Informazioni aggiuntive */}
                              <div className="flex flex-col gap-1 text-sm">
                                {item.informations && item.informations.length > 0 ? (
                                  item.informations.map((info) => (
                                    <div key={info.id} className="flex gap-1">
                                      <span className="font-medium text-gray-600">
                                        {info.information?.name || 'Info'}:
                                      </span>
                                      <span className="text-gray-900">{info.value || '-'}</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-gray-400">Nessuna info aggiuntiva</span>
                                )}
                              </div>
                            </div>

                            {/* Pulsanti per sezione Inizi Noleggio */}
                            {bookingSection === 'start' && (
                              <>
                                {/* Pulsante Ritira prodotto */}
                                {isToPickup && !isItemPickedUp(item) && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <Button
                                      onClick={() => handlePickupItem(item.id)}
                                      disabled={isUpdatingStatus}
                                      size="sm"
                                      className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs"
                                    >
                                      Ritira prodotto
                                    </Button>
                                  </div>
                                )}

                                {/* Pulsante Annulla ritiro */}
                                {isPickedUpItemToday(item) && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <Button
                                      onClick={() => handleCancelPickupItem(item.id)}
                                      disabled={isUpdatingStatus}
                                      size="sm"
                                      variant="outline"
                                      className="w-full bg-gray-500 hover:bg-gray-600 text-white border-gray-600 text-xs"
                                    >
                                      Annulla ritiro
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Pulsanti per sezione Fine Noleggi */}
                            {bookingSection === 'end' && (
                              <>
                                {/* Pulsante Riconsegna prodotto */}
                                {isItemToReturnToday(item) && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <Button
                                      onClick={() => handleReturnItem(item.id)}
                                      disabled={isUpdatingStatus}
                                      size="sm"
                                      className="w-full bg-purple-500 hover:bg-purple-600 text-white text-xs"
                                    >
                                      Riconsegna prodotto
                                    </Button>
                                  </div>
                                )}

                                {/* Pulsante Annulla riconsegna */}
                                {isReturnedItemToday(item) && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <Button
                                      onClick={() => handleCancelReturnItem(item.id)}
                                      disabled={isUpdatingStatus}
                                      size="sm"
                                      variant="outline"
                                      className="w-full bg-gray-500 hover:bg-gray-600 text-white border-gray-600 text-xs"
                                    >
                                      Annulla riconsegna
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Articoli non nella data odierna - Sezione collassabile */}
                {bookingItems.some((item) => {
                  if (bookingSection === 'start') {
                    return isItemNotTodayStart(item);
                  } else {
                    return isItemNotTodayEnd(item);
                  }
                }) && (
                  <div className="mt-4">
                    <Button
                      variant="ghost"
                      onClick={() => setShowOtherItems(!showOtherItems)}
                      className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <span className="text-sm font-medium text-gray-700">
                        Articoli non in data odierna
                      </span>
                      {showOtherItems ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                    {showOtherItems && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {bookingItems
                          .filter((item) => {
                            if (bookingSection === 'start') {
                              return isItemNotTodayStart(item);
                            } else {
                              return isItemNotTodayEnd(item);
                            }
                          })
                          .map((item) => {
                            const isToPickup = isItemToPickupToday(item);
                            const isToReturn = isItemToReturnToday(item);
                            return (
                              <Card
                                key={item.id}
                                className={cn(
                                  "transition-all",
                                  // Stili per sezione Inizi Noleggio
                                  bookingSection === 'start' && isToPickup && !isItemPickedUp(item) && "border-2 border-orange-500 bg-orange-50 shadow-lg",
                                  bookingSection === 'start' && isItemPickedUp(item) && !isItemNotTodayStart(item) && "border-2 border-orange-400 bg-orange-100 opacity-90",
                                  bookingSection === 'start' && isItemNotTodayStart(item) && "border-2 border-gray-300 bg-gray-50 opacity-60",
                                  // Stili per sezione Fine Noleggi
                                  bookingSection === 'end' && isToReturn && !isItemReturned(item) && "border-2 border-purple-500 bg-purple-50 shadow-lg",
                                  bookingSection === 'end' && isItemReturned(item) && !isItemNotTodayEnd(item) && "border-2 border-green-300 bg-green-50 opacity-75",
                                  bookingSection === 'end' && isItemNotTodayEnd(item) && "border-2 border-gray-300 bg-gray-50 opacity-60"
                                )}
                              >
                                <CardContent className="p-3">
                                  <div className="flex flex-col gap-2">
                                    {/* Header con titolo, badge e prezzo */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                                            {item.product_title}
                                          </h3>
                                          {isItemPickedUp(item) && !isItemReturned(item) && (
                                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300 text-xs px-1.5 py-0">
                                              Ritirato
                                            </Badge>
                                          )}
                                          {isItemReturned(item) && (
                                            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300 text-xs px-1.5 py-0">
                                              Consegnato
                                            </Badge>
                                          )}
                                        </div>
                                        {(item.product_brand || item.product_model) && (
                                          <p className="text-sm text-gray-600">
                                            {[item.product_brand, item.product_model].filter(Boolean).join(' - ')}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <div className="text-xl font-bold text-green-700">
                                          €{item.price.toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Sezione con date a sinistra e info aggiuntive a destra */}
                                    <div className="grid grid-cols-2 gap-3 mt-1">
                                      {/* Sinistra: Date */}
                                      <div className="flex flex-col gap-1 text-sm">
                                        <div>
                                          <span className="font-medium text-gray-700">Inizio:</span>
                                          <p className="text-gray-900">{formatDate(item.start_date)}</p>
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">Fine:</span>
                                          <p className="text-gray-900">{formatDate(item.end_date)}</p>
                                        </div>
                                      </div>
                                      
                                      {/* Destra: Informazioni aggiuntive */}
                                      <div className="flex flex-col gap-1 text-sm">
                                        {item.informations && item.informations.length > 0 ? (
                                          item.informations.map((info) => (
                                            <div key={info.id} className="flex gap-1">
                                              <span className="font-medium text-gray-600">
                                                {info.information?.name || 'Info'}:
                                              </span>
                                              <span className="text-gray-900">{info.value || '-'}</span>
                                            </div>
                                          ))
                                        ) : (
                                          <span className="text-gray-400">Nessuna info aggiuntiva</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDailyBookings;
