import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import { Users, Calendar, Euro, TrendingUp, CheckCircle, Clock, XCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  totalCustomers: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalRevenue: 0,
    averageBookingValue: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading) {
      if (!isAdmin) {
        navigate('/');
        return;
      }
      fetchDashboardStats();
    }
  }, [isAdmin, adminLoading, navigate]);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch total customers (excluding admin users)
      const { count: customersCount, error: customersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .neq('user_type', 'admin');

      if (customersError) throw customersError;

      // Fetch bookings data for statistics
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('price_total, status');

      if (bookingsError) throw bookingsError;

      // Calculate statistics
      const totalBookings = bookingsData?.length || 0;
      const completedBookings = bookingsData?.filter(b => b.status === 'completed').length || 0;
      const cancelledBookings = bookingsData?.filter(b => b.status === 'cancelled').length || 0;
      const totalRevenue = bookingsData?.reduce((sum, b) => sum + (b.price_total || 0), 0) || 0;
      const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

      setStats({
        totalCustomers: customersCount || 0,
        totalBookings,
        completedBookings,
        cancelledBookings,
        totalRevenue,
        averageBookingValue
      });

    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Errore nel caricamento delle statistiche');
    } finally {
      setIsLoading(false);
    }
  };



  if (adminLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <div className="text-lg text-gray-500">Verifica autorizzazioni...</div>
          </div>
        </div>
        <AdminFooter />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <div className="text-red-600 text-lg mb-2">Accesso negato</div>
            <div className="text-sm text-gray-500 mb-4">Non hai i permessi per accedere a questa pagina</div>
            <Button onClick={() => navigate('/')}>Torna alla home</Button>
          </div>
        </div>
        <AdminFooter />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <div className="text-lg text-gray-500">Caricamento statistiche...</div>
          </div>
        </div>
        <AdminFooter />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <div className="text-red-600 text-lg mb-2">Errore nel caricamento</div>
            <div className="text-sm text-gray-500 mb-4">{error}</div>
            <Button onClick={fetchDashboardStats}>Riprova</Button>
          </div>
        </div>
        <AdminFooter />
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
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
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex-1" />
        </div>

        <div className="mb-8">
          <p className="text-gray-600">Statistiche del sistema di noleggio</p>
        </div>

        {/* Sezione Clienti */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Clienti</h2>
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Clienti totali</p>
                    <p className="text-2xl font-bold">{stats.totalCustomers}</p>
                    <p className="text-sm text-gray-500">Utenti registrati nel sistema (esclusi admin)</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sezione Prenotazioni */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Prenotazioni</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Prenotazioni totali</p>
                    <p className="text-2xl font-bold">{stats.totalBookings}</p>
                    <p className="text-sm text-gray-500">Tutte le prenotazioni</p>
                  </div>
                  <Calendar className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Completate</p>
                    <p className="text-2xl font-bold">{stats.completedBookings}</p>
                    <p className="text-sm text-gray-500">Noleggi terminati</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Annullate</p>
                    <p className="text-2xl font-bold">{stats.cancelledBookings}</p>
                    <p className="text-sm text-gray-500">Noleggi cancellati</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sezione Guadanagi */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Guadagni</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Fatturato totale</p>
                    <p className="text-2xl font-bold">€{stats.totalRevenue.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">Ricavi totali</p>
                  </div>
                  <Euro className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Valore medio prenotazione</p>
                    <p className="text-2xl font-bold">€{stats.averageBookingValue.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">Media per prenotazione</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>


      </div>
      
      <AdminFooter />
    </div>
  );
};

export default Dashboard;
