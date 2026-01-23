import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Calendar, MapPin, Phone, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birth_date: string | null;
  user_type: string | null;
  created_at: string;
  updated_at: string;
  // Campi aziendali (se presenti)
  company_name?: string | null;
  vat_number?: string | null;
  sdi_code?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  province?: string | null;
  fiscal_code?: string | null;
}

interface CustomerBooking {
  id: string;
  rifPrenotazione: number;
  product_id?: string;
  start_date?: string;
  end_date?: string;
  price_total: number;
  status: 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment';
  created_at: string;
  product_title?: string;
  product_brand?: string;
  product_model?: string;
}

const AdminCustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchCustomerData();
    }
  }, [id]);

  const fetchCustomerData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch customer data
      const { data: customerData, error: customerError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (customerError) throw customerError;

      setCustomer(customerData);

      // Fetch customer bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, user_id, price_total, delivery_method, delivery_address, status, created_at, updated_at, rifPrenotazione, cart')
        .eq('user_id', id)
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Fetch product details from booking_details (product_id doesn't exist in bookings anymore)
      // Need to follow chain: unit_id → product_units → product_variants → products
      const bookingIds = bookingsData?.map(b => b.id) || [];
      let bookingToProductMap = new Map<string, string>(); // booking_id -> product_id
      let productsMap = new Map<string, any>(); // product_id -> product data
      let bookingDatesMap = new Map<string, { start_date: string | null, end_date: string | null }>(); // booking_id -> dates
      
      if (bookingIds.length > 0) {
        // Fetch booking_details with dates
        const { data: bookingDetails, error: detailsError } = await supabase
          .from('booking_details')
          .select('booking_id, unit_id, start_date, end_date')
          .in('booking_id', bookingIds);
        
        if (detailsError) throw detailsError;
        
        // Calculate min start_date and max end_date for each booking
        if (bookingDetails && bookingDetails.length > 0) {
          bookingDetails.forEach((detail: any) => {
            const bookingId = detail.booking_id;
            if (!bookingDatesMap.has(bookingId)) {
              bookingDatesMap.set(bookingId, { start_date: null, end_date: null });
            }
            const dates = bookingDatesMap.get(bookingId)!;
            if (detail.start_date) {
              if (!dates.start_date || new Date(detail.start_date) < new Date(dates.start_date)) {
                dates.start_date = detail.start_date;
              }
            }
            if (detail.end_date) {
              if (!dates.end_date || new Date(detail.end_date) > new Date(dates.end_date)) {
                dates.end_date = detail.end_date;
              }
            }
          });
        }
        
        if (bookingDetails && bookingDetails.length > 0) {
          const unitIds = [...new Set(bookingDetails.map((d: any) => d.unit_id).filter(Boolean))];
          
          if (unitIds.length > 0) {
            // Step 1: Get product_units
            const { data: productUnits, error: unitsError } = await supabase
              .from('product_units')
              .select('id, id_product_variant')
              .in('id', unitIds);
            
            if (unitsError) throw unitsError;
            
            if (productUnits && productUnits.length > 0) {
              // Step 2: Get variants
              const variantIds = [...new Set(productUnits.map((u: any) => u.id_product_variant).filter(Boolean))];
              const { data: variants, error: variantsError } = await supabase
                .from('product_variants')
                .select('id, id_product')
                .in('id', variantIds);
              
              if (variantsError) throw variantsError;
              
              if (variants && variants.length > 0) {
                // Step 3: Get products
                const productIds = [...new Set(variants.map((v: any) => v.id_product).filter(Boolean))];
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
                
                // Create maps
                const unitToVariantMap = new Map(productUnits.map((u: any) => [u.id, u.id_product_variant]));
                const variantToProductMap = new Map(variants.map((v: any) => [v.id, v.id_product]));
                
                // Map products
                const mappedProducts = (productsData || []).map((p: any) => ({
                  id: p.id,
                  title: p.name,
                  brand: p.product_brand?.name || '',
                  model: p.product_model?.name || '',
                }));
                productsMap = new Map(mappedProducts.map((p: any) => [p.id, p]));
                
                // Create booking_id -> product_id map (use first product found for each booking)
                bookingDetails.forEach((detail: any) => {
                  if (!bookingToProductMap.has(detail.booking_id) && detail.unit_id) {
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
        }
      }

      // Transform bookings with product data and dates
      const transformedBookings: CustomerBooking[] = (bookingsData || []).map(booking => {
        const productId = bookingToProductMap.get(booking.id);
        const product = productId ? productsMap.get(productId) : null;
        const dates = bookingDatesMap.get(booking.id);
        return {
          ...booking,
          product_id: productId || undefined,
          product_title: product?.title,
          product_brand: product?.brand,
          product_model: product?.model,
          start_date: dates?.start_date || undefined,
          end_date: dates?.end_date || undefined,
        };
      });

      setBookings(transformedBookings);

    } catch (err) {
      console.error('Error fetching customer data:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dati cliente');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), "dd/MM/yyyy", { locale: it });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Data non valida';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      cart: { label: 'Nel carrello', variant: 'secondary' as const, className: undefined },
      confirmed: { label: 'Confermata', variant: 'default' as const, className: undefined },
      cancelled: { label: 'Annullata', variant: 'destructive' as const, className: undefined },
      completed: { label: 'Completata', variant: 'default' as const, className: 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.cart;
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const calculateAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AdminHeader />
        <div className="flex-1">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center py-16 text-lg text-gray-500">Caricamento...</div>
          </div>
        </div>
        <AdminFooter />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AdminHeader />
        <div className="flex-1">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center py-16">
              <div className="text-red-600 text-lg mb-2">Errore durante il caricamento del cliente</div>
              <Button onClick={() => navigate('/admin/customers')} className="mt-4">
                Torna ai clienti
              </Button>
            </div>
          </div>
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
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={() => navigate('/admin/customers')} className="flex gap-2 items-center">
              <ArrowLeft className="h-4 w-4" /> Torna ai clienti
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">
              Dettagli Cliente
            </h1>
            <div className="flex-1" />
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Prenotazioni e Statistiche */}
            <div className="lg:col-span-2 space-y-6">
              {/* Ultime Prenotazioni */}
              <Card>
                <CardHeader>
                  <CardTitle>Ultime Prenotazioni</CardTitle>
                </CardHeader>
                <CardContent>
                  {bookings.length > 0 ? (
                    <div className="space-y-3">
                      {bookings.slice(0, 5).map((booking) => (
                        <div key={booking.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-medium text-sm">
                              {booking.product_title || 'Prodotto non disponibile'}
                            </div>
                            <div className="text-xs text-gray-500">
                              #{booking.rifPrenotazione}
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-gray-600">
                            <span>{formatDate(booking.start_date)} - {formatDate(booking.end_date)}</span>
                            <span>€{booking.price_total.toFixed(2)}</span>
                          </div>
                          <div className="mt-2">
                            {getStatusBadge(booking.status)}
                          </div>
                        </div>
                      ))}
                      {bookings.length > 5 && (
                        <div className="text-center pt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/admin/bookings?customer=${customer.id}`)}
                          >
                            Vedi tutte ({bookings.length})
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      Nessuna prenotazione trovata
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Informazioni Cliente */}
            <div className="space-y-6">
              {/* Dettagli Personali */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Dettagli Personali
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Nome</label>
                      <p className="text-gray-900 font-semibold">
                        {customer.first_name || 'Non specificato'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Cognome</label>
                      <p className="text-gray-900 font-semibold">
                        {customer.last_name || 'Non specificato'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <p className="text-gray-900">{customer.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Tipo Utente</label>
                      <Badge variant={customer.user_type === 'admin' ? 'destructive' : 'default'}>
                        {customer.user_type === 'admin' ? 'Amministratore' : 'Cliente'}
                      </Badge>
                    </div>
                  </div>
                   
                  {customer.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Telefono</label>
                      <p className="text-gray-900 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {customer.phone}
                      </p>
                    </div>
                  )}

                  {customer.birth_date && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Data di Nascita</label>
                        <p className="text-gray-900">{formatDate(customer.birth_date)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Età</label>
                        <p className="text-gray-900">{calculateAge(customer.birth_date)} anni</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Registrato il</label>
                      <p className="text-gray-900">{formatDate(customer.created_at)}</p>
                    </div>
                    {customer.updated_at !== customer.created_at && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Ultimo aggiornamento</label>
                        <p className="text-gray-900">{formatDate(customer.updated_at)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Dettagli Aziendali (se presenti) */}
              {(customer.company_name || customer.vat_number || customer.sdi_code) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Dettagli Aziendali
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {customer.company_name && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Nome Azienda</label>
                        <p className="text-gray-900 font-semibold">{customer.company_name}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-4">
                      {customer.vat_number && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Partita IVA</label>
                          <p className="text-gray-900">{customer.vat_number}</p>
                        </div>
                      )}
                      {customer.sdi_code && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Codice SDI</label>
                          <p className="text-gray-900">{customer.sdi_code}</p>
                        </div>
                      )}
                    </div>

                    {(customer.address || customer.city || customer.postal_code || customer.province) && (
                      <div className="grid grid-cols-1 gap-4">
                        {customer.address && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">Indirizzo</label>
                            <p className="text-gray-900">{customer.address}</p>
                          </div>
                        )}
                        {customer.city && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">Città</label>
                            <p className="text-gray-900">{customer.city}</p>
                          </div>
                        )}
                        {customer.postal_code && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">CAP</label>
                            <p className="text-gray-900">{customer.postal_code}</p>
                          </div>
                        )}
                        {customer.province && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">Provincia</label>
                            <p className="text-gray-900">{customer.province}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {customer.fiscal_code && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Codice Fiscale</label>
                        <p className="text-gray-900">{customer.fiscal_code}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Statistiche */}
              <Card>
                <CardHeader>
                  <CardTitle>Statistiche</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{bookings.length}</div>
                    <div className="text-sm text-gray-600">Prenotazioni totali</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-xl font-semibold text-green-600">
                        {bookings.filter(b => b.status === 'completed').length}
                      </div>
                      <div className="text-gray-600">Completate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold text-orange-600">
                        {bookings.filter(b => b.status === 'cart').length}
                      </div>
                      <div className="text-gray-600">Nel carrello</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      
      <AdminFooter />
    </div>
  );
};

export default AdminCustomerDetail; 