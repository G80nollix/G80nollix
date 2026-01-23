import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { Loader2 } from "lucide-react";

export default function PaymentProcessing() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const sessionId = searchParams.get("session_id");

  // Debug: log URL completo
  useEffect(() => {
    console.log('[PAYMENT-PROCESSING] Page loaded', {
      fullUrl: window.location.href,
      sessionId,
      searchParams: Object.fromEntries(searchParams.entries())
    });
  }, []);
  
  const [status, setStatus] = useState<'waiting' | 'checking' | 'confirmed' | 'error'>('waiting');
  const [elapsedTime, setElapsedTime] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isConfirmedRef = useRef<boolean>(false);

  // ✅ Attendi che l'autenticazione sia completata prima di controllare
  useEffect(() => {
    console.log('[PAYMENT-PROCESSING] Effect triggered', { 
      sessionId, 
      userId: user?.id, 
      authLoading 
    });

    // Se ancora in loading, aspetta
    if (authLoading) {
      console.log('[PAYMENT-PROCESSING] Auth still loading, waiting...');
      return;
    }

    // Se non c'è sessionId, reindirizza
    if (!sessionId) {
      console.error('[PAYMENT-PROCESSING] No session_id in URL, redirecting to cart');
      navigate('/cart');
      return;
    }

    // Se l'utente non è autenticato, reindirizza
    if (!user?.id) {
      console.error('[PAYMENT-PROCESSING] User not authenticated, redirecting to cart');
      navigate('/cart');
      return;
    }

    console.log('[PAYMENT-PROCESSING] Starting payment processing', { sessionId, userId: user.id });

    // ✅ VALIDAZIONE FORMATO SESSION ID
    if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)) {
      console.error('[PAYMENT-PROCESSING] ❌ Session ID format invalid:', sessionId);
      setStatus('error');
      return;
    }

    console.log('[PAYMENT-PROCESSING] ✅ Session ID format valid:', sessionId);

    // ✅ CREA CHANNEL UNICO
    const channelId = `payment-${sessionId}-${Date.now()}`;
    console.log('[PAYMENT-PROCESSING] 📡 Creating Realtime channel:', channelId);
    const channel = supabase.channel(channelId);
    channelRef.current = channel;

    // ✅ SUBSCRIPTION A POSTGRES_CHANGES con filtro specifico
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `stripe_checkout_session_id=eq.${sessionId}`, // ← Filtro specifico
      },
      (payload) => {
        console.log('[PAYMENT-PROCESSING] 📨 Realtime update received:', {
          event: payload.eventType,
          table: payload.table,
          new: payload.new,
          old: payload.old
        });
        
        // ✅ Verifica che sia confermato
        const newStatus = payload.new.status;
        const newCart = payload.new.cart;
        
        console.log('[PAYMENT-PROCESSING] 🔍 Checking booking status:', {
          status: newStatus,
          cart: newCart,
          isConfirmed: newStatus === 'confirmed' && newCart === false
        });
        
        if (newStatus === 'confirmed' && newCart === false) {
          console.log('[PAYMENT-PROCESSING] ✅ Payment confirmed via Realtime! Redirecting to booking-confirmation');
          isConfirmedRef.current = true;
          setStatus('confirmed');
          
          // Cleanup
          if (channelRef.current) {
            console.log('[PAYMENT-PROCESSING] 🧹 Unsubscribing from Realtime channel');
            channelRef.current.unsubscribe();
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
          }
          
          // Reindirizza immediatamente
          console.log('[PAYMENT-PROCESSING] 🔀 Navigating to /booking-confirmation');
          navigate(`/booking-confirmation?session_id=${sessionId}`);
        } else {
          console.log('[PAYMENT-PROCESSING] ⏳ Booking not yet confirmed:', {
            status: newStatus,
            cart: newCart,
            reason: newStatus !== 'confirmed' ? 'Status is not confirmed' : 'Cart is still true'
          });
        }
      }
    )
    .subscribe((subscriptionStatus) => {
      if (subscriptionStatus === 'SUBSCRIBED') {
        console.log('[PAYMENT-PROCESSING] ✅ Successfully subscribed to Realtime channel');
        console.log('[PAYMENT-PROCESSING] 👂 Listening for updates on bookings table with filter:', {
          filter: `stripe_checkout_session_id=eq.${sessionId}`,
          event: 'UPDATE'
        });
        setStatus('waiting');
      } else if (subscriptionStatus === 'CHANNEL_ERROR') {
        console.error('[PAYMENT-PROCESSING] ❌ Channel error, will use fallback after timeout');
        // Non fare nulla, useremo il fallback dopo 5 secondi
      } else {
        console.log('[PAYMENT-PROCESSING] 📊 Subscription status:', subscriptionStatus);
      }
    });

    // ✅ TIMEOUT DI SICUREZZA: dopo 5 secondi, fallback a Stripe API
    timeoutRef.current = setTimeout(() => {
      if (!isConfirmedRef.current) {
        console.log('[PAYMENT-PROCESSING] ⏰ Timeout reached (5 seconds), Realtime did not receive confirmation');
        console.log('[PAYMENT-PROCESSING] 🔄 Falling back to Stripe API check');
        checkStripeAPI();
      } else {
        console.log('[PAYMENT-PROCESSING] ✅ Already confirmed via Realtime, skipping API check');
      }
    }, 5000);

    // ✅ TIMER PER MOSTRARE PROGRESSO
    progressTimerRef.current = setInterval(() => {
      setElapsedTime(prev => {
        if (prev >= 5000) {
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
          }
          return prev;
        }
        return prev + 100;
      });
    }, 100);

    // ✅ CLEANUP GARANTITO
    return () => {
      console.log('[PAYMENT-PROCESSING] 🧹 Cleanup: unsubscribing and clearing timers');
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        console.log('[PAYMENT-PROCESSING] 🧹 Realtime channel unsubscribed');
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        console.log('[PAYMENT-PROCESSING] 🧹 Timeout cleared');
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        console.log('[PAYMENT-PROCESSING] 🧹 Progress timer cleared');
      }
    };
  }, [sessionId, user?.id, navigate, authLoading]);

  // ✅ FALLBACK: Chiama Stripe API se Realtime non trova aggiornamenti
  const checkStripeAPI = async () => {
    if (!sessionId || !user?.id) {
      console.error('[PAYMENT-PROCESSING] ❌ Cannot check Stripe API: missing sessionId or userId', {
        sessionId,
        userId: user?.id
      });
      return;
    }
    
    console.log('[PAYMENT-PROCESSING] 🔍 Starting Stripe API check', {
      sessionId,
      userId: user.id
    });
    setStatus('checking');
    
    try {
      // Chiama la Edge Function unificata
      console.log('[PAYMENT-PROCESSING] 📞 Calling Edge Function: check-and-confirm-payment');
      const { data, error } = await supabase.functions.invoke(
        'check-and-confirm-payment',
        {
          method: 'POST',
          body: { sessionId },
        }
      );

      console.log('[PAYMENT-PROCESSING] 📥 Edge Function response received:', {
        hasError: !!error,
        hasData: !!data,
        success: data?.success,
        paymentIntentStatus: data?.paymentIntentStatus,
        bookingStatus: data?.bookingStatus,
        error: error || data?.error,
        fullResponse: data
      });

      // Gestione errori
      if (error || !data?.success) {
        console.error('[PAYMENT-PROCESSING] ❌ Error from Edge Function:', {
          error,
          dataError: data?.error,
          message: data?.message,
          fullData: data
        });
        console.log('[PAYMENT-PROCESSING] 🔀 Redirecting to /payment-error due to error');
        setStatus('error');
        navigate(`/payment-error?session_id=${sessionId}`);
        return;
      }

      // Logica con PaymentIntent status
      const paymentIntentStatus = data?.paymentIntentStatus;
      const bookingStatus = data?.bookingStatus;

      console.log('[PAYMENT-PROCESSING] 🎯 PaymentIntent status:', paymentIntentStatus);
      console.log('[PAYMENT-PROCESSING] 📋 Booking status:', bookingStatus);

      if (paymentIntentStatus === 'succeeded') {
        console.log('[PAYMENT-PROCESSING] ✅ Payment succeeded! Redirecting to booking-confirmation');
        setStatus('confirmed');
        navigate(`/booking-confirmation?session_id=${sessionId}`);
      } else if (paymentIntentStatus === 'canceled') {
        console.log('[PAYMENT-PROCESSING] ❌ Payment canceled! Redirecting to payment-error');
        setStatus('error');
        navigate(`/payment-error?session_id=${sessionId}`);
      } else if (paymentIntentStatus === 'processing') {
        console.log('[PAYMENT-PROCESSING] ⏳ Payment processing! Redirecting to payment-in-progress');
        navigate(`/payment-in-progress?session_id=${sessionId}`);
      } else {
        // Per tutti gli altri stati (requires_payment_method, requires_confirmation, ecc.)
        console.log('[PAYMENT-PROCESSING] ⚠️ Payment in other state:', paymentIntentStatus);
        console.log('[PAYMENT-PROCESSING] 🔀 Redirecting to payment-in-progress (other states)');
        navigate(`/payment-in-progress?session_id=${sessionId}`);
      }
    } catch (error) {
      console.error('[PAYMENT-PROCESSING] ❌ Exception caught in checkStripeAPI:', error);
      console.log('[PAYMENT-PROCESSING] 🔀 Redirecting to /payment-error due to exception');
      setStatus('error');
      navigate(`/payment-error?session_id=${sessionId}`);
    }
  };

  // ✅ Mostra loading mentre verifica autenticazione
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
        <FixedNavbar />
        <div className="flex-1 container mx-auto px-4 py-16 pt-20 md:pt-24 max-w-2xl">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Caricamento...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ✅ UI
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      <FixedNavbar />
      
      <div className="flex-1 container mx-auto px-4 py-16 max-w-2xl">
        <div className="text-center">
          {/* Icona di caricamento */}
          <div className="flex justify-center mb-6">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
          </div>

          {/* Titolo */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Conferma Pagamento in Corso...
          </h1>

          {/* Messaggio di stato */}
          <div className="space-y-4">
            {status === 'waiting' && (
              <p className="text-lg text-gray-600">
                Stiamo verificando il pagamento. Attendi un momento...
              </p>
            )}
            
            {status === 'checking' && (
              <p className="text-lg text-gray-600">
                Verifica pagamento tramite Stripe...
              </p>
            )}

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 max-w-md mx-auto">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-100"
                style={{ width: `${Math.min((elapsedTime / 5000) * 100, 100)}%` }}
              />
            </div>

            <p className="text-sm text-gray-500">
              {Math.max(0, Math.ceil((5000 - elapsedTime) / 1000))} secondi rimanenti...
            </p>
          </div>

          {/* Informazioni aggiuntive */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Se il pagamento è stato completato, 
              verrai reindirizzato automaticamente alla pagina di conferma.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

