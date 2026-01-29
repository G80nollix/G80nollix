import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { AlertCircle, Home, ShoppingCart, Mail } from "lucide-react";

export default function PaymentError() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex flex-col">
      <FixedNavbar />
      
      <div className="flex-1 container mx-auto px-4 py-16 pt-20 md:pt-24 max-w-2xl">
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-center text-3xl text-gray-900">
              Pagamento Non Confermato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-lg text-gray-600 mb-4">
                Il pagamento non è stato confermato. Questo può accadere se:
              </p>
              <ul className="text-left text-gray-600 space-y-2 mb-6 max-w-md mx-auto">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Il pagamento non è stato completato correttamente</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>La sessione di pagamento è scaduta</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Si è verificato un problema tecnico</span>
                </li>
              </ul>
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
                onClick={() => navigate('/cart')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Torna al Carrello
              </Button>
              
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Home className="h-4 w-4 mr-2" />
                Torna alla Home
              </Button>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    Hai bisogno di assistenza?
                  </p>
                  <p className="text-sm text-blue-800">
                    Se hai completato il pagamento ma vedi questo messaggio, 
                    contattaci con il Session ID sopra e ti aiuteremo a risolvere il problema.
                  </p>
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






















