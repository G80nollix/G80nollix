import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { CheckCircle, Mail, ArrowLeft, Home, Hash } from "lucide-react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";

const BookingConfirmation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rif = searchParams.get("rif");
  const sessionId = searchParams.get("session_id");
  const { isAdmin } = useAdminCheck();
  const { user } = useAuth();
  const [bookingRef, setBookingRef] = useState<string | null>(rif);

  // If we have session_id but no rif, fetch the booking reference
  const { data: bookingData } = useQuery({
    queryKey: ["booking-confirmation", sessionId],
    queryFn: async () => {
      if (!sessionId || !user?.id) return null;

      const { data: booking, error } = await supabase
        .from("bookings")
        .select("rifPrenotazione, status, cart")
        .eq("stripe_checkout_session_id", sessionId)
        .eq("user_id", user.id)
        .single();

      if (error || !booking) {
        return null;
      }

      return booking;
    },
    enabled: !!sessionId && !!user?.id && !rif,
  });

  useEffect(() => {
    if (bookingData?.rifPrenotazione && !bookingRef) {
      setBookingRef(bookingData.rifPrenotazione);
    }
  }, [bookingData, bookingRef]);

  // Function to handle navigation to bookings
  const handleBookingsClick = () => {
    if (isAdmin) {
      navigate('/admin/bookings');
    } else {
      navigate('/bookings');
    }
  };
  


  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <FixedNavbar />
      
      <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-2xl">
        <div className="text-center">
          {/* Icona di successo */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>

          {/* Titolo principale */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Prenotazione Confermata!
          </h1>

          {/* Messaggio di successo */}
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            La tua prenotazione è stata confermata con successo. 
            Riceverai presto una email di riepilogo con tutti i dettagli della prenotazione.
          </p>

          {/* Codice di conferma */}
          {sessionId && !bookingRef && (
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border-2 border-blue-200">
              <p className="text-sm text-gray-600 text-center">
                Caricamento informazioni prenotazione...
              </p>
            </div>
          )}
          {bookingRef && (
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Hash className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">Codice di Conferma</h2>
              </div>
              <div className="text-center">
                <Badge className="text-2xl font-mono font-bold px-6 py-3 bg-blue-600 text-white hover:bg-blue-700">
                  #{bookingRef}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 text-center mt-3">
                Conserva questo codice per riferimento futuro
              </p>
            </div>
          )}

          {/* Card con informazioni aggiuntive */}
          <Card className="mb-8 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-blue-600" />
                Cosa succede ora?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                             <div className="flex items-start gap-3">
                 <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                   <span className="text-blue-600 text-xs font-bold">1</span>
                 </div>
                 <div className="text-center flex-1">
                   <p className="font-medium text-gray-900">Email di conferma</p>
                   <p className="text-sm text-gray-600">
                     Riceverai un'email con il riepilogo completo della prenotazione
                   </p>
                 </div>
               </div>
               
               <div className="flex items-start gap-3">
                 <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                   <span className="text-purple-600 text-xs font-bold">2</span>
                 </div>
                 <div className="text-center flex-1">
                   <p className="font-medium text-gray-900">Gestione prenotazioni</p>
                   <p className="text-sm text-gray-600">
                     Puoi visualizzare e gestire tutte le tue prenotazioni dalla sezione "Le mie prenotazioni"
                   </p>
                 </div>
               </div>
            </CardContent>
          </Card>

          {/* Pulsanti di navigazione */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleBookingsClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
            >
              Le mie prenotazioni
            </Button>
            
            <Button 
              onClick={() => navigate('/')}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3"
            >
              <Home className="h-4 w-4 mr-2" />
              Torna alla home
            </Button>
          </div>

          {/* Informazioni aggiuntive */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Hai domande?</strong> Non esitare a contattarci se hai bisogno di assistenza.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BookingConfirmation; 