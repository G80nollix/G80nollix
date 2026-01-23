
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { CheckCircle, Home, LogIn } from "lucide-react";

const AdminLogout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            Logout Effettuato
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-2">
            <p className="text-gray-600 text-lg">
              Grazie per aver utilizzato il pannello amministratore!
            </p>
            <p className="text-gray-500 text-sm">
              La tua sessione è stata terminata con successo.
            </p>
          </div>
          
          <div className="space-y-3">
            <Link to="/auth" className="block">
              <Button className="w-full bg-[#3fafa3] hover:bg-[#3fafa3] text-white">
                <LogIn className="h-4 w-4 mr-2" />
                Accedi Nuovamente
              </Button>
            </Link>
            
            <Link to="/" className="block">
              <Button variant="outline" className="w-full border-gray-300 hover:bg-gray-50">
                <Home className="h-4 w-4 mr-2" />
                Torna alla Home Page
              </Button>
            </Link>
          </div>
          
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Nollix - Pannello Amministratore
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogout;
