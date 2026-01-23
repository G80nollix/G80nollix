import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookingService } from '@/services/api';
import type { Booking, UseBookingsReturn } from '@/types';

export const useBookings = (productId?: string): UseBookingsReturn => {
  const {
    data: bookingsResponse,
    isLoading,
    error
  } = useQuery({
    queryKey: ['bookings', productId],
    queryFn: () => BookingService.getBookings(productId),
    enabled: !!productId,
  });

  return {
    bookings: bookingsResponse?.data || [],
    isLoading,
    error: error as Error | null
  };
};

export const useUserBookings = (userId: string): UseBookingsReturn => {
  const {
    data: bookingsResponse,
    isLoading,
    error
  } = useQuery({
    queryKey: ['userBookings', userId],
    queryFn: () => BookingService.getUserBookings(userId),
    enabled: !!userId,
  });

  return {
    bookings: bookingsResponse?.data || [],
    isLoading,
    error: error as Error | null
  };
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingData: Omit<Booking, 'id' | 'created_at' | 'updated_at'>) => 
      BookingService.createBooking(bookingData),
    onSuccess: () => {
      // Invalidate and refetch bookings queries
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['userBookings'] });
      // Note: product_id no longer exists in bookings, so we don't filter by it
    },
  });
};

export const useUpdateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, bookingData }: { id: string; bookingData: Partial<Omit<Booking, 'id' | 'created_at' | 'updated_at'>> }) =>
      BookingService.updateBooking(id, bookingData),
    onSuccess: () => {
      // Invalidate and refetch bookings queries
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['userBookings'] });
      // Note: product_id no longer exists in bookings, so we don't filter by it
    },
  });
};

export const useCancelBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => BookingService.cancelBooking(id),
    onSuccess: () => {
      // Invalidate and refetch bookings queries
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['userBookings'] });
    },
  });
};
