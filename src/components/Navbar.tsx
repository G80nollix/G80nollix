
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, User, Bell, MessageSquare, ShoppingCart } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import AdminNavLink from "./AdminNavLink";
import { Switch } from "@/components/ui/switch";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, signOut, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [isAdminView, setIsAdminView] = useState(location.pathname.startsWith('/admin'));
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsAdminView(location.pathname.startsWith('/admin'));
  }, [location.pathname]);

  useEffect(() => {
    console.log("[DEBUG] Navbar montato", { user, loading });
  }, [user, loading]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Noleggio" },
    { href: "/about", label: "Contatti" },
  ];

  const handleLogout = async () => {
    await signOut();
  };

  const handleSwitchChange = (checked: boolean) => {
    setIsAdminView(checked);
    if (checked) {
      window.location.href = '/admin/home';
    } else {
      window.location.href = '/';
    }
  };

  const getUserDisplayName = () => {
    const firstName = user?.user_metadata?.firstName || user?.user_metadata?.first_name;
    const lastName = user?.user_metadata?.lastName || user?.user_metadata?.last_name;
    
    if (firstName && lastName) {
      // Mostra "Nome + iniziale cognome + ."
      const lastNameInitial = lastName.charAt(0).toUpperCase();
      return `${firstName} ${lastNameInitial}.`;
    }
    
    if (firstName) {
      return firstName;
    }
    
    return user?.email?.split('@')[0] || 'Utente';
  };

  // Fetch cart count
  const { data: cartCount } = useQuery({
    queryKey: ["cartCount", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Get cart booking
      const { data: booking } = await supabase
        .from("bookings")
        .select("id")
        .eq("user_id", user.id)
        .eq("cart", true)
        .maybeSingle();

      if (!booking) return 0;

      // Get booking details count
      const { count } = await supabase
        .from("booking_details")
        .select("*", { count: "exact", head: true })
        .eq("booking_id", booking.id);

      return count || 0;
    },
    enabled: !!user?.id && !isAdmin,
    refetchInterval: 5000, // Refetch every 5 seconds to keep count updated
  });

  // Stili separati per mobile e desktop
  const navStyles = isMobile ? {
    nav: "bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b-2",
    container: "container mx-auto px-2",
    content: "flex justify-between items-center h-14",
    logoContainer: "flex items-center space-x-2",
    logo: "h-8 w-auto group-hover:scale-105 transition-transform duration-300",
    switchContainer: "hidden", // Nascondi su mobile
  } : {
    nav: "bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b-4",
    container: "container mx-auto px-4",
    content: "flex justify-between items-center h-16",
    logoContainer: "flex items-center space-x-4",
    logo: "h-12 w-auto group-hover:scale-105 transition-transform duration-300",
    switchContainer: "flex items-center ml-6 px-3 py-1 bg-gray-100 rounded-full shadow-sm",
  };

  return (
    <nav className={navStyles.nav} style={{ borderColor: '#5F5F5F' }}>
      <div className={navStyles.container}>
        <div className={navStyles.content}>
          {/* Logo + Admin/User Switch */}
          <div className={navStyles.logoContainer}>
            <Link to="/" className="flex items-center group">
              <img 
                src="/Asti/logo_g80.png" 
                alt="G80 Logo" 
                className={navStyles.logo}
              />
            </Link>
            {/* Admin/User Switch visibile solo per admin */}
            {isAdmin && !adminLoading && (
              <div className={navStyles.switchContainer}>
                <Switch
                  checked={isAdminView}
                  onCheckedChange={handleSwitchChange}
                  id="admin-view-switch-navbar"
                />
                <label htmlFor="admin-view-switch-navbar" className={`text-sm text-gray-700 select-none ml-2 ${isMobile ? 'hidden' : ''}`}>
                  {isAdminView ? 'Vista Admin' : 'Vista Utente'}
                </label>
              </div>
            )}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`transition-colors hover:text-[#E31E24] ${
                  location.pathname === link.href
                    ? "font-semibold"
                    : "text-gray-700"
                }`}
                style={location.pathname === link.href ? { color: '#E31E24' } : {}}
              >
                {link.label}
              </Link>
            ))}
            {/* <AdminNavLink /> RIMOSSO */}
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                {/* Saluto per clienti (non admin) */}
                {!isAdmin && (
                  <div className="flex items-center px-3 py-1.5 rounded-lg border" style={{ minHeight: '44px', backgroundColor: '#E31E2420', borderColor: '#E31E2460' }}>
                <span className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Ciao <span style={{ color: '#E31E24' }}>{getUserDisplayName()}</span>
                </span>
              </div>
                )}
                {/* Cart Icon - Only for non-admin users - modernizzato */}
                {!isAdmin && (
                  <Link to="/cart" className="relative">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="relative bg-white/90 backdrop-blur-md hover:bg-white border-2 md:border-4 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg"
                      style={{ borderColor: '#5F5F5F', minHeight: '44px', minWidth: '44px' }}
                    >
                      <ShoppingCart className="h-5 w-5 text-gray-700" />
                      {cartCount && cartCount > 0 && (
                        <Badge 
                          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs text-white border-2 border-white"
                          style={{ backgroundColor: '#E31E24' }}
                        >
                          {cartCount > 9 ? '9+' : cartCount}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                )}
                {/* RIMOSSO: Bottoni chat e notifiche */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E31E2420' }}>
                        <User className="h-4 w-4" style={{ color: '#E31E24' }} />
                      </div>
                      <span>{getUserDisplayName()}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border-2 md:border-4 p-2" style={{ borderColor: '#5F5F5F' }}>
                    <DropdownMenuItem asChild className="rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 min-h-[44px]">
                      <Link to="/profile" className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                        <span className="font-semibold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>Il mio profilo</span>
                      </Link>
                    </DropdownMenuItem>
                    {!isAdmin && (
                      <DropdownMenuItem asChild className="rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 min-h-[44px]">
                        <Link to="/bookings" className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100">
                            <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <span className="font-semibold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>Le mie prenotazioni</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuItem onClick={handleLogout} disabled={loading} className="rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 min-h-[44px]">
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100">
                          <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </div>
                        <span className="font-semibold text-red-600 uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>Logout</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/auth">
                  <Button variant="ghost">Accedi</Button>
                </Link>
                <Link to="/auth?mode=register">
                  <Button className="text-white" style={{ backgroundColor: '#EB9D53', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d88a3f'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EB9D53'}>
                    Registrati
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button + Cart */}
          {isMobile ? (
            <div className="flex items-center gap-1.5">
              {user && !isAdmin && (
                <Link to="/cart" className="relative">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="relative bg-white/90 backdrop-blur-md hover:bg-white border-2 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg p-2"
                    style={{ borderColor: '#5F5F5F', minHeight: '36px', minWidth: '36px', height: '36px', width: '36px' }}
                  >
                    <ShoppingCart className="h-4 w-4 text-gray-700" />
                    {cartCount && cartCount > 0 && (
                      <Badge 
                        className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px] text-white border border-white"
                        style={{ backgroundColor: '#E31E24' }}
                      >
                        {cartCount > 9 ? '9+' : cartCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className="p-2"
                style={{ minHeight: '36px', minWidth: '36px', height: '36px', width: '36px' }}
              >
                {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          ) : null}
        </div>

        {/* Mobile Navigation */}
        {isOpen && isMobile && (
          <div className="py-3 border-t-2 animate-fade-in" style={{ borderColor: '#5F5F5F' }}>
            <div className="flex flex-col space-y-1.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`px-3 py-2.5 rounded-lg transition-all hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 text-sm ${
                    location.pathname === link.href
                      ? "font-semibold bg-gray-50"
                      : "text-gray-700"
                  }`}
                  style={location.pathname === link.href ? { color: '#E31E24' } : {}}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {!user && (
                <div className="flex flex-col space-y-1.5 pt-3 border-t-2" style={{ borderColor: '#5F5F5F' }}>
                  <Link to="/auth" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" className="w-full rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 justify-start py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100">
                          <User className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <span className="font-semibold uppercase text-blue-600 text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>Accedi</span>
                      </div>
                    </Button>
                  </Link>
                  <Link to="/auth?mode=register" onClick={() => setIsOpen(false)}>
                    <Button className="w-full text-white rounded-lg hover:opacity-90 transition-opacity py-2.5 text-sm" style={{ backgroundColor: '#EB9D53', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}>
                      <span className="uppercase">Registrati</span>
                    </Button>
                  </Link>
                </div>
              )}
              {user && (
                <div className="flex flex-col space-y-1.5 pt-3 border-t-2" style={{ borderColor: '#5F5F5F' }}>
                  <Link to="/profile" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" className="w-full rounded-lg hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 justify-start py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100">
                          <User className="h-3.5 w-3.5 text-gray-600" />
                        </div>
                        <span className="font-semibold uppercase text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>Il mio profilo</span>
                      </div>
                    </Button>
                  </Link>
                  {!isAdmin && (
                    <>
                      <Link to="/bookings" onClick={() => setIsOpen(false)}>
                        <Button variant="ghost" className="w-full rounded-lg hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 justify-start py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100">
                              <svg className="h-3.5 w-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </div>
                            <span className="font-semibold uppercase text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>Le mie prenotazioni</span>
                          </div>
                        </Button>
                      </Link>
                    </>
                  )}
                  <Button variant="ghost" className="w-full rounded-lg hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 justify-start py-2.5" onClick={handleLogout}>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-100">
                        <svg className="h-3.5 w-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      <span className="font-semibold text-red-600 uppercase text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>Logout</span>
                    </div>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
