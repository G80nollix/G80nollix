import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ShopDayOff {
  id: string;
  date_from: string;
  date_to: string;
  enable_booking?: boolean; // Se true, la data può essere usata come data di fine ma non di inizio
}

export function useShopDaysOff() {
  return useQuery({
    queryKey: ['shop_days_off'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_days_off')
        .select('id, date_from, date_to, enable_booking')
        .order('date_from', { ascending: true });
      
      if (error) {
        console.error('Error loading shop days off:', error);
        return [];
      }
      
      return (data || []) as ShopDayOff[];
    },
  });
}

/**
 * Verifica se una data rientra in un periodo di chiusura
 * @deprecated Use isDateDisabledForStart or isDateDisabledForEnd instead
 */
export function isDateInDaysOff(date: Date, daysOff: ShopDayOff[]): boolean {
  if (!daysOff || daysOff.length === 0) return false;
  
  const dateToCheck = new Date(date);
  dateToCheck.setHours(0, 0, 0, 0);
  
  return daysOff.some(dayOff => {
    const dateFrom = new Date(dayOff.date_from);
    dateFrom.setHours(0, 0, 0, 0);
    
    const dateTo = new Date(dayOff.date_to);
    dateTo.setHours(0, 0, 0, 0);
    
    // Verifica se la data è compresa tra date_from e date_to (inclusi)
    return dateToCheck >= dateFrom && dateToCheck <= dateTo;
  });
}

/**
 * Verifica se una data è disabilitata per la selezione come data di INIZIO
 * Le date con enable_booking=true NON possono essere selezionate come data di inizio
 */
export function isDateDisabledForStart(date: Date, daysOff: ShopDayOff[]): boolean {
  if (!daysOff || daysOff.length === 0) return false;
  
  const dateToCheck = new Date(date);
  dateToCheck.setHours(0, 0, 0, 0);
  
  return daysOff.some(dayOff => {
    const dateFrom = new Date(dayOff.date_from);
    dateFrom.setHours(0, 0, 0, 0);
    
    const dateTo = new Date(dayOff.date_to);
    dateTo.setHours(0, 0, 0, 0);
    
    // Verifica se la data è compresa tra date_from e date_to (inclusi)
    const isInPeriod = dateToCheck >= dateFrom && dateToCheck <= dateTo;
    
    if (!isInPeriod) return false;
    
    // Se enable_booking è true, la data è sempre disabilitata per l'inizio
    // Se enable_booking è false o undefined, la data è disabilitata
    return true;
  });
}

/**
 * Verifica se una data è disabilitata per la selezione come data di FINE
 * Le date con enable_booking=true POSSONO essere selezionate come data di fine
 */
export function isDateDisabledForEnd(date: Date, daysOff: ShopDayOff[]): boolean {
  if (!daysOff || daysOff.length === 0) return false;
  
  const dateToCheck = new Date(date);
  dateToCheck.setHours(0, 0, 0, 0);
  
  return daysOff.some(dayOff => {
    const dateFrom = new Date(dayOff.date_from);
    dateFrom.setHours(0, 0, 0, 0);
    
    const dateTo = new Date(dayOff.date_to);
    dateTo.setHours(0, 0, 0, 0);
    
    // Verifica se la data è compresa tra date_from e date_to (inclusi)
    const isInPeriod = dateToCheck >= dateFrom && dateToCheck <= dateTo;
    
    if (!isInPeriod) return false;
    
    // Se enable_booking è true, la data NON è disabilitata per la fine
    // Se enable_booking è false o undefined, la data è disabilitata
    return !dayOff.enable_booking;
  });
}

/**
 * Verifica se una data ha enable_booking=true (giorno di chiusura ma con possibilità di riconsegna)
 */
export function isDateWithEnabledBooking(date: Date, daysOff: ShopDayOff[]): boolean {
  if (!daysOff || daysOff.length === 0) return false;
  
  const dateToCheck = new Date(date);
  dateToCheck.setHours(0, 0, 0, 0);
  
  return daysOff.some(dayOff => {
    if (!dayOff.enable_booking) return false;
    
    const dateFrom = new Date(dayOff.date_from);
    dateFrom.setHours(0, 0, 0, 0);
    
    const dateTo = new Date(dayOff.date_to);
    dateTo.setHours(0, 0, 0, 0);
    
    // Verifica se la data è compresa tra date_from e date_to (inclusi)
    return dateToCheck >= dateFrom && dateToCheck <= dateTo;
  });
}

