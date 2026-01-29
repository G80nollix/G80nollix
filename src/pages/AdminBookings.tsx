import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Search, Filter, Calendar, User, Package, Clock, CheckCircle, XCircle, AlertCircle, MoreHorizontal, DollarSign, ExternalLink, Phone, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Booking {
  id: string;
  rifPrenotazione: number;
  user_id: string;
  product_id: string;
  start_date: string;
  end_date: string;
  price_total: number;
  delivery_method: 'pickup' | 'delivery';
  delivery_address: string | null;
  status: 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment' | 'pendingRefund' | 'succeededRefund';
  created_at: string;
  updated_at: string;
  ritiro_fasciaoraria_inizio: string | null;
  ritiro_fasciaoraria_fine: string | null;
  riconsegna_fasciaoraria_inizio: string | null;
  riconsegna_fasciaoraria_fine: string | null;
  price_daily: number | null;
  price_weekly: number | null;
  price_hour: number | null;
  price_month: number | null;
  deposito: number | null;
  cart?: boolean;
  // Joined data
  user_email?: string;
  user_name?: string;
  user_phone?: string;
  product_title?: string;
  product_brand?: string;
  product_model?: string;
  booking_details_count?: number;
}

const AdminBookings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerId = searchParams.get('customer');
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);

  const itemsPerPage = 20;

  // Fetch bookings with joined data
  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Build query
      let query = supabase
        .from('bookings')
        .select('id, user_id, price_total, delivery_method, delivery_address, status, created_at, updated_at, rifPrenotazione, cart')
        .order('created_at', { ascending: false });
