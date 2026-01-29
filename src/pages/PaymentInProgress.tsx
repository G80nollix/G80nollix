import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { Clock, Home, ShoppingCart, Mail, Phone } from "lucide-react";

export default function PaymentInProgress() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white flex flex-col">
      <FixedNavbar />
      
      <div className="flex-1 container mx-auto px-4 py-16 pt-20 md:pt-24 max-w-2xl">
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="w-12 h-12 text-yellow-600" />
              </div>
            </div>
            <CardTitle className="text-center text-3xl text-gray-900">
              Pagamento in Elaborazione
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-lg text-gray-600 mb-4">
                Il tuo pagamento è attualmente in elaborazione.
              </p>
              <p className="text-base text-gray-600 mb-6">
                Riceverai una notifica via email non appena il pagamento sarà confermato.
                Se hai domande o necessiti di assistenza, non esitare a contattare il negozio.
              </p>
            </div>

            {sessionId && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 text-center">
                  <strong>Session ID:</strong> {sessionId.substring(0, 20)}...
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Home className="h-4 w-4 mr-2" />
                Torna alla Home
              </Button>
              
              <Button
                onClick={() => navigate('/bookings')}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Le mie Prenotazioni
              </Button>
            </div>

            <div className="mt-8 space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      Notifica via Email
                    </p>
                    <p className="text-sm text-blue-800">
                      Riceverai un'email di conferma non appena il pagamento sarà completato con successo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-900 mb-1">
                      Contatta il Negozio
                    </p>
                    <p className="text-sm text-green-800">
                      Se hai domande o necessiti di assistenza, puoi contattare direttamente il negozio.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}






