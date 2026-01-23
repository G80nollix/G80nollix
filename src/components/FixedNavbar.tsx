import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Stili separati per mobile e desktop - Navbar fissa
const getFixedNavStyles = (isMobile: boolean) => isMobile ? {
  nav: "fixed top-0 left-0 right-0 z-50 bg-white border-b-2 py-2 transition-all duration-300",
  container: "container mx-auto px-3",
  grid: "grid grid-cols-3 items-center gap-2",
  logoContainer: "h-12 transition-all duration-300 hover:scale-110 active:scale-105",
  button: "group relative bg-white/95 backdrop-blur-md hover:bg-white font-bold text-sm px-4 py-2 h-auto border-2 flex flex-row items-center gap-2 rounded-full hover:scale-105 active:scale-100 transition-all duration-300 touch-manipulation",
  buttonIcon: "h-5 w-auto object-contain transition-transform duration-300 group-hover:scale-105",
  cartButton: "bg-white/90 backdrop-blur-md hover:bg-white text-gray-800 border-2 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg touch-manipulation p-2.5",
  cartButtonSize: { minHeight: '44px', minWidth: '44px', height: '44px', width: '44px' },
  cartIcon: "h-6 w-6 object-contain",
  menuButton: "bg-white/90 backdrop-blur-md hover:bg-white text-gray-800 border-2 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg touch-manipulation w-full p-2.5",
  menuIcon: "w-6 h-6 transition-transform duration-300",
} : {
  nav: "fixed top-0 left-0 right-0 z-50 bg-white border-b-2 py-2 transition-all duration-300",
  container: "container mx-auto px-8",
  grid: "grid grid-cols-3 items-center gap-2",
  logoContainer: "h-16 transition-all duration-300 hover:scale-110 active:scale-105",
  button: "group relative bg-white/95 backdrop-blur-md hover:bg-white font-bold text-base px-5 py-2 h-auto border-2 flex flex-row items-center gap-2 rounded-full hover:scale-105 active:scale-100 transition-all duration-300 touch-manipulation",
  buttonIcon: "h-5 w-auto object-contain transition-transform duration-300 group-hover:scale-105",
  cartButton: "bg-white/90 backdrop-blur-md hover:bg-white text-gray-800 border-2 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg touch-manipulation",
  cartButtonSize: { minHeight: '44px', minWidth: '44px' },
  cartIcon: "h-6 w-6 object-contain",
  menuButton: "bg-white/90 backdrop-blur-md hover:bg-white text-gray-800 border-2 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg touch-manipulation w-full",
  menuIcon: "w-6 h-6 transition-transform duration-300",
};

interface FixedNavbarProps {
  showScrollProgress?: boolean;
  scrollProgress?: number;
}

