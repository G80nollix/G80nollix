import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar as CalendarIcon, ArrowLeft, Clock, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);

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

      // Filter to only include bookings where start_date or end_date is exactly on the selected day
      const filteredDetails = bookingDetails.filter((detail: any) => {
        const startDate = new Date(detail.start_date);
        const endDate = new Date(detail.end_date);
        const selectedDayStart = startOfDay(selectedDate);
        
        const startDay = startOfDay(startDate);
        const endDay = startOfDay(endDate);
        
        return startDay.getTime() === selectedDayStart.getTime() || 
               endDay.getTime() === selectedDayStart.getTime();
      });

      if (filteredDetails.length === 0) {
        setBookings([]);
        return;
      }

      // Get unique booking IDs
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

              // Map booking_id to product name
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

      // Combine data
      const bookingsWithDetails: BookingDetail[] = bookingsData.map((booking: any) => {
        const detail = filteredDetails.find((d: any) => d.booking_id === booking.id);
        return {
          booking_id: booking.id,
          rifPrenotazione: booking.rifPrenotazione,
          start_date: detail?.start_date || "",
          end_date: detail?.end_date || "",
          product_title: productsMap.get(booking.id) || "Prodotto sconosciuto",
          user_name: profilesMap.get(booking.user_id) || "Utente sconosciuto",
          status: booking.status,
          delivery_method: booking.delivery_method,
          price_total: booking.price_total,
          products_status: productsStatusMap.get(booking.id) || undefined,
        };
      });

      setBookings(bookingsWithDetails);
    } catch (err) {
      console.error("Error searching bookings:", err);
      setError(err instanceof Error ? err.message : "Errore nella ricerca");
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Separate bookings into starts and ends, with independent search filters
  const startBookings = useMemo(() => {
    if (!searchDate) return [];
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    
    let filtered = bookings.filter((booking) => {
      const startDate = new Date(booking.start_date);
      const startDay = startOfDay(startDate);
      return startDay.getTime() === selectedDayStart.getTime();
    });

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
  }, [bookings, searchDate, searchTermStart]);

  const endBookings = useMemo(() => {
    if (!searchDate) return [];
    const selectedDate = new Date(searchDate + "T00:00:00");
    const selectedDayStart = startOfDay(selectedDate);
    
    let filtered = bookings.filter((booking) => {
      const endDate = new Date(booking.end_date);
      const endDay = startOfDay(endDate);
      return endDay.getTime() === selectedDayStart.getTime();
    });

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

    // Ordina le prenotazioni: prima quelle da riconsegnare, poi quelle completate/consegnate
    // All'interno di ciascun gruppo, ordina per numero prenotazione crescente
    const toReturn = filtered.filter(b => 
      b.products_status === 'Ritirato' || 
      b.products_status === 'Parz. consegnato'
    ).sort((a, b) => a.rifPrenotazione - b.rifPrenotazione);
    
    const completed = filtered.filter(b => 
      b.products_status === 'Consegnato' || 
      b.status === 'completed'
    ).sort((a, b) => a.rifPrenotazione - b.rifPrenotazione);

    return [...toReturn, ...completed];
  }, [bookings, searchDate, searchTermEnd]);

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

  const handleRitiraTutto = async (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Previeni la navigazione quando si clicca sul pulsante
    
    try {
      setProcessingBookingId(bookingId);
      
      // Aggiorna tutti i booking_details collegati alla prenotazione a 'pickedUp'
      // Gestisce sia 'idle', 'toPickup' che 'to_pickup' e anche null (che significa da ritirare)
      const { error: updateError } = await supabase
        .from('booking_details')
        .update({ status: 'pickedUp' })
        .eq('booking_id', bookingId)
        .or('status.is.null,status.eq.idle,status.eq.toPickup,status.eq.to_pickup');

      if (updateError) {
        console.error('Error updating booking_details:', updateError);
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dello stato dei prodotti",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "Tutti i prodotti sono stati marcati come ritirati",
      });

      // Ricarica i dati per aggiornare la visualizzazione
      handleSearch();
    } catch (err) {
      console.error('Error in handleRitiraTutto:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il ritiro",
        variant: "destructive",
      });
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleRitiroParz = async (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Previeni la navigazione quando si clicca sul pulsante
    
    // Naviga alla pagina di dettaglio della prenotazione
    navigate(`/admin/bookings/${bookingId}`, { state: { from: 'daily-bookings', date: searchDate } });
  };

  const handleConsegnaParz = async (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Previeni la navigazione quando si clicca sul pulsante
    
    // Naviga alla pagina di dettaglio della prenotazione
    navigate(`/admin/bookings/${bookingId}`, { state: { from: 'daily-bookings', date: searchDate } });
  };

  const handleCompleta = async (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Previeni la navigazione quando si clicca sul pulsante
    
    try {
      setProcessingBookingId(bookingId);
      
      // Aggiorna lo status della prenotazione a 'completed'
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId);

      if (bookingError) {
        console.error('Error updating booking status:', bookingError);
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dello stato della prenotazione",
          variant: "destructive",
        });
        return;
      }

      // Aggiorna tutti i booking_details a 'returned'
      const { error: detailsError } = await supabase
        .from('booking_details')
        .update({ status: 'returned' })
        .eq('booking_id', bookingId);

      if (detailsError) {
        console.error('Error updating booking_details status:', detailsError);
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dello stato dei prodotti",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "La prenotazione è stata completata e tutti i prodotti sono stati marcati come riconsegnati",
      });

      // Ricarica i dati per aggiornare la visualizzazione
      handleSearch();
    } catch (err) {
      console.error('Error in handleCompleta:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il completamento",
        variant: "destructive",
      });
    } finally {
      setProcessingBookingId(null);
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
                      {startBookings.map((booking) => (
                        <Card
                          key={`start-${booking.booking_id}`}
                          className={cn(
                            "cursor-pointer hover:shadow-md transition-shadow border-l-4",
                            (booking.products_status === 'Da ritirare' || booking.products_status === 'Parz. ritirato')
                              ? "border-l-orange-500"
                              : "border-l-green-500"
                          )}
                          onClick={() => navigate(`/admin/bookings/${booking.booking_id}`, { state: { from: 'daily-bookings', date: searchDate } })}
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <span className="font-mono font-bold text-lg text-blue-600">
                                    #{booking.rifPrenotazione}
                                  </span>
                                  {getStatusBadge(booking.status)}
                                  {getProductsStatusBadge(booking.products_status)}
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div>
                                    <span className="font-medium">Cliente:</span> {booking.user_name}
                                  </div>
                                  <div>
                                    <span className="font-medium">Prodotto:</span> {booking.product_title}
                                  </div>
                                  <div>
                                    <span className="font-medium">Inizio:</span>{" "}
                                    <span className="text-green-600 font-semibold">{formatDate(booking.start_date)}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Fine:</span>{" "}
                                    <span className="text-gray-600">{formatDate(booking.end_date)}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Modalità:</span>{" "}
                                    {booking.delivery_method === "pickup" ? "Ritiro in sede" : "Consegna"}
                                  </div>
                                  <div>
                                    <span className="font-medium">Totale:</span>{" "}
                                    <span className="font-bold text-green-700">€{booking.price_total.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Pulsanti per il ritiro */}
                            {booking.status !== 'completed' && (
                              <div className="flex gap-2 mt-4 pt-4 border-t">
                                <Button
                                  onClick={(e) => handleRitiraTutto(booking.booking_id, e)}
                                  disabled={
                                    processingBookingId === booking.booking_id || 
                                    booking.products_status === 'Ritirato' || 
                                    booking.products_status === 'Parz. consegnato' ||
                                    booking.products_status === 'Consegnato'
                                  }
                                  className={cn(
                                    "flex-1 bg-green-600 hover:bg-green-700 text-white",
                                    (booking.products_status === 'Ritirato' || 
                                     booking.products_status === 'Parz. consegnato' ||
                                     booking.products_status === 'Consegnato') && "opacity-50 cursor-not-allowed"
                                  )}
                                  size="sm"
                                >
                                  {processingBookingId === booking.booking_id ? "Elaborazione..." : "RITIRA TUTTO"}
                                </Button>
                                <Button
                                  onClick={(e) => handleRitiroParz(booking.booking_id, e)}
                                  disabled={
                                    processingBookingId === booking.booking_id || 
                                    booking.products_status === 'Ritirato' || 
                                    booking.products_status === 'Parz. consegnato' ||
                                    booking.products_status === 'Consegnato'
                                  }
                                  variant="outline"
                                  className={cn(
                                    "flex-1 border-green-600 text-green-600 hover:bg-green-50",
                                    (booking.products_status === 'Ritirato' || 
                                     booking.products_status === 'Parz. consegnato' ||
                                     booking.products_status === 'Consegnato') && "opacity-50 cursor-not-allowed"
                                  )}
                                  size="sm"
                                >
                                  RITIRO PARZ
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
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
                      {endBookings.map((booking) => (
                        <Card
                          key={`end-${booking.booking_id}`}
                          className={cn(
                            "cursor-pointer hover:shadow-md transition-shadow border-l-4",
                            (booking.products_status === 'Ritirato' || booking.products_status === 'Parz. consegnato')
                              ? "border-l-purple-500"
                              : "border-l-green-500"
                          )}
                          onClick={() => navigate(`/admin/bookings/${booking.booking_id}`, { state: { from: 'daily-bookings', date: searchDate } })}
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <span className="font-mono font-bold text-lg text-blue-600">
                                    #{booking.rifPrenotazione}
                                  </span>
                                  {getStatusBadge(booking.status)}
                                  {getProductsStatusBadge(booking.products_status)}
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div>
                                    <span className="font-medium">Cliente:</span> {booking.user_name}
                                  </div>
                                  <div>
                                    <span className="font-medium">Prodotto:</span> {booking.product_title}
                                  </div>
                                  <div>
                                    <span className="font-medium">Inizio:</span>{" "}
                                    <span className="text-gray-600">{formatDate(booking.start_date)}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Fine:</span>{" "}
                                    <span className="text-red-600 font-semibold">{formatDate(booking.end_date)}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Modalità:</span>{" "}
                                    {booking.delivery_method === "pickup" ? "Ritiro in sede" : "Consegna"}
                                  </div>
                                  <div>
                                    <span className="font-medium">Totale:</span>{" "}
                                    <span className="font-bold text-green-700">€{booking.price_total.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Pulsanti per la riconsegna */}
                            {booking.status === 'confirmed' && (
                              <div className="flex gap-2 mt-4 pt-4 border-t">
                                <Button
                                  onClick={(e) => handleConsegnaParz(booking.booking_id, e)}
                                  disabled={
                                    processingBookingId === booking.booking_id || 
                                    booking.products_status === 'Consegnato' ||
                                    booking.products_status === 'Da ritirare'
                                  }
                                  variant="outline"
                                  className={cn(
                                    "flex-1 border-orange-600 text-orange-600 hover:bg-orange-50",
                                    (booking.products_status === 'Consegnato' ||
                                     booking.products_status === 'Da ritirare') && "opacity-50 cursor-not-allowed"
                                  )}
                                  size="sm"
                                >
                                  CONSEGNA PARZ
                                </Button>
                                <Button
                                  onClick={(e) => handleCompleta(booking.booking_id, e)}
                                  disabled={
                                    processingBookingId === booking.booking_id || 
                                    booking.products_status === 'Da ritirare' ||
                                    booking.products_status === 'Parz. ritirato'
                                  }
                                  className={cn(
                                    "flex-1 bg-green-600 hover:bg-green-700 text-white",
                                    (booking.products_status === 'Da ritirare' ||
                                     booking.products_status === 'Parz. ritirato') && "opacity-50 cursor-not-allowed"
                                  )}
                                  size="sm"
                                >
                                  {processingBookingId === booking.booking_id ? "Elaborazione..." : "COMPLETA"}
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <AdminFooter />
    </div>
  );
};

export default AdminDailyBookings;
