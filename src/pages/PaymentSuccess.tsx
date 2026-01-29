import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { CheckCircle, ShoppingCart, Home } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const sessionId = searchParams.get("session_id");
  const [isLoading, setIsLoading] = useState(true);

  // Verify payment and get booking details
  const { data: bookingData } = useQuery({
    queryKey: ["payment-success", sessionId],
    queryFn: async () => {
      if (!sessionId || !user?.id) return null;

      // Find booking by stripe_checkout_session_id
      const { data: booking, error } = await supabase
        .from("bookings")
        .select("id, rifPrenotazione, status, cart")
        .eq("stripe_checkout_session_id", sessionId)
        .eq("user_id", user.id)
        .single();

      if (error || !booking) {
        return null;
      }

      return booking;
    },
    enabled: !!sessionId && !!user?.id,
  });

  useEffect(() => {
    if (sessionId && bookingData) {
      setIsLoading(false);
    } else if (sessionId && !isLoading) {
      // Wait a bit for the webhook to process
      setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    }
  }, [sessionId, bookingData, isLoading]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <FixedNavbar />
        <div className="flex-1 container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-3xl">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-600 mb-4">Sessione di pagamento non trovata</p>
                <Button onClick={() => navigate("/cart")}>
                  Torna al carrello
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <FixedNavbar />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-center text-3xl">
              Pagamento Completato!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Verifica del pagamento in corso...</p>
              </div>
            ) : bookingData ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <p className="text-lg font-semibold text-green-800 mb-2">
                    Il tuo pagamento è stato elaborato con successo!
                  </p>
                  {bookingData.rifPrenotazione && (
                    <p className="text-sm text-green-700">
                      Riferimento prenotazione: <strong>#{bookingData.rifPrenotazione}</strong>
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-gray-700">
                    La tua prenotazione è stata confermata. Riceverai un'email di conferma a breve con tutti i dettagli.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      onClick={() => navigate("/bookings")}
                      className="flex-1"
                      variant="outline"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Vedi le mie prenotazioni
                    </Button>
                    <Button
                      onClick={() => navigate("/")}
                      className="flex-1"
                    >
                      <Home className="h-4 w-4 mr-2" />
                      Torna alla home
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  Il pagamento è stato elaborato. La prenotazione verrà confermata a breve.
                </p>
                <Button onClick={() => navigate("/cart")}>
                  Torna al carrello
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