const FixedNavbar = ({ showScrollProgress = false, scrollProgress = 0 }: FixedNavbarProps) => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [menuHovered, setMenuHovered] = useState(false);
  const [isAdminView, setIsAdminView] = useState(window.location.pathname.startsWith('/admin'));
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsAdminView(window.location.pathname.startsWith('/admin'));
  }, []);

  // Chiudi il menu quando clicchi fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (menuHovered && !target.closest('.menu-container')) {
        setMenuHovered(false);
      }
    };

    if (menuHovered) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuHovered]);

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
    refetchInterval: 5000,
  });

  const fixedNavStyles = getFixedNavStyles(isMobile);

  const scrollToContacts = () => {
    setMenuHovered(false);
    navigate('/');
    const scrollToElement = () => {
      const element = document.getElementById('dove-siamo');
      if (element) {
        const yOffset = -50;
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      } else {
        setTimeout(() => {
          const retryElement = document.getElementById('dove-siamo');
          if (retryElement) {
            const yOffset = -50;
            const y = retryElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        }, 500);
      }
    };
    // Su PC scroll immediato, su mobile delay di 50ms
    if (isMobile) {
      setTimeout(scrollToElement, 50);
    } else {
      scrollToElement();
    }
  };

  return (
    <nav 
      className={fixedNavStyles.nav}
      style={{ 
        borderColor: '#5F5F5F',
        ...(showScrollProgress && {
          opacity: scrollProgress > 0.3 ? Math.min(scrollProgress * 2, 1) : 0,
          transform: `translateY(${scrollProgress > 0.3 ? 0 : -20}px)`,
          pointerEvents: scrollProgress > 0.3 ? 'auto' : 'none'
        })
      }}
    >
      <div className={fixedNavStyles.container}>
        <div className={fixedNavStyles.grid}>
          {/* Logo ingrandito a sinistra */}
          <div className="flex justify-start">
            <Link to="/" className="cursor-pointer">
              <div className={fixedNavStyles.logoContainer}>
                <img 
                  src="/Asti/logo_g80.png" 
                  alt="G80 Logo" 
                  className="h-full w-auto object-contain transition-all duration-300"
                />
              </div>
            </Link>
          </div>
          
          {/* Pulsante PRENOTA ORA centrato - design compatto e moderno */}
          <div className="flex justify-center">
            <div>
              <Link to="/products">
                <Button 
                  className={fixedNavStyles.button}
                  style={{ borderColor: '#5F5F5F', color: '#5F5F5F', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
                >
                  <img 
                    src="/altre/icons8-sciatore-90.png" 
                    alt="Skier" 
                    className={fixedNavStyles.buttonIcon}
                  />
                  <span className="uppercase tracking-tight">PRENOTA ORA</span>
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Menu a destra */}
          <div className="flex justify-end items-center gap-2">
            {/* Saluto per clienti (non admin) - Navbar fissa */}
            {!loading && user && !isAdmin && !isMobile && (
              <div className="flex items-center px-3 py-1.5 rounded-lg border" style={{ minHeight: '44px', backgroundColor: '#E31E2420', borderColor: '#E31E2460' }}>
                <span className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Ciao <span style={{ color: '#E31E24' }}>{getUserDisplayName()}</span>
                </span>
              </div>
            )}
            {/* Icona carrello - solo per utenti loggati non admin - modernizzato */}
            {!loading && user && !isAdmin && (
              <Link to="/cart" className="relative">
                <Button 
                  variant="outline"
                  className={fixedNavStyles.cartButton}
                  style={{ borderColor: '#5F5F5F', ...fixedNavStyles.cartButtonSize }}
                >
                  <img 
                    src="/altre/icona carrello.png" 
                    alt="Carrello" 
                    className={fixedNavStyles.cartIcon}
                  />
                  {cartCount && cartCount > 0 && (
                    <Badge 
                      className={`absolute -top-1 -right-1 ${isMobile ? 'h-5 w-5 text-[10px]' : 'h-5 w-5 text-xs'} flex items-center justify-center p-0 text-white border border-white`}
                      style={{ backgroundColor: '#E31E24' }}
                    >
                      {cartCount > 9 ? '9+' : cartCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}
            <div className="relative menu-container" style={{ width: isMobile ? '44px' : '100%', maxWidth: isMobile ? '44px' : '200px', overflow: 'visible' }}>
              <Button 
                variant="outline"
                onClick={() => setMenuHovered(!menuHovered)}
                className={fixedNavStyles.menuButton}
                style={{ borderColor: '#5F5F5F', ...fixedNavStyles.cartButtonSize }}
              >
                <svg 
                  className={`${fixedNavStyles.menuIcon} transition-transform duration-300 ${menuHovered ? 'rotate-90' : ''}`}
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </Button>
              
              {/* Menu dropdown moderno */}
              {menuHovered && (
                <div 
                  className={`absolute top-full right-0 mt-2 ${isMobile ? 'w-[280px] min-w-[280px]' : 'w-[240px]'} bg-white rounded-2xl shadow-2xl border-2 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2`}
                  style={{ 
                    borderColor: '#5F5F5F',
                    animation: 'fadeInScale 0.3s ease-out',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
                    ...(isMobile && { left: 'auto', right: '0.5rem' })
                  }}
                >
                  <div className="p-2.5">
                    <button
                      onClick={scrollToContacts}
                      className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 active:bg-gray-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation"
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                        <img 
                          src="/altre/icona cornetta.png" 
                          alt="Contatti" 
                          className="h-5 w-5 object-contain"
                        />
                      </div>
                      <span className="text-base md:text-base font-semibold text-gray-800 group-hover:text-gray-900 uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                        Contatti
                      </span>
                    </button>
                    {isAdmin && !adminLoading && (
                      <>
                        <button
                          onClick={() => {
                            setMenuHovered(false);
                            handleSwitchChange(!isAdminView);
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 active:bg-gray-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation"
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                            <svg 
                              className="h-5 w-5 text-gray-600"
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                            >
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="9" y1="3" x2="9" y2="21"></line>
                            </svg>
                          </div>
                          <span className="text-base md:text-base font-semibold text-gray-800 group-hover:text-gray-900 uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                            {isAdminView ? 'Vista Utente' : 'Vista Admin'}
                          </span>
                        </button>
                        <button
                          onClick={async () => {
                            setMenuHovered(false);
                            await signOut();
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 active:bg-red-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation"
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-100 group-hover:bg-red-200 transition-colors">
                            <LogOut className="h-5 w-5 text-red-600" />
                          </div>
                          <span className="text-base md:text-base font-semibold text-red-600 group-hover:text-red-700 uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                            Logout
                          </span>
                        </button>
                      </>
                    )}
                    {!loading && user && !isAdmin && (
                      <>
                        <Link
                          to="/profile"
                          onClick={() => setMenuHovered(false)}
                          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 active:bg-gray-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation"
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                            <User className="h-5 w-5 text-gray-600" />
                          </div>
                          <span className="text-base md:text-base font-semibold text-gray-800 group-hover:text-gray-900 uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                            Profilo
                          </span>
                        </Link>
                        <Link
                          to="/bookings"
                          onClick={() => setMenuHovered(false)}
                          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 active:bg-gray-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation"
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                            <Calendar className="h-5 w-5 text-gray-600" />
                          </div>
                          <span className="text-base md:text-base font-semibold text-gray-800 group-hover:text-gray-900 uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                            Prenotazioni
                          </span>
                        </Link>
                        <button
                          onClick={async () => {
                            setMenuHovered(false);
                            await signOut();
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 active:bg-red-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation"
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-100 group-hover:bg-red-200 transition-colors">
                            <LogOut className="h-5 w-5 text-red-600" />
                          </div>
                          <span className="text-base md:text-base font-semibold text-red-600 group-hover:text-red-700 uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                            Logout
                          </span>
                        </button>
                      </>
                    )}
                    {!loading && !user && (
                      <>
                        <Link 
                          to="/auth"
                          onClick={() => setMenuHovered(false)}
                          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 active:bg-blue-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation cursor-pointer"
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                            <img 
                              src="/altre/icona accedi.png" 
                              alt="Accedi" 
                              className="h-5 w-5 object-contain"
                            />
                          </div>
                          <span className="text-base md:text-base font-semibold text-blue-600 group-hover:text-blue-700" style={{ fontFamily: 'Oswald, sans-serif' }}>
                            Accedi
                          </span>
                        </Link>
                        <Link 
                          to="/auth?mode=register"
                          onClick={() => setMenuHovered(false)}
                          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 active:bg-green-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation cursor-pointer"
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors">
                            <img 
                              src="/altre/icona registrati.png" 
                              alt="Registrati" 
                              className="h-5 w-5 object-contain"
                            />
                          </div>
                          <span className="text-base md:text-base font-semibold text-green-600 group-hover:text-green-700" style={{ fontFamily: 'Oswald, sans-serif' }}>
                            Registrati
                          </span>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </nav>
  );
};

export default FixedNavbar;

