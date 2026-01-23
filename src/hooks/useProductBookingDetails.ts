import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BookingDetail {
  id: string;
  booking_id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  bookings?: {
    status: string;
  };
}

export function useProductBookingDetails(productId?: string) {
  return useQuery({
    queryKey: ["product-booking-details", productId],
    queryFn: async () => {
      if (!productId) return [];
      
      console.log('Fetching booking_details for product:', productId);
      
      // Recupera booking_details per questo prodotto
      const { data: bookingDetails, error: detailsError } = await supabase
        .from("booking_details")
        .select("id, booking_id, unit_id, start_date, end_date")
        .eq("unit_id", productId);
      
      if (detailsError) {
        console.error('Error fetching booking_details:', detailsError);
        throw detailsError;
      }
      
      // Recupera le prenotazioni per filtrare per status e escludere cart
      if (bookingDetails && bookingDetails.length > 0) {
        const bookingIds = [...new Set(bookingDetails.map((d: any) => d.booking_id))];
        const { data: bookings, error: bookingsError } = await supabase
          .from("bookings")
          .select("id, status, cart")
          .in("id", bookingIds)
          .in("status", ["cart", "confirmed"]);
        
        if (bookingsError) {
          console.error('Error fetching bookings:', bookingsError);
          throw bookingsError;
        }
        
        // Filtra solo prenotazioni confermate (escludi cart)
        // Le prenotazioni nel carrello non sono ancora confermate
        const confirmedBookings = (bookings || []).filter((b: any) => !b.cart);
        const confirmedBookingIds = new Set(confirmedBookings.map((b: any) => b.id));
        
        // Filtra solo i booking_details con booking confermati (esclusi cart)
        const activeDetails = bookingDetails.filter((detail: any) => {
          return confirmedBookingIds.has(detail.booking_id);
        });
        
        console.log('Fetched active booking_details:', activeDetails);
        return activeDetails as BookingDetail[];
      }
      
      return [];
    },
    enabled: !!productId,
  });
}

