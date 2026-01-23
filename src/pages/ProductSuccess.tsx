import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Plus, Eye } from "lucide-react";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";

const ProductSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("id");
  const productTitle = searchParams.get("title");

  return (
    <div className="min-h-screen bg-gray-50">
      <FixedNavbar />
      
      <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-4xl">
        <Card className="text-center">
          <CardHeader className="pb-4">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Prodotto pubblicato con successo!
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-gray-600">
              <p className="text-lg mb-2">
                Il tuo prodotto <strong>"{productTitle || 'Prodotto'}"</strong> è stato pubblicato correttamente.
              </p>
              <p className="text-sm">
                Ora è visibile nel catalogo e gli utenti possono prenotarlo.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {productId && (
                <Button
                  onClick={() => navigate(`/products/${productId}`)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Eye className="w-4 h-4" />
                  Visualizza prodotto
                </Button>
              )}
              
              <Button
                onClick={() => navigate('/admin/publish')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Pubblica altro prodotto
              </Button>
              
              <Button
                onClick={() => navigate('/admin/catalog')}
                variant="ghost"
                className="flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                Vai al catalogo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
};

export default ProductSuccess; 