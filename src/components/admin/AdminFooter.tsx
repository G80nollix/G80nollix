
import { Link } from "react-router-dom";
import { Shield, Users, BarChart3, Settings } from "lucide-react";

const AdminFooter = () => {
  return (
    <footer className="bg-slate-800 text-white py-8 mt-auto">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Logo e descrizione Admin */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src="/Nollix_logo.png" 
                alt="Nollix Logo" 
                className="h-10 w-auto"
              />
              <div>
                <span className="text-2xl font-bold">Admin</span>
                <p className="text-sm text-gray-300">Pannello di Amministrazione</p>
              </div>
            </div>
            <p className="text-gray-300 mb-4 max-w-md">
              Gestisci la tua attività di noleggio con Nollix
            </p>
          </div>

          {/* Link amministrativi */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Gestione
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/admin/customers" className="text-gray-300 hover:text-white transition-colors flex items-center">
                 
                  Clienti
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-gray-300 hover:text-white transition-colors">
                  Catalogo
                </Link>
              </li>
              <li>
                <Link to="/bookings" className="text-gray-300 hover:text-white transition-colors">
                  Prenotazioni
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-gray-300 hover:text-white transition-colors">
                  Statistiche
                </Link>
              </li>
            </ul>
          </div>

          
        </div>

        <div className="border-t border-slate-600 mt-6 pt-6 text-center">
          <p className="text-gray-300 text-sm">
            © 2025 Nollix Administration Panel. Accesso riservato agli amministratori.
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Versione 1.0 
          </p>
        </div>
      </div>
    </footer>
  );
};

export default AdminFooter;
