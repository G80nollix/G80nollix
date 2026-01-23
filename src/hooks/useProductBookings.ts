
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toItalianISOString } from "@/lib/utils";

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function useProductBookings(productId?: string, dateRange?: DateRange) {
  return useQuery({
    queryKey: ["product-bookings", productId, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      if (!productId) return [];
      
      console.log('Fetching bookings for product:', productId, 'with date range:', dateRange);
      
      try {
        // Step 1: Get product_variants for this product
        const { data: variants, error: variantsError } = await supabase
          .from('product_variants')
          .select('id')
          .eq('id_product', productId);
        
        if (variantsError) {
          console.error('Error fetching variants:', variantsError);
          throw variantsError;
        }
        
        if (!variants || variants.length === 0) {
          console.log('No variants found for product:', productId);
          return [];
        }
        
        const variantIds = variants.map(v => v.id);
        console.log('Found variants:', variantIds);
        
        // Step 2: Get product_units for these variants
        const { data: units, error: unitsError } = await supabase
          .from('product_units')
          .select('id')
          .in('id_product_variant', variantIds);
        
        if (unitsError) {
          console.error('Error fetching units:', unitsError);
          throw unitsError;
        }
        
        if (!units || units.length === 0) {
          console.log('No units found for variants:', variantIds);
          return [];
        }
        
        const unitIds = units.map(u => u.id);
        console.log('Found units:', unitIds);
        
        // Step 3: Get booking_details for these units
        let detailsQuery = supabase
          .from('booking_details')
          .select('booking_id, start_date, end_date')
          .in('unit_id', unitIds);
        
        // Apply date range filter if provided
        if (dateRange?.startDate && dateRange?.endDate) {
          detailsQuery = detailsQuery
            .lte('start_date', toItalianISOString(dateRange.endDate))
            .gte('end_date', toItalianISOString(dateRange.startDate));
        }
        
        const { data: details, error: detailsError } = await detailsQuery;
        
        if (detailsError) {
          console.error('Error fetching booking_details:', detailsError);
          throw detailsError;
        }
        
        if (!details || details.length === 0) {
          console.log('No booking_details found for units:', unitIds);
          return [];
        }
        
        const bookingIds = [...new Set(details.map(d => d.booking_id))];
        console.log('Found booking IDs:', bookingIds);
        
        // Step 4: Get bookings with filters
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .in('id', bookingIds)
          .in('status', ['cart', 'confirmed'])
          .order('created_at', { ascending: false });
        
        if (bookingsError) {
          console.error('Error fetching bookings:', bookingsError);
          throw bookingsError;
        }
        
        // Add start_date and end_date from booking_details to each booking
        const detailsMap = new Map<string, { start_date: string | null, end_date: string | null }>();
        details.forEach((detail: any) => {
          const existing = detailsMap.get(detail.booking_id);
          if (!existing) {
            detailsMap.set(detail.booking_id, {
              start_date: detail.start_date,
              end_date: detail.end_date
            });
          } else {
            // Take min start_date and max end_date if multiple details per booking
            if (detail.start_date && (!existing.start_date || detail.start_date < existing.start_date)) {
              existing.start_date = detail.start_date;
            }
            if (detail.end_date && (!existing.end_date || detail.end_date > existing.end_date)) {
              existing.end_date = detail.end_date;
            }
          }
        });
        
        // Enrich bookings with dates
        const bookingsWithDates = (bookings || []).map((booking: any) => {
          const dates = detailsMap.get(booking.id);
          return {
            ...booking,
            start_date: dates?.start_date || null,
            end_date: dates?.end_date || null
          };
        });
        
        console.log('Fetched bookings:', bookingsWithDates);
        return bookingsWithDates;
      } catch (error) {
        console.error('Error in useProductBookings:', error);
        throw error;
      }
    },
    enabled: !!productId,
  });
}
