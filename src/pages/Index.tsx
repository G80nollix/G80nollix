
import { useState, useEffect } from "react";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Mail, Phone, Star, LogOut } from "lucide-react";
import FixedNavbar from "@/components/FixedNavbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [scrolled, setScrolled] = useState(false);
  const [menuHovered, setMenuHovered] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isAdminView, setIsAdminView] = useState(window.location.pathname.startsWith('/admin'));
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsAdminView(window.location.pathname.startsWith('/admin'));
  }, []);

  const handleSwitchChange = (checked: boolean) => {
    setIsAdminView(checked);
    if (checked) {
      window.location.href = '/admin/home';
    } else {
      window.location.href = '/';
    }
  };

  // Fetch cart count per la sezione hero
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

  // Forza un re-calcolo del layout quando la pagina viene montata
  useEffect(() => {
    // Forza un re-calcolo dopo che il DOM è stato renderizzato
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      // Scroll di 0px per forzare un re-calcolo del layout
      if (window.scrollY === 0) {
        window.scrollTo(0, 0);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Su PC inizia subito (threshold 0), su mobile dopo 50px (ridotto da 100px)
      const scrollThreshold = isMobile ? 50 : 0;
      // Su PC transizione più veloce (100px invece di 300px)
      const maxScroll = isMobile ? 300 : 100;
      const adjustedScrollY = Math.max(0, scrollY - scrollThreshold);
      const progress = Math.min(adjustedScrollY / maxScroll, 1);
      
      setScrollProgress(progress);
      setScrolled(scrollY > scrollThreshold); // Parte solo dopo il margine minimo
    };

    window.addEventListener('scroll', handleScroll);
    // Forza un calcolo iniziale quando la pagina viene caricata
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  // Forza un re-layout quando la pagina viene caricata o quando il logo è caricato
  useEffect(() => {
    if (logoLoaded) {
      // Forza un re-calcolo del layout dopo che l'immagine è caricata
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        // Scroll di 0px per forzare un re-calcolo
        const currentScroll = window.scrollY;
        if (currentScroll === 0) {
          window.scrollTo(0, 0);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [logoLoaded]);

  // Autoplay per il carosello delle recensioni
  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    const interval = setInterval(() => {
      carouselApi.scrollNext();
    }, 6000);

    return () => clearInterval(interval);
  }, [carouselApi]);

  // Stili separati per mobile e desktop - Hero Section
  const heroStyles = isMobile ? {
    overlay: "absolute inset-0 flex items-center justify-between px-2 pointer-events-none",
    logoLeft: "0.5rem",
    logoTop: "15%",
    logoHeight: "25%",
    buttonText: "text-base",
    buttonPadding: "px-4 py-2.5",
    buttonBorder: "border-2",
    buttonIcon: "h-4",
    menuRight: "right-2",
    menuTop: "calc(20vh - 60px)",
    menuButtonWidth: "w-[140px]",
    menuButtonHeight: "min-h-[36px]",
    menuButtonText: "text-xs",
    menuButtonPadding: "px-3 py-2",
    menuButtonBorder: "border-2",
    menuIcon: "w-5 h-5",
  } : {
    overlay: "absolute inset-0 flex items-center justify-between px-8 lg:px-16 pointer-events-none",
    logoLeft: "2rem",
    logoTop: "15%",
    logoHeight: "15%",
    buttonText: "text-4xl",
    buttonPadding: "px-12 py-6",
    buttonBorder: "border-8",
    buttonIcon: "h-12",
    menuRight: "right-8",
    menuTop: "calc(25vh - 90px)",
    menuButtonWidth: "w-[200px]",
    menuButtonHeight: "min-h-[52px]",
    menuButtonText: "text-base",
    menuButtonPadding: "px-6 py-4",
    menuButtonBorder: "border-4",
    menuIcon: "w-6 h-6",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Navbar fissa in alto quando scrolli */}
      <FixedNavbar showScrollProgress={true} scrollProgress={scrollProgress} />
      
      {/* Hero Section - Immagine copertina full screen */}
      <section className="relative overflow-hidden h-screen w-full">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/Foto negozio/Facciata.jpg')" }}
        >
        </div>
        {/* Overlay scuro per migliorare la visibilità degli elementi */}
        <div className="absolute inset-0 bg-black/45"></div>
        
        {isMobile ? (
          <div className="absolute inset-0 flex flex-col items-center px-4 pointer-events-none"
            style={{
              opacity: scrollProgress > 0.5 ? 0 : 1 - scrollProgress * 2,
              transform: `translateY(${scrollProgress * -50}px) scale(${1 - scrollProgress * 0.3})`
            }}
          >
            {/* Container principale con layout centrato verticalmente */}
            <div className="flex flex-col items-center justify-center h-full w-full relative">
              {/* Logo G80 Sport - posizionato più in basso con ombra */}
              <div 
                className="absolute w-full flex justify-center transition-all duration-300 pointer-events-none"
                style={{ 
                  top: '15%', // Abbassato da 5% a 15%
                  opacity: logoLoaded ? (scrollProgress > 0.3 ? 0 : 1 - scrollProgress * 3) : 0,
                }}
              >
                <Link 
                  to="/" 
                  className="pointer-events-auto cursor-pointer drop-shadow-2xl"
                  style={{ 
                    height: '80px', // Dimensioni ridotte
                    width: 'auto',
                    display: 'block',
                    filter: 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 10px rgba(0, 0, 0, 0.3))'
                  }}
                >
                  <img 
                    src="/logo_g80.png" 
                    alt="G80 Sport" 
                    className="h-full w-auto object-contain"
                    onLoad={() => setLogoLoaded(true)}
                    onError={() => setLogoLoaded(true)}
                  />
                </Link>
              </div>
              
              {/* Menu buttons - con "Accedi" al centro verticale esatto */}
              <div className="absolute flex flex-col items-center gap-3 pointer-events-auto"
                style={{
                  opacity: scrollProgress > 0.4 ? 0 : 1 - scrollProgress * 2.5,
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}>
                {/* Pulsante Contatti */}
                <a 
                  href="#dove-siamo"
                  onClick={(e) => {
                    e.preventDefault();
                    const scrollToElement = () => {
                      const element = document.getElementById('dove-siamo');
                      if (element) {
                        const yOffset = -50;
                        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        // Su PC: completa la transizione immediatamente, poi scrolla
                        if (!isMobile) {
                          setScrollProgress(1);
                          setScrolled(true);
                        }
                        window.scrollTo({ top: y, behavior: 'smooth' });
                      }
                    };
                    // Su PC scroll immediato, su mobile delay di 50ms
                    if (isMobile) {
                      setTimeout(scrollToElement, 50);
                    } else {
                      scrollToElement();
                    }
                  }}
                  className="bg-white backdrop-blur-md hover:bg-white font-medium rounded-lg px-6 py-3 flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg min-h-[44px] w-[200px] justify-center text-sm touch-manipulation border-2 uppercase shadow-2xl"
                  style={{ borderColor: '#302438', color: '#302438', fontFamily: 'Oswald, sans-serif', fontWeight: '600', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 0, 0, 0.4)' }}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#B0FB58]/20">
                    <img 
                      src="/g80/icona cornetta.png" 
                      alt="Contatti" 
                      className="h-4 w-4 object-contain"
                    />
                  </div>
                  <span>Contatti</span>
                </a>
                
                {/* Pulsanti aggiuntivi basati su stato utente */}
                {!loading && !user && (
                  <>
                    <Link 
                      to="/auth"
                      className="bg-white backdrop-blur-md hover:bg-white font-medium rounded-lg px-6 py-3 flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg min-h-[44px] w-[200px] justify-center text-sm touch-manipulation border-2 uppercase shadow-2xl"
                      style={{ borderColor: '#302438', color: '#2563EB', fontFamily: 'Oswald, sans-serif', fontWeight: '600', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 0, 0, 0.4)' }}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-100">
                        <img 
                          src="/g80/icona accedi.png" 
                          alt="Accedi" 
                          className="h-4 w-4 object-contain"
                        />
                      </div>
                      <span>Accedi</span>
                    </Link>
                    <Link 
                      to="/auth?mode=register"
                      className="bg-white backdrop-blur-md hover:bg-white font-medium rounded-lg px-6 py-3 flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg min-h-[44px] w-[200px] justify-center text-sm touch-manipulation border-2 uppercase shadow-2xl"
                      style={{ borderColor: '#302438', color: '#059669', fontFamily: 'Oswald, sans-serif', fontWeight: '600', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 0, 0, 0.4)' }}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-green-100">
                        <img 
                          src="/g80/icona registrati.png" 
                          alt="Registrati" 
                          className="h-4 w-4 object-contain"
                        />
                      </div>
                      <span>Registrati</span>
                    </Link>
                  </>
                )}
                {!loading && user && !isAdmin && (
                  <>
                    <Link 
                      to="/cart" 
                      className="bg-white/95 backdrop-blur-md hover:bg-white font-medium rounded-lg px-6 py-3 flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg min-h-[44px] w-[200px] justify-center text-sm touch-manipulation border-2 uppercase"
                      style={{ borderColor: '#302438', color: '#302438', fontFamily: 'Oswald, sans-serif', fontWeight: '600' }}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#B0FB58]/20 relative">
                        <img 
                          src="/g80/icona carrello.png" 
                          alt="Carrello" 
                          className="h-4 w-4 object-contain"
                        />
                        {cartCount && cartCount > 0 && (
                          <Badge 
                            className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px] text-white border border-white"
                            style={{ backgroundColor: '#C01A1F' }}
                          >
                            {cartCount > 9 ? '9+' : cartCount}
                          </Badge>
                        )}
                      </div>
                      <span>Carrello</span>
                    </Link>
                  </>
                )}
              </div>
              
              {/* Pulsante PRENOTA ORA - posizionato sotto con distanza fissa */}
              <div className="absolute pointer-events-auto"
                style={{
                  opacity: scrollProgress > 0.5 ? 0 : 1 - scrollProgress * 2,
                  top: 'calc(50% + 78px + 102px)' // Top del container pulsanti (50% + 78px) + distanza (102px)
                }}
              >
                <div>
                  <Link to="/products">
                    <Button 
                      size="lg" 
                      className="group relative bg-white backdrop-blur-md hover:bg-white font-bold text-2xl px-10 py-6 h-auto border-4 flex flex-row items-center gap-4 rounded-full hover:scale-105 active:scale-100 transition-all duration-300 touch-manipulation shadow-2xl"
                      style={{ borderColor: '#302438', color: '#302438', fontFamily: 'Oswald, sans-serif', fontWeight: '700', boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 0, 0, 0.5)' }}
                    >
                      {/* Icona */}
                      <img 
                        src="/g80/icons8-sciatore-90.png" 
                        alt="Skier" 
                        className="h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
                      />
                      
                      {/* Testo */}
                      <span className="uppercase tracking-tight">
                        PRENOTA ORA
                      </span>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={heroStyles.overlay}>
            {/* Logo G80 Sport a sinistra - si sposta verso la navbar */}
            <Link 
              to="/" 
              className="absolute transition-all duration-300 pointer-events-auto cursor-pointer drop-shadow-2xl"
              style={{ 
                left: scrollProgress > 0 ? `${8 + scrollProgress * (4 - 8)}rem` : heroStyles.logoLeft,
                top: scrollProgress > 0 ? `${15 - scrollProgress * 15}%` : heroStyles.logoTop,
                height: scrollProgress > 0 ? `${40 - scrollProgress * 20}%` : heroStyles.logoHeight,
                opacity: scrollProgress > 0.5 ? 0 : (logoLoaded ? 1 - scrollProgress * 2 : 0),
                transform: `translateY(${scrollProgress * -100}px) scale(${1 - scrollProgress * 0.6})`,
                willChange: 'transform, opacity',
                filter: 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 10px rgba(0, 0, 0, 0.3))'
              }}
            >
              <img 
                src="/logo_g80.png" 
                alt="G80 Sport" 
                className="h-full w-auto object-contain"
                onLoad={() => {
                  setLogoLoaded(true);
                  // Forza un re-layout dopo che l'immagine è caricata
                  requestAnimationFrame(() => {
                    window.dispatchEvent(new Event('resize'));
                    // Forza un re-calcolo dello scroll per aggiornare il posizionamento
                    const currentScroll = window.scrollY;
                    if (currentScroll === 0) {
                      window.scrollTo(0, 0);
                    }
                  });
                }}
                onError={() => {
                  // Se l'immagine non si carica, mostra comunque il logo
                  setLogoLoaded(true);
                }}
              />
            </Link>
            
            {/* Pulsante PRENOTA ORA al centro - design compatto e moderno */}
            <div 
              className="absolute left-1/2 transition-all duration-300 pointer-events-auto"
              style={{ 
                transform: `translate(-50%, ${scrollProgress > 0 ? `${50 - scrollProgress * 50}%` : '0%'}) scale(${1 - scrollProgress * 0.7})`,
                opacity: scrollProgress > 0.5 ? 0 : 1 - scrollProgress * 2,
                top: scrollProgress > 0 ? `${50 - scrollProgress * 50}%` : '50%'
              }}
            >
              <div>
                <Link to="/products">
                  <Button 
                    size="lg" 
                    className={`group relative bg-white backdrop-blur-md hover:bg-white font-bold ${heroStyles.buttonText} ${heroStyles.buttonPadding} h-auto ${heroStyles.buttonBorder} flex flex-row items-center gap-3 rounded-full hover:scale-105 active:scale-100 transition-all duration-300 touch-manipulation shadow-2xl`}
                    style={{ borderColor: '#302438', color: '#302438', fontFamily: 'Oswald, sans-serif', fontWeight: '700', boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 0, 0, 0.5)' }}
                  >
                    {/* Icona senza animazioni fastidiose */}
                    <img 
                      src="/g80/icons8-sciatore-90.png" 
                      alt="Skier" 
                      className={`${heroStyles.buttonIcon} w-auto object-contain transition-transform duration-300 group-hover:scale-110`}
                    />
                    
                    {/* Testo compatto */}
                    <span className="uppercase tracking-tight">
                      PRENOTA ORA
                    </span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
        
        {/* Overlay per menu che si sposta durante lo scroll - Solo Desktop */}
        {!isMobile && (
          <div className="absolute inset-0 flex items-center justify-between px-8 lg:px-16 pointer-events-none">
            
            {/* Menu nell'angolo alto a destra - si sposta verso la navbar */}
            <div 
              className={`absolute ${heroStyles.menuRight} transition-all duration-300`}
              onMouseEnter={() => scrollProgress < 0.5 && setMenuHovered(true)}
              onMouseLeave={() => scrollProgress < 0.5 && setMenuHovered(false)}
              style={{
                top: heroStyles.menuTop,
                transform: `translateY(${scrollProgress * -50}px) scale(${1 - scrollProgress * 0.4})`,
                opacity: scrollProgress > 0.5 ? 0 : 1 - scrollProgress * 2,
                pointerEvents: scrollProgress > 0.5 ? 'none' : 'auto'
              }}
            >
              {/* Menu completo visibile all'inizio - modernizzato */}
              {scrollProgress < 0.5 && (
                <div 
                  className={`flex flex-col items-end ${isMobile ? 'gap-1.5' : 'gap-2'} pr-0`}
                >
                <a 
                  href="#dove-siamo"
                  onClick={(e) => {
                    e.preventDefault();
                    const scrollToElement = () => {
                      const element = document.getElementById('dove-siamo');
                      if (element) {
                        const yOffset = -50;
                        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        // Su PC: completa la transizione immediatamente, poi scrolla
                        if (!isMobile) {
                          setScrollProgress(1);
                          setScrolled(true);
                        }
                        window.scrollTo({ top: y, behavior: 'smooth' });
                      }
                    };
                    // Su PC scroll immediato, su mobile delay di 50ms
                    if (isMobile) {
                      setTimeout(scrollToElement, 50);
                    } else {
                      scrollToElement();
                    }
                  }}
                  className={`bg-white backdrop-blur-md hover:bg-white font-medium rounded-lg ${heroStyles.menuButtonPadding} flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg ${heroStyles.menuButtonHeight} ${heroStyles.menuButtonWidth} justify-center ${heroStyles.menuButtonText} touch-manipulation ${heroStyles.menuButtonBorder} uppercase shadow-2xl`}
                  style={{ borderColor: '#302438', color: '#302438', fontFamily: 'Oswald, sans-serif', fontWeight: '600', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 0, 0, 0.4)' }}
                >
                  <div className={`flex items-center justify-center ${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-lg bg-[#B0FB58]/20`}>
                    <img 
                      src="/g80/icona cornetta.png" 
                      alt="Contatti" 
                      className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} object-contain`}
                    />
                  </div>
                  <span>Contatti</span>
                </a>
                {isAdmin && !adminLoading && (
                  <>
                    <button
                      onClick={() => handleSwitchChange(!isAdminView)}
                      className={`bg-white backdrop-blur-md hover:bg-white font-medium rounded-lg ${heroStyles.menuButtonPadding} flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg ${heroStyles.menuButtonHeight} ${heroStyles.menuButtonWidth} justify-center ${heroStyles.menuButtonText} touch-manipulation ${heroStyles.menuButtonBorder} uppercase shadow-2xl`}
                      style={{ borderColor: '#302438', color: '#302438', fontFamily: 'Oswald, sans-serif', fontWeight: '600', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 0, 0, 0.4)' }}
                    >
                      <div className={`flex items-center justify-center ${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-lg bg-[#B0FB58]/20`}>
                        <svg 
                          className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-[#302438]`}
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
                      <span>{isAdminView ? 'Vista Utente' : 'Vista Admin'}</span>
                    </button>
                    <button
                      onClick={async () => {
                        await signOut();
                      }}
                      className={`bg-white backdrop-blur-md hover:bg-white font-medium rounded-lg ${heroStyles.menuButtonPadding} flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg ${heroStyles.menuButtonHeight} ${heroStyles.menuButtonWidth} justify-center ${heroStyles.menuButtonText} touch-manipulation ${heroStyles.menuButtonBorder} uppercase shadow-2xl`}
                      style={{ borderColor: '#302438', color: '#DC2626', fontFamily: 'Oswald, sans-serif', fontWeight: '600', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 0, 0, 0.4)' }}
                    >
                      <div className={`flex items-center justify-center ${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-lg bg-red-100`}>
                        <LogOut className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-red-600`} />
                      </div>
                      <span>Logout</span>
                    </button>
                  </>
                )}
                {!loading && user && !isAdmin && (
                  <>
                    <button
                      onClick={async () => {
                        await signOut();
                      }}
                      className={`bg-white backdrop-blur-md hover:bg-white font-medium rounded-lg ${heroStyles.menuButtonPadding} flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg ${heroStyles.menuButtonHeight} ${heroStyles.menuButtonWidth} justify-center ${heroStyles.menuButtonText} touch-manipulation ${heroStyles.menuButtonBorder} uppercase shadow-2xl`}
                      style={{ borderColor: '#302438', color: '#DC2626', fontFamily: 'Oswald, sans-serif', fontWeight: '600', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 0, 0, 0.4)' }}
                    >
                      <div className={`flex items-center justify-center ${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-lg bg-red-100`}>
                        <LogOut className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-red-600`} />
                      </div>
                      <span>Logout</span>
                    </button>
                  </>
                )}
                {!loading && !user && (
                  <>
                    <Link 
                      to="/auth"
                      className={`bg-white backdrop-blur-md hover:bg-white font-medium rounded-lg ${heroStyles.menuButtonPadding} flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg ${heroStyles.menuButtonHeight} ${heroStyles.menuButtonWidth} justify-center ${heroStyles.menuButtonText} touch-manipulation ${heroStyles.menuButtonBorder} uppercase shadow-2xl`}
                      style={{ borderColor: '#302438', color: '#2563EB', fontFamily: 'Oswald, sans-serif', fontWeight: '600', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 0, 0, 0.4)' }}
                    >
                      <div className={`flex items-center justify-center ${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-lg bg-blue-100`}>
                        <img 
                          src="/g80/icona accedi.png" 
                          alt="Accedi" 
                          className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} object-contain`}
                        />
                      </div>
                      <span>Accedi</span>
                    </Link>
                    <Link 
                      to="/auth?mode=register"
                      className={`bg-white backdrop-blur-md hover:bg-white font-medium rounded-lg ${heroStyles.menuButtonPadding} flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg ${heroStyles.menuButtonHeight} ${heroStyles.menuButtonWidth} justify-center ${heroStyles.menuButtonText} touch-manipulation ${heroStyles.menuButtonBorder} uppercase shadow-2xl`}
                      style={{ borderColor: '#302438', color: '#059669', fontFamily: 'Oswald, sans-serif', fontWeight: '600', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 0, 0, 0.4)' }}
                    >
                      <div className={`flex items-center justify-center ${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-lg bg-green-100`}>
                        <img 
                          src="/g80/icona registrati.png" 
                          alt="Registrati" 
                          className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} object-contain`}
                        />
                      </div>
                      <span>Registrati</span>
                    </Link>
                  </>
                )}
                </div>
              )}
            </div>
            
            {/* Icona hamburger quando scrolli - modernizzata - Solo su mobile */}
            {scrolled && scrollProgress > 0.3 && isMobile && (
              <div className="relative menu-container">
                <Button 
                  variant="outline"
                  onClick={() => setMenuHovered(!menuHovered)}
                  className={`bg-white/90 backdrop-blur-md hover:bg-white text-[#302438] ${isMobile ? 'border-2 rounded-lg p-1.5' : 'border-4 rounded-xl p-4'} flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg`}
                  style={{ 
                    borderColor: '#302438', 
                    minWidth: isMobile ? '32px' : '48px', 
                    minHeight: isMobile ? '32px' : '48px',
                    width: isMobile ? '32px' : '48px',
                    height: isMobile ? '32px' : '48px'
                  }}
                >
                  <svg 
                    className={`${isMobile ? 'w-4 h-4' : 'w-7 h-7'} transition-transform duration-300 ${menuHovered ? 'rotate-90' : ''}`}
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
                
                {/* Menu dropdown moderno che appare al click quando scrolli */}
                {menuHovered && scrolled && (
                  <div 
                    className={`absolute top-full right-0 mt-2 ${isMobile ? 'w-[280px] min-w-[280px]' : 'w-[240px]'} bg-white rounded-2xl shadow-2xl border-2 md:border-4 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2`}
                    style={{ 
                      borderColor: '#302438',
                      animation: 'fadeInScale 0.3s ease-out',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
                      ...(isMobile && { left: 'auto', right: '0.5rem' })
                    }}
                  >
                    <div className="p-2.5">
                      <a 
                        href="#dove-siamo"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuHovered(false);
                          const scrollToElement = () => {
                            const element = document.getElementById('dove-siamo');
                            if (element) {
                              const yOffset = -50;
                              const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                              // Su PC: completa la transizione immediatamente, poi scrolla
                              if (!isMobile) {
                                setScrollProgress(1);
                                setScrolled(true);
                              }
                              window.scrollTo({ top: y, behavior: 'smooth' });
                            }
                          };
                          // Su PC scroll immediato, su mobile delay di 50ms
                          if (isMobile) {
                            setTimeout(scrollToElement, 50);
                          } else {
                            scrollToElement();
                          }
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-[#B0FB58]/10 hover:to-[#B0FB58]/20 active:bg-[#B0FB58]/20 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation"
                      >
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#B0FB58]/20 group-hover:bg-[#B0FB58]/30 transition-colors">
                          <img 
                            src="/g80/icona cornetta.png" 
                            alt="Contatti" 
                            className="h-5 w-5 object-contain"
                          />
                        </div>
                        <span className="text-base md:text-base font-semibold text-[#302438] group-hover:text-[#302438]" style={{ fontFamily: 'Oswald, sans-serif' }}>
                          Contatti
                        </span>
                      </a>
                      {isAdmin && !adminLoading && (
                        <>
                          <button
                            onClick={() => {
                              setMenuHovered(false);
                              handleSwitchChange(!isAdminView);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-[#B0FB58]/10 hover:to-[#B0FB58]/20 active:bg-[#B0FB58]/20 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#B0FB58]/20 group-hover:bg-[#B0FB58]/30 transition-colors">
                              <svg 
                                className="h-4 w-4 text-[#302438]"
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
                            <span className="text-sm md:text-base font-semibold text-[#302438] group-hover:text-[#302438]" style={{ fontFamily: 'Oswald, sans-serif' }}>
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
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 group-hover:bg-red-200 transition-colors">
                              <LogOut className="h-4 w-4 text-red-600" />
                            </div>
                            <span className="text-sm md:text-base font-semibold text-red-600 group-hover:text-red-700" style={{ fontFamily: 'Oswald, sans-serif' }}>
                              Logout
                            </span>
                          </button>
                        </>
                      )}
                      {!loading && user && !isAdmin && (
                        <>
                          <button
                            onClick={async () => {
                              setMenuHovered(false);
                              await signOut();
                            }}
                            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 active:bg-red-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 group-hover:bg-red-200 transition-colors">
                              <LogOut className="h-4 w-4 text-red-600" />
                            </div>
                            <span className="text-sm md:text-base font-semibold text-red-600 group-hover:text-red-700" style={{ fontFamily: 'Oswald, sans-serif' }}>
                              Logout
                            </span>
                          </button>
                        </>
                      )}
                      {!loading && !user && (
                        <>
                          <div 
                            onClick={(e) => {
                              e.preventDefault();
                              setMenuHovered(false);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 active:bg-blue-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation cursor-not-allowed"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                              <img 
                                src="/g80/icona accedi.png" 
                                alt="Accedi" 
                                className="h-4 w-4 object-contain"
                              />
                            </div>
                            <span className="text-sm md:text-base font-semibold text-blue-600 group-hover:text-blue-700 uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                              Accedi
                            </span>
                          </div>
                          <div 
                            onClick={(e) => {
                              e.preventDefault();
                              setMenuHovered(false);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 active:bg-green-100 transition-all duration-200 min-h-[48px] md:min-h-[52px] group touch-manipulation cursor-not-allowed"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors">
                              <img 
                                src="/g80/icona registrati.png" 
                                alt="Registrati" 
                                className="h-4 w-4 object-contain"
                              />
                            </div>
                            <span className="text-sm md:text-base font-semibold text-green-600 group-hover:text-green-700 uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                              Registrati
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Sezione Foto - Scarponi e Laboratorio */}
      <section className="py-16 md:py-24 px-4 md:px-8 bg-white">
        <div className="container mx-auto max-w-7xl">
          {/* Titolo della sezione */}
          <div className="text-center mb-12 md:mb-16 animate-fade-in-up">
            <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: '#5F5F5F', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}>
              LA NOSTRA REALTÀ
            </h2>
            <p className="text-lg md:text-xl text-[#302438] max-w-2xl mx-auto text-center" style={{ fontFamily: 'Oswald, sans-serif' }}>
              Scopri la cura e passione che dedichiamo ai nostri servizi nel negozio di Asti!
            </p>
          </div>

          {/* Grid delle foto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* Foto 1 - Scarponi */}
            <div className="group animate-fade-in-up">
              <div className="relative overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10 group-hover:from-black/10 transition-all duration-300"></div>
                <img 
                  src="/Foto negozio/Logo negozio.jpg" 
                  alt="Logo negozio" 
                  className="w-full aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="relative mt-6 p-6 md:p-8 bg-gradient-to-br from-[#302438] via-[#2a1f35] to-[#302438] rounded-2xl shadow-2xl border-2 transition-all duration-300 hover:shadow-3xl hover:scale-[1.01]" style={{ borderColor: '#302438', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' }}>
                {/* Decorazione angolo superiore sinistro */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 rounded-tl-2xl border-white/20"></div>
                {/* Decorazione angolo inferiore destro */}
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 rounded-br-2xl border-white/20"></div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700', letterSpacing: '0.05em' }}>
                  PUNTO DI RIFERIMENTO
                </h3>
                <p className="text-white/95 text-base md:text-lg font-bold mb-4 leading-relaxed text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Da oltre 35 anni il punto di riferimento ad Asti per sciatori e snowboarder.
                </p>
                <div className="w-20 h-0.5 mx-auto my-4 rounded-full bg-white/30 relative z-10"></div>
                <p className="text-white/80 text-sm md:text-base leading-relaxed text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Un negozio specializzato dove trovare attrezzature e accessori di qualità, selezionata dai migliori marchi per garantire comfort, sicurezza e divertimento sulla neve.
                </p>
              </div>
            </div>

            {/* Foto 2 - Laboratorio */}
            <div className="group animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="relative overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10 group-hover:from-black/10 transition-all duration-300"></div>
                <img 
                  src="/Foto negozio/scarponi mix.jpg" 
                  alt="Scarponi mix" 
                  className="w-full aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="relative mt-6 p-6 md:p-8 bg-gradient-to-br from-[#302438] via-[#2a1f35] to-[#302438] rounded-2xl shadow-2xl border-2 transition-all duration-300 hover:shadow-3xl hover:scale-[1.01]" style={{ borderColor: '#302438', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' }}>
                {/* Decorazione angolo superiore sinistro */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 rounded-tl-2xl border-white/20"></div>
                {/* Decorazione angolo inferiore destro */}
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 rounded-br-2xl border-white/20"></div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700', letterSpacing: '0.05em' }}>
                  SERVIZIO NOLEGGIO
                </h3>
                <p className="text-white/95 text-base md:text-lg font-bold mb-4 leading-relaxed text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Tutto il necessario per la tua giornata sulla neve, senza pensieri.
                </p>
                <div className="w-20 h-0.5 mx-auto my-4 rounded-full bg-white/30 relative z-10"></div>
                <p className="text-white/80 text-sm md:text-base leading-relaxed text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Un servizio di noleggio comodo e conveniente, ideale per chi vuole divertirsi senza acquistare l'attrezzatura. Perfetto per principianti, famiglie e appassionati in vacanza.
                </p>
              </div>
            </div>
          </div>

          {/* Sezione aggiuntiva con altre foto */}
          <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* Foto Scarponi dettaglio */}
            <div className="group animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="relative overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10 group-hover:from-black/10 transition-all duration-300"></div>
                <img 
                  src="/Foto negozio/sci noleggio.jpg" 
                  alt="Sci noleggio" 
                  className="w-full aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="relative mt-6 p-6 md:p-8 bg-gradient-to-br from-[#302438] via-[#2a1f35] to-[#302438] rounded-2xl shadow-2xl border-2 transition-all duration-300 hover:shadow-3xl hover:scale-[1.01]" style={{ borderColor: '#302438', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' }}>
                {/* Decorazione angolo superiore sinistro */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 rounded-tl-2xl border-white/20"></div>
                {/* Decorazione angolo inferiore destro */}
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 rounded-br-2xl border-white/20"></div>
                <h4 className="text-xl md:text-2xl font-bold text-white mb-4 text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700', letterSpacing: '0.05em' }}>
                  QUALITÀ E VARIETÀ
                </h4>
                <p className="text-white/95 text-base md:text-lg font-bold mb-4 leading-relaxed text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Sci, snowboard, ciaspole, scarponi, caschi e molto altro.
                </p>
                <div className="w-20 h-0.5 mx-auto my-4 rounded-full bg-white/30 relative z-10"></div>
                <p className="text-white/80 text-sm md:text-base leading-relaxed text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Articoli performanti e selezionati per qualità, comfort e sicurezza, adatti sia per attività amatoriali che professionali. Attrezzature controllate, moderne e sempre pronte all'uso.
                </p>
              </div>
            </div>

            {/* Foto Laboratorio dettaglio */}
            <div className="group animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
              <div className="relative overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10 group-hover:from-black/10 transition-all duration-300"></div>
                <img 
                  src="/Foto negozio/foto riparazione sci.jpeg" 
                  alt="Riparazione sci" 
                  className="w-full aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="relative mt-6 p-6 md:p-8 bg-gradient-to-br from-[#302438] via-[#2a1f35] to-[#302438] rounded-2xl shadow-2xl border-2 transition-all duration-300 hover:shadow-3xl hover:scale-[1.01]" style={{ borderColor: '#302438', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' }}>
                {/* Decorazione angolo superiore sinistro */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 rounded-tl-2xl border-white/20"></div>
                {/* Decorazione angolo inferiore destro */}
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 rounded-br-2xl border-white/20"></div>
                <h4 className="text-xl md:text-2xl font-bold text-white mb-4 text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700', letterSpacing: '0.05em' }}>
                  LABORATORIO SPECIALIZZATO
                </h4>
                <p className="text-white/95 text-base md:text-lg font-bold mb-4 leading-relaxed text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Manutenzione professionale con Skiman certificato e tecnologia Montana.
                </p>
                <div className="w-20 h-0.5 mx-auto my-4 rounded-full bg-white/30 relative z-10"></div>
                <p className="text-white/80 text-sm md:text-base leading-relaxed text-center relative z-10" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Affidati al nostro laboratorio per una cura impeccabile dei tuoi sci: lavorazioni a pietra e diamante per massime prestazioni e durata nel tempo.
                </p>
              </div>
            </div>
          </div>

          {/* Testo descrittivo finale */}
          <div className="mt-12 md:mt-16 max-w-4xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
            <div className="relative bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl p-8 md:p-12 shadow-2xl border-2 transition-all duration-300 hover:shadow-3xl hover:scale-[1.01]" style={{ borderColor: '#302438', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(48, 36, 56, 0.1)' }}>
              {/* Decorazione angolo superiore sinistro */}
              <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 rounded-tl-2xl" style={{ borderColor: '#302438' }}></div>
              {/* Decorazione angolo inferiore destro */}
              <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 rounded-br-2xl" style={{ borderColor: '#302438' }}></div>
              
              <h3 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center relative z-10" style={{ color: '#302438', fontFamily: 'Oswald, sans-serif', fontWeight: '700', letterSpacing: '0.05em' }}>
                ESPERIENZA E PASSIONE
              </h3>
              <div className="space-y-6 text-[#302438] text-base md:text-lg leading-relaxed relative z-10" style={{ fontFamily: 'Oswald, sans-serif' }}>
                <p className="text-center font-bold text-lg md:text-xl" style={{ color: '#302438' }}>
                  35 anni di esperienza al servizio della tua passione per la montagna.
                </p>
                <div className="w-24 h-1 mx-auto my-6 rounded-full" style={{ backgroundColor: '#302438', opacity: 0.3 }}></div>
                <p className="text-center text-[#302438]/90">
                  G80 Sport nasce per offrire prodotti affidabili, funzionali e sicuri, supportati da uno staff competente e appassionato. Qui trovi consulenza, qualità e soluzioni per ogni esigenza: dal principiante allo sportivo esperto.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sezione Marchi */}
      <section className="pt-4 md:pt-6 pb-16 md:pb-24 px-4 md:px-8 bg-white">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12 md:mb-16 animate-fade-in-up">
            <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: '#5F5F5F', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}>
              I NOSTRI MARCHI
            </h2>
          </div>
          
          {/* Carosello */}
          <div className="relative overflow-hidden py-8">
            <div className="flex animate-scroll">
              {/* Prima serie di loghi */}
              <div className="flex gap-16 items-center flex-shrink-0">
                <img 
                  src="/leki-logo-png_seeklogo-485832.png" 
                  alt="Leki" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img 
                  src="/Nordica_Logo_2017.svg.png" 
                  alt="Nordica" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img 
                  src="/Rossignol-emblem.png" 
                  alt="Rossignol" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img 
                  src="/Salomon_group_logo.png" 
                  alt="Salomon" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img 
                  src="/Atomic-logo.svg.png" 
                  alt="Atomic" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img 
                  src="/Logo_Völkl.svg.png" 
                  alt="Völkl" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
              </div>
              {/* Seconda serie (per loop continuo) */}
              <div className="flex gap-16 items-center flex-shrink-0">
                <img 
                  src="/leki-logo-png_seeklogo-485832.png" 
                  alt="Leki" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img 
                  src="/Nordica_Logo_2017.svg.png" 
                  alt="Nordica" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img 
                  src="/Rossignol-emblem.png" 
                  alt="Rossignol" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img 
                  src="/Salomon_group_logo.png" 
                  alt="Salomon" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img 
                  src="/Atomic-logo.svg.png" 
                  alt="Atomic" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img 
                  src="/Logo_Völkl.svg.png" 
                  alt="Völkl" 
                  className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sezione Recensioni Google */}
      <section className="pt-8 md:pt-12 pb-8 md:pb-12 px-4 md:px-8 bg-gray-50">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12 md:mb-16 animate-fade-in-up">
            <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: '#5F5F5F', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}>
              COSA DICONO DI NOI
            </h2>
            <p className="text-lg md:text-xl text-[#302438] max-w-2xl mx-auto" style={{ fontFamily: 'Oswald, sans-serif' }}>
              Le recensioni dei nostri clienti su Google
            </p>
          </div>

          {/* Carosello Recensioni */}
          <div className="max-w-5xl mx-auto">
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              setApi={setCarouselApi}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {[
                  {
                    name: "Angelo Risi",
                    rating: 5,
                    text: "Super gentili e professionali, prezzi ottimi.",
                  },
                  {
                    name: "Giulia Giaccone",
                    rating: 5,
                    text: "Comprato scarponi lo scorso anno ma mai usati, sci acquistati un paio di settimane fa…scarponi super comodi e sci veramente top, personale molto competente e gentile!!!",
                  },
                  {
                    name: "Elisa Valerio",
                    rating: 4,
                    text: "Personale molto preparato, cortese che offre una serie di articoli sportivi di ottima qualità. Io ho usufruito del loro servizio usato per scarponi e sci per mio figlio in continua crescita e quindi con cambio annuale..grazie per i consigli e per la pazienza.",
                  },
                  {
                    name: "Luciana Pietronave",
                    rating: 5,
                    text: "Grande professionalità e cortesia. Acquistato sci top di gamma a un prezzo ottimo. Consigli tecnici preziosi. Grazie per la gentilezza",
                  },
                  {
                    name: "Marco Di Giglio",
                    rating: 5,
                    text: "Molto competenti e disponibili. L'alta specializzazione del negozio fa la differenza. Decisamente consigliato.",
                  },
                  {
                    name: "Antonino Schifano",
                    rating: 5,
                    text: "Da sempre professionali al Top! Fornitissimi ed a prezzi decisamente più competitivi. Consigliatissimo",
                  },
                  {
                    name: "Giovanni Fongo",
                    rating: 5,
                    text: "Negozio specializzato per l inverno. La professionalità e gli ottimi consigli abbinati all ampia scelta dei materiali sempre al top",
                  },
                  {
                    name: "Maxmilian Marin",
                    rating: 5,
                    text: "Professionisti con esperienza pluriennale, competenza e cortesia. Mai conosciuto di meglio in zona.",
                  },
                  {
                    name: "Dario Cimino",
                    rating: 4,
                    text: "Personale gentile e accogliente, buon rifornimento di tutto il materiale per la montagna ⛰️",
                  },
                ].map((review, index) => (
                  <CarouselItem key={index} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
                    <div className="bg-white rounded-lg p-6 md:p-8 shadow-lg border-4 h-full flex flex-col" style={{ borderColor: '#302438' }}>
                      {/* Stelle */}
                      <div className="flex gap-1 mb-4">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-5 w-5 ${
                              i < review.rating
                                ? "fill-[#E31E24] text-[#E31E24]"
                                : "fill-gray-200 text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      
                      {/* Testo recensione */}
                      <p className="text-[#302438] text-base md:text-lg leading-relaxed text-justify mb-6 flex-grow" style={{ fontFamily: 'Oswald, sans-serif' }}>
                        "{review.text}"
                      </p>
                      
                      {/* Nome */}
                      <div className="border-t-2 pt-4" style={{ borderColor: '#302438' }}>
                        <p className="font-bold text-[#302438] text-lg" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}>
                          {review.name}
                        </p>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex -left-12" style={{ borderColor: '#302438', color: '#302438' }} />
              <CarouselNext className="hidden md:flex -right-12" style={{ borderColor: '#302438', color: '#302438' }} />
            </Carousel>

            {/* Link a Google Reviews */}
            <div className="text-center mt-4">
              <a
                href="https://www.google.com/maps/place/G80+Sport/@44.9030802,8.1881924,472m/data=!3m2!1e3!4b1!4m8!3m7!1s0x4787933299d1b107:0x6bc8c171b43ad7a7!8m2!3d44.9030764!4d8.1907673!9m1!1b1!16s%2Fg%2F11c1pqz856?entry=ttu&g_ep=EgoyMDI1MTIwOS4wIKXMDSoKLDEwMDc5MjA2OUgBUAM%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#302438] hover:text-[#302438] transition-colors text-base md:text-lg font-semibold"
                style={{ fontFamily: 'Oswald, sans-serif' }}
              >
                <span>Vedi tutte le recensioni su</span>
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

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
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.05);
          }
        }
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in-up-delay {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          60% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes fade-in-delay {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes text-shimmer {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }
        .animate-scroll {
          display: flex;
          animation: scroll 30s linear infinite;
          will-change: transform;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        .animate-slide-up {
          animation: slide-up 1s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out;
        }
        .animate-fade-in-up-delay {
          animation: fade-in-up-delay 1.5s ease-out;
        }
        .animate-slide-in-left {
          animation: slide-in-left 1s ease-out;
        }
        .animate-slide-in-right {
          animation: slide-in-right 1s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 1.2s ease-out;
        }
        .animate-fade-in-delay {
          animation: fade-in-delay 1.8s ease-out;
        }
        .animate-text-shimmer {
          background: linear-gradient(90deg, #fff 0%, #3fafa3 50%, #fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: text-shimmer 3s linear infinite;
        }
        .touch-manipulation {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .text-shadow-sm {
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        .text-shadow-md {
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        @media (max-width: 768px) {
          /* Miglioramenti per mobile */
          button, a {
            -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
          }
        }
      `}</style>

      {/* Sezione Dove Siamo */}
      <section id="dove-siamo" className="pt-4 md:pt-6 pb-16 md:pb-24 px-4 md:px-8 bg-white">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12 md:mb-16 animate-fade-in-up">
            <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: '#5F5F5F', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}>
              DOVE SIAMO
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-stretch">
            {/* Informazioni indirizzo e contatti */}
            <div className="animate-fade-in-up space-y-4 md:col-span-1">
              {/* Indirizzo */}
              <div className="bg-gray-50 rounded-lg p-4 md:p-5 shadow-lg">
                <h3 className="text-xl md:text-2xl font-bold mb-3" style={{ color: '#5F5F5F', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}>
                  INDIRIZZO
                </h3>
                <div className="space-y-2">
                  <p className="text-[#302438] text-base md:text-lg leading-relaxed" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    <span className="font-bold">Corso Torino, 149</span><br />
                    Asti, 14100
                  </p>
                </div>
              </div>

              {/* Contatti */}
              <div className="bg-gray-50 rounded-lg p-4 md:p-5 shadow-lg">
                <h3 className="text-xl md:text-2xl font-bold mb-3" style={{ color: '#5F5F5F', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}>
                  CONTATTI
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-[#302438] flex-shrink-0" />
                    <a href="tel:+390141530116" className="text-[#302438] text-base md:text-lg hover:text-[#302438] transition-colors font-semibold" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      +39 0141 530116
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-[#302438] flex-shrink-0" />
                    <a href="mailto:giottto@gmail.com" className="text-[#302438] text-base md:text-lg hover:text-[#302438] transition-colors" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      giottto@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Orari */}
              <div className="bg-gray-50 rounded-lg p-4 md:p-5 shadow-lg">
                <h3 className="text-xl md:text-2xl font-bold mb-3" style={{ color: '#5F5F5F', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}>
                  ORARI
                </h3>
                <div className="space-y-2">
                  <div className="text-[#302438] text-base md:text-lg leading-relaxed" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    <p><span className="font-bold">Lunedì</span><br />15:00 - 19:30</p>
                  </div>
                  <div className="text-[#302438] text-base md:text-lg leading-relaxed" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    <p><span className="font-bold">Martedì - Sabato</span><br />9:30 - 12:30 / 15:00 - 19:30</p>
                  </div>
                  <div className="text-[#302438] text-base md:text-lg leading-relaxed" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    <p><span className="font-bold">Domenica</span><br />Chiuso</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mappa Google Maps */}
            <div className="animate-fade-in-up md:col-span-2" style={{ animationDelay: '0.2s' }}>
              <div className="rounded-lg overflow-hidden shadow-lg">
                <iframe
                  src="https://www.google.com/maps?q=Corso+Torino+149,+Asti+14100&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-[300px] md:h-full md:min-h-[600px]"
                  title="Mappa G80 Sport - Corso Torino 149, Asti 14100"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
