
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { User, LogOut, Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const AdminHeader = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdminView, setIsAdminView] = useState(location.pathname.startsWith('/admin'));
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [userProfile, setUserProfile] = useState<{ first_name: string | null; last_name: string | null } | null>(null);

  // Update date and time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        
        if (!error && data) {
          setUserProfile(data);
        }
      } else {
        setUserProfile(null);
      }
    };
    
    fetchUserProfile();
  }, [user?.id]);

  // Se siamo nella dashboard, forziamo la vista admin
  const isDashboard = location.pathname === '/dashboard';
  const shouldForceAdminView = isDashboard; // Solo la dashboard forza la vista admin

  const handleLogout = async () => {
    await signOut();
  };

  const handleSwitchChange = (checked: boolean) => {
    // Se siamo nella dashboard, non permettere di cambiare vista
    if (isDashboard) {
      return;
    }
    
    setIsAdminView(checked);
    if (checked) {
      window.location.href = '/admin/home';
    } else {
      window.location.href = '/';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-4 relative">
        <div className="flex justify-between items-center">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <Link to="/admin/home" className="flex items-center space-x-3">
              <img 
                src="/Nollix_logo.png" 
                alt="Nollix Logo" 
                className="h-10 w-auto"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-800">Pannello Admin</h1>
                <p className="text-sm text-gray-500">Nollix Administration</p>
              </div>
            </Link>
            {/* Switch per cambiare vista admin/user - spostato qui */}
            <div className="flex items-center ml-6 px-3 py-1 bg-gray-100 rounded-full shadow-sm">
              <Switch
                checked={shouldForceAdminView ? true : isAdminView}
                onCheckedChange={handleSwitchChange}
                disabled={shouldForceAdminView}
                id="admin-view-switch"
              />
              <label htmlFor="admin-view-switch" className={`text-sm select-none ml-2 ${shouldForceAdminView ? 'text-gray-500' : 'text-gray-700'}`}>
                {shouldForceAdminView ? 'Vista Admin' : (isAdminView ? 'Vista Admin' : 'Vista Utente')}
              </label>
            </div>
          </div>

          {/* Navigation */}
          {/* RIMOSSO: Menu di navigazione admin */}

          {/* Date and Time - Centered absolutely, hidden on small screens */}
          <div className="absolute left-1/2 transform -translate-x-1/2 hidden lg:block">
            <div className="flex items-center gap-4 px-5 py-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200 shadow-md">
              <div className="text-xl font-bold text-blue-700">
                {format(currentDateTime, "HH:mm:ss", { locale: it }).toUpperCase()}
              </div>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="text-base font-medium text-gray-700">
                {format(currentDateTime, "EEEE d MMMM yyyy", { locale: it }).toUpperCase()}
              </div>
            </div>
          </div>
          
          {/* Date and Time - Compact version for medium screens */}
          <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:block lg:hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200 shadow-md">
              <div className="text-sm font-bold text-blue-700">
                {format(currentDateTime, "HH:mm", { locale: it }).toUpperCase()}
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <div className="text-xs font-medium text-gray-700">
                {format(currentDateTime, "d MMM", { locale: it }).toUpperCase()}
              </div>
            </div>
          </div>

          {/* User Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-[#3fafa3]/20 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-[#3fafa3]" />
                    </div>
                <span className="hidden md:block">
                  {(() => {
                    // Prova prima dai metadata, poi dal profilo caricato
                    const firstName = user?.user_metadata?.firstName || userProfile?.first_name;
                    const lastName = user?.user_metadata?.lastName || userProfile?.last_name;
                    
                    if (firstName && lastName) {
                      // Nome + Prima lettera del cognome con punto (es: "Mattia V.")
                      return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
                    } else if (firstName) {
                      return firstName;
                    }
                    return 'Admin';
                  })()}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleLogout} className="flex items-center text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