// Exclude bookings with cart=true
      query = query.or('cart.is.null,cart.eq.false');

      // Filter by customer if customerId is provided
      if (customerId) {
        query = query.eq('user_id', customerId);
      }

      const { data: bookingsData, error: bookingsError } = await query;

      if (bookingsError) throw bookingsError;

      // Fetch user profiles for all bookings
      const userIds = [...new Set(bookingsData?.map(b => b.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, phone')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Fetch product details from booking_details (product_id doesn't exist in bookings anymore)
      // unit_id in booking_details refers to product_units, not products directly
      const bookingIds = bookingsData?.map(b => b.id) || [];
      let bookingToProductMap = new Map<string, string>(); // booking_id -> product_id
      
      if (bookingIds.length > 0) {
        // Get booking_details with unit_id
        const { data: bookingDetails, error: detailsError } = await supabase
          .from('booking_details')
          .select('booking_id, unit_id')
          .in('booking_id', bookingIds);
        
        if (detailsError) throw detailsError;
        
        // Get product_units to find product_variants
        const unitIds = [...new Set((bookingDetails || []).map((d: any) => d.unit_id).filter(Boolean))];
        
        if (unitIds.length > 0) {
          // Get product_units with variant IDs
          const { data: productUnits, error: unitsError } = await supabase
            .from('product_units')
            .select('id, id_product_variant')
            .in('id', unitIds);
          
          if (unitsError) throw unitsError;
          
          // Get variant IDs
          const variantIds = [...new Set((productUnits || []).map((u: any) => u.id_product_variant).filter(Boolean))];
          
          if (variantIds.length > 0) {
            // Get variants with product IDs
            const { data: variants, error: variantsError } = await supabase
              .from('product_variants')
              .select('id, id_product')
              .in('id', variantIds);
            
            if (variantsError) throw variantsError;
            
            // Create maps: unit_id -> variant_id -> product_id
            const unitToVariantMap = new Map((productUnits || []).map((u: any) => [u.id, u.id_product_variant]));
            const variantToProductMap = new Map((variants || []).map((v: any) => [v.id, v.id_product]));
            
            // Create booking_id -> product_id map (use first product found for each booking)
            bookingDetails?.forEach((detail: any) => {
              if (!bookingToProductMap.has(detail.booking_id)) {
                const variantId = unitToVariantMap.get(detail.unit_id);
                const productId = variantId ? variantToProductMap.get(variantId) : null;
                if (productId) {
                  bookingToProductMap.set(detail.booking_id, productId);
                }
              }
            });
          }
        }
      }
      
      // Get unique product IDs
      const productIds = [...new Set(bookingToProductMap.values())];
      
      let productsMap = new Map();
      if (productIds.length > 0) {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            product_brand:id_brand(id, name),
            product_model:id_model(id, name)
          `)
          .in('id', productIds);

        if (productsError) throw productsError;

        // Mappa i dati per compatibilità
        const mappedProducts = (productsData || []).map((p: any) => ({
          id: p.id,
          title: p.name,
          brand: p.product_brand?.name || '',
          model: p.product_model?.name || '',
        }));

        productsMap = new Map(mappedProducts.map((p: any) => [p.id, p]));
      }

      console.log('[DEBUG] Bookings data:', bookingsData);
      console.log('[DEBUG] Number of bookings found:', bookingsData?.length || 0);
      console.log('[DEBUG] Profiles data:', profilesData);
      console.log('[DEBUG] Booking to product map:', bookingToProductMap);

      // Create lookup maps
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Get booking_details with dates for each booking
      const { data: bookingDetailsData } = await supabase
        .from('booking_details')
        .select('booking_id, start_date, end_date')
        .in('booking_id', bookingIds);

      const detailsCountMap = new Map<string, number>();
      const bookingDatesMap = new Map<string, { start_date: string, end_date: string }>();
      
      bookingDetailsData?.forEach(detail => {
        // Count details per booking
        const count = detailsCountMap.get(detail.booking_id) || 0;
        detailsCountMap.set(detail.booking_id, count + 1);
        
        // Store dates (use min start_date and max end_date for each booking)
        const existing = bookingDatesMap.get(detail.booking_id);
        if (!existing) {
          bookingDatesMap.set(detail.booking_id, {
            start_date: detail.start_date,
            end_date: detail.end_date
          });
        } else {
          // Use earliest start_date and latest end_date
          const startDate = new Date(detail.start_date) < new Date(existing.start_date) 
            ? detail.start_date 
            : existing.start_date;
          const endDate = new Date(detail.end_date) > new Date(existing.end_date) 
            ? detail.end_date 
            : existing.end_date;
          bookingDatesMap.set(detail.booking_id, {
            start_date: startDate,
            end_date: endDate
          });
        }
      });

      // Transform data to include joined fields
      const transformedBookings: Booking[] = (bookingsData || []).map(booking => {
        const profile = profilesMap.get(booking.user_id);
        const productId = bookingToProductMap.get(booking.id);
        const product = productId ? productsMap.get(productId) : null;
        const detailsCount = detailsCountMap.get(booking.id) || 0;
        const dates = bookingDatesMap.get(booking.id);
        
        return {
          ...booking,
          product_id: productId || '', // Set product_id for compatibility
          start_date: dates?.start_date || '', // Get from booking_details
          end_date: dates?.end_date || '', // Get from booking_details
          user_email: profile?.email,
          user_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          user_phone: profile?.phone,
          product_title: product?.title || 'Prodotto non trovato',
          product_brand: product?.brand || '',
          product_model: product?.model || '',
          booking_details_count: detailsCount,
        };
      });

      setBookings(transformedBookings);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento prenotazioni');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.rifPrenotazione.toString().includes(searchTerm) ||
      booking.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.user_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.product_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.product_brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.product_model?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
    const matchesDelivery = deliveryFilter === "all" || booking.delivery_method === deliveryFilter;

    return matchesSearch && matchesStatus && matchesDelivery;
  });

  // Sort bookings
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case "created_at":
        aValue = new Date(a.created_at);
        bValue = new Date(b.created_at);
        break;
      case "start_date":
        aValue = a.start_date ? new Date(a.start_date) : new Date(0);
        bValue = b.start_date ? new Date(b.start_date) : new Date(0);
        break;
      case "end_date":
        aValue = a.end_date ? new Date(a.end_date) : new Date(0);
        bValue = b.end_date ? new Date(b.end_date) : new Date(0);
        break;
      case "price_total":
        aValue = a.price_total;
        bValue = b.price_total;
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
      case "user_name":
        aValue = a.user_name || "";
        bValue = b.user_name || "";
        break;
      case "product_title":
        aValue = a.product_title || "";
        bValue = b.product_title || "";
        break;
      case "rifPrenotazione":
        aValue = a.rifPrenotazione;
        bValue = b.rifPrenotazione;
        break;
      default:
        aValue = new Date(a.created_at);
        bValue = new Date(b.created_at);
    }

    if (sortOrder === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedBookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBookings = sortedBookings.slice(startIndex, endIndex);

  // Update booking status
  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      setIsUpdating(true);
      
      // Get booking details before updating
      const booking = bookings.find(b => b.id === bookingId);
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus as 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment' | 'pendingRefund' | 'succeededRefund',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;

      // ✅ Aggiorna booking_details se status è 'confirmed'
      if (newStatus === 'confirmed') {
        const { error: detailsUpdateError } = await supabase
          .from('booking_details')
          .update({ 
            status: 'toPickup'
          })
          .eq('booking_id', bookingId);

        if (detailsUpdateError) {
          console.error('Error updating booking_details:', detailsUpdateError);
          // Mostra un toast di warning ma non bloccare
          toast({
            title: "Prenotazione confermata",
            description: "La prenotazione è stata confermata, ma c'è stato un problema nell'aggiornamento dei dettagli.",
            variant: "destructive",
          });
        } else {
          console.log('✅ Booking details updated successfully to toPickup');
        }
      }

      // Send cancellation email if booking is cancelled
      if (newStatus === 'cancelled' && booking?.user_email) {
        try {
          // Format dates for email
          const startDateFormatted = booking.start_date 
            ? format(parseISO(booking.start_date), "dd/MM/yyyy", { locale: it })
            : 'Non specificato';
          const endDateFormatted = booking.end_date
            ? format(parseISO(booking.end_date), "dd/MM/yyyy", { locale: it })
            : 'Non specificato';
          
          // Format delivery method
          const deliveryMethodText = booking.delivery_method === 'pickup' ? 'Ritiro in sede' : 'Consegna a domicilio';

          // Create HTML email content
          const emailHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cancellazione Prenotazione - Nollix</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                  .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 20px; text-align: center; }
                  .logo { width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
                .logo img { display: block; margin: auto; max-width: 100%; max-height: 100%; }
                  .logo-text { color: white; font-size: 24px; font-weight: bold; }
                  .header-title { color: white; font-size: 28px; font-weight: bold; margin: 0; }
                  .header-subtitle { color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0; }
                  .content { padding: 40px 20px; }
                  .welcome-text { font-size: 18px; color: #333; margin-bottom: 30px; }
                  .booking-details { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 30px 0; border-radius: 4px; }
                  .booking-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; }
                  .detail-item { margin-bottom: 10px; }
                  .detail-label { font-weight: 600; color: #666; }
                  .detail-value { color: #333; }
                  .booking-ref { font-family: 'Courier New', monospace; background-color: #fee2e2; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; font-weight: bold; }
                  .info-box { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 15px; margin: 20px 0; }
                  .info-text { color: #92400e; font-size: 14px; margin: 0; }
                  .button { display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                  .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; }
                  .footer-text { color: #666; font-size: 14px; margin: 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <div class="logo">
                      <img src="https://demo.nollix.it/Nollix_favicon.png" alt="Nollix Logo" style="width: 40px; height: 40px; object-fit: contain;">
                    </div>
                    <h1 class="header-title">Prenotazione Annullata</h1>
                    <p class="header-subtitle">La tua prenotazione è stata cancellata</p>
                  </div>
                  
                  <div class="content">
                    <p class="welcome-text">
                      Ciao <strong>${booking.user_name || 'Utente'}</strong>,
                    </p>
                    
                    <p>La tua prenotazione è stata annullata. Ecco i dettagli:</p>
                    
                    <div class="booking-details">
                      <div class="booking-title">📋 Dettagli Prenotazione Annullata:</div>
                      <div class="detail-item">
                        <span class="detail-label">Riferimento:</span>
                        <span class="booking-ref">${booking.rifPrenotazione}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Prodotto:</span>
                        <span class="detail-value">${booking.product_title}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Data inizio:</span>
                        <span class="detail-value">${startDateFormatted}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Data fine:</span>
                        <span class="detail-value">${endDateFormatted}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Modalità:</span>
                        <span class="detail-value">${deliveryMethodText}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Importo:</span>
                        <span class="detail-value">€${booking.price_total.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div class="info-box">
                      <p class="info-text">
                        <strong>Informazioni importanti:</strong><br>
                        • La prenotazione è stata annullata definitivamente<br>
                        • Se hai effettuato un pagamento, verrà rimborsato secondo i termini del servizio<br>
                        • Per nuove prenotazioni, visita il nostro catalogo<br>
                        • Per assistenza, contattaci tramite il nostro sito web
                      </p>
                    </div>
                    
                    <p>Ci dispiace per l'inconveniente. Grazie per aver scelto Nollix!</p>
                    
                    <a href="https://app.cirqlo.it" class="button">Vai al Catalogo</a>
                  </div>
                  
                  <div class="footer">
                    <p class="footer-text">
                      Questo è un messaggio automatico, per favore non rispondere a questa email.<br>
                      Per assistenza, contattaci tramite il nostro sito web.
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `;
          
          const { error: emailError } = await supabase.functions.invoke('send-email', {
            method: 'POST',
            body: {
              to: booking.user_email,
              subject: `Cancellazione Prenotazione - ${booking.rifPrenotazione}`,
              html: emailHtml,
            },
          });

          if (emailError) {
            console.error('[DEBUG] Error sending cancellation email:', emailError);
            toast({
              title: "Prenotazione annullata ma email non inviata",
              description: "La prenotazione è stata annullata con successo, ma l'email di cancellazione non è stata inviata. Contatta il cliente manualmente.",
              variant: "destructive",
            });
          } else {
            console.log('[DEBUG] Cancellation email sent successfully');
            toast({
              title: "Email inviata!",
              description: `Email di cancellazione inviata a ${booking.user_email}`,
            });
          }
        } catch (emailError) {
          console.error('[DEBUG] Error in cancellation email:', emailError);
          toast({
            title: "Prenotazione annullata ma email non inviata",
            description: "La prenotazione è stata annullata con successo, ma l'email di cancellazione non è stata inviata. Contatta il cliente manualmente.",
            variant: "destructive",
          });
        }
      }

      // Refresh bookings
      await fetchBookings();
    } catch (err) {
      console.error('Error updating booking status:', err);
      alert(`Errore nell'aggiornamento dello stato: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Non specificato';
    try {
      return format(parseISO(dateString), "dd/MM/yyyy", { locale: it });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Data non valida';
    }
  };

  // Format time
  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'Non specificato';
    return timeString.substring(0, 5); // Remove milliseconds
  };

  // Calculate duration
  const calculateDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      cart: { label: 'Nel carrello', variant: 'secondary' as const, icon: Clock, className: '' },
      confirmed: { label: 'Confermata', variant: 'default' as const, icon: CheckCircle, className: '' },
      cancelled: { label: 'Annullata', variant: 'destructive' as const, icon: XCircle, className: '' },
      completed: { label: 'Completata', variant: 'default' as const, icon: CheckCircle, className: 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200' },
      pendingRefund: { label: 'Rimborso in attesa', variant: 'secondary' as const, icon: Clock, className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200' },
      succeededRefund: { label: 'Rimborso completato', variant: 'default' as const, icon: CheckCircle, className: 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.cart;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Get delivery method badge
  const getDeliveryBadge = (method: string) => {
    return (
      <Badge variant="outline" className="text-xs">
        {method === 'pickup' ? 'Ritiro in sede' : 'Consegna'}
      </Badge>
    );
  };


  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AdminHeader />
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-96">
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                <p className="font-medium">Errore nel caricamento</p>
                <p className="text-sm">{error}</p>
                <Button onClick={fetchBookings} className="mt-4">
                  Riprova
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <AdminFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminHeader />
      
      <div className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Header con pulsante indietro */}
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
              Gestione Prenotazioni
            </h1>
            <div className="flex-1" />
            <Link to="/products">
              <Button className="bg-[#3fafa3] hover:bg-[#3fafa3] text-white">
                <Plus className="h-4 w-4 mr-2" />
                Nuova Prenotazione
              </Button>
            </Link>
          </div>

          <div className="mb-8">
            {customerId && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  <User className="h-3 w-3 mr-1" />
                  Filtro attivo: Prenotazioni cliente specifico
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = '/admin/bookings'}
                >
                  Mostra tutte
                </Button>
              </div>
            )}
          </div>

          {/* Filtri */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Cerca per RIF, cliente, prodotto..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Stato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti gli stati</SelectItem>
                    <SelectItem value="cart">Nel carrello</SelectItem>
                    <SelectItem value="confirmed">Confermata</SelectItem>
                    <SelectItem value="cancelled">Annullata</SelectItem>
                    <SelectItem value="completed">Completata</SelectItem>
                    <SelectItem value="pendingRefund">Rimborso in attesa</SelectItem>
                    <SelectItem value="succeededRefund">Rimborso completato</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={deliveryFilter} onValueChange={(value) => {
                  setDeliveryFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Modalità" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le modalità</SelectItem>
                    <SelectItem value="pickup">Ritiro in sede</SelectItem>
                    <SelectItem value="delivery">Consegna</SelectItem>
                  </SelectContent>
                </Select>

                <div className="text-sm text-gray-500 flex items-center justify-end">
                  {sortedBookings.length} prenotazioni trovate
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabella prenotazioni */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Prenotazioni ({sortedBookings.length})
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Select 
                    value={sortBy} 
                    onValueChange={(value) => {
                      setSortBy(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Ordina per" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Data creazione</SelectItem>
                      <SelectItem value="start_date">Data inizio</SelectItem>
                      <SelectItem value="end_date">Data fine</SelectItem>
                      <SelectItem value="price_total">Prezzo totale</SelectItem>
                      <SelectItem value="status">Stato</SelectItem>
                      <SelectItem value="user_name">Cliente</SelectItem>
                      <SelectItem value="product_title">Prodotto</SelectItem>
                      <SelectItem value="rifPrenotazione">RIF</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    value={sortOrder} 
                    onValueChange={(value: "asc" | "desc") => {
                      setSortOrder(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Ordine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Decrescente</SelectItem>
                      <SelectItem value="asc">Crescente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-gray-500">Caricamento prenotazioni...</p>
                </div>
              ) : currentBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessuna prenotazione trovata</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>RIF</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Prodotto</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Stato</TableHead>
                          <TableHead>Modalità</TableHead>
                          <TableHead>Totale</TableHead>
                          <TableHead>Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentBookings.map((booking) => (
                          <TableRow key={booking.id} className="hover:bg-gray-50">
                            <TableCell className="font-mono font-bold">
                              #{booking.rifPrenotazione}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {booking.user_name || 'Nome non disponibile'}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {booking.user_email}
                                  </div>
                                  {booking.user_phone && (
                                    <div className="text-sm text-gray-400 flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {booking.user_phone}
                                    </div>
                                  )}
                                </div>
                            </TableCell>
                            <TableCell>
                              <Link 
                                to={`/products/${booking.product_id}`}
                                className="hover:bg-gray-100 p-1 rounded transition-colors"
                              >
                                <div>
                                  <div className="font-medium text-green-600 hover:text-green-800 hover:underline flex items-center gap-1">
                                    {booking.product_title}
                                    <ExternalLink className="h-3 w-3" />
                                    {booking.booking_details_count && booking.booking_details_count > 1 && (
                                      <Badge variant="secondary" className="ml-2 text-xs bg-blue-100 text-blue-700">
                                        +{booking.booking_details_count - 1} altri
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500 hover:text-gray-700">
                                    {booking.product_brand} {booking.product_model}
                                  </div>
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>Dal {formatDate(booking.start_date)}</div>
                                <div>Al {formatDate(booking.end_date)}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(booking.status)}
                            </TableCell>
                            <TableCell>
                              {getDeliveryBadge(booking.delivery_method)}
                            </TableCell>
                            <TableCell className="font-medium">
                              €{booking.price_total.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    navigate(`/admin/bookings/${booking.id}`);
                                  }}>
                                    Visualizza dettagli
                                  </DropdownMenuItem>
                                  {booking.status === 'cart' && (
                                    <>
                                      <DropdownMenuItem 
                                        onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                        disabled={isUpdating}
                                      >
                                        Conferma
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                                        disabled={isUpdating}
                                        className="text-red-600"
                                      >
                                        Annulla
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {booking.status === 'confirmed' && (
                                    <DropdownMenuItem 
                                      onClick={() => updateBookingStatus(booking.id, 'completed')}
                                      disabled={isUpdating}
                                    >
                                      Segna come completata
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginazione */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex justify-center">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNumber = i + 1;
                            return (
                              <PaginationItem key={pageNumber}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNumber)}
                                  isActive={currentPage === pageNumber}
                                  className="cursor-pointer"
                                >
                                  {pageNumber}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}
                          
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>


        </div>
      </div>
      
      <AdminFooter />
    </div>
  );
};

export default AdminBookings; 