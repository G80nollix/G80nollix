
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, isBefore, isAfter } from "date-fns";
import { it } from "date-fns/locale";
import { useProductCategories } from '@/hooks/useProductCategories';
import { useProductSubcategories } from '@/hooks/useProductSubcategories';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShopDaysOff, isDateDisabledForStart, isDateDisabledForEnd, isDateWithEnabledBooking } from '@/hooks/useShopDaysOff';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useEffect } from 'react';

interface CatalogTopFiltersProps {
  pendingFilters: {
    equipmentName: string;
    selectedCategory: string;
    selectedSubcategory: string;
    selectedAttributeValue: string;
    startDate?: Date;
    endDate?: Date;
    priceRange: number[];
    condition: string;
    deliveryType: string;
  };
  setPendingValue: (key: string, value: any) => void;
  setCategoryAndResetSubcategory: (categoryValue: string) => void;
  handleResetFilters: () => void;
}

const CatalogTopFilters = ({ 
  pendingFilters, 
  setPendingValue, 
  setCategoryAndResetSubcategory,
  handleResetFilters
}: CatalogTopFiltersProps) => {
  const { data: categories, isLoading: loadingCategories } = useProductCategories();
  
  // Carica i valori dell'attributo "Genere" - stesso principio del filtro categorie
  const { data: attributeValues, isLoading: loadingAttributeValues } = useQuery({
    queryKey: ['genere-attribute-values'],
    queryFn: async () => {
      // Prima trova l'attributo "Genere" (case-insensitive)
      const { data: genereAttribute, error: attributeError } = await supabase
        .from('product_attributes')
        .select('id, name')
        .ilike('name', 'Genere')
        .maybeSingle();
      
      if (attributeError) {
        console.error('Errore nel recupero attributo Genere:', attributeError);
        throw attributeError;
      }
      
      if (!genereAttribute) {
        console.warn('Attributo "Genere" non trovato nella tabella product_attributes');
        return [];
      }
      
      // Poi recupera tutti i valori di quell'attributo
      const { data, error } = await supabase
        .from('product_attributes_values')
        .select('id, value')
        .eq('id_product_attribute', genereAttribute.id)
        .order('value');
      
      if (error) {
        console.error('Errore nel recupero valori attributo Genere:', error);
        throw error;
      }
      
      console.log('Valori Genere trovati:', data);
      return data || [];
    },
  });
  
  // Stato per l'alert dialog di chiusura negozio
  const [showClosedShopAlert, setShowClosedShopAlert] = useState(false);
  const [closedShopAlertData, setClosedShopAlertData] = useState<{ date: Date; nextDay: Date } | null>(null);
  
  // Carica le impostazioni del negozio per l'anticipo prenotazione
  const { data: shopSettings } = useQuery({
    queryKey: ['shop_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('anticipo_prenotazioneGiorni')
        .maybeSingle();
      
      if (error) {
        console.error('Error loading shop settings:', error);
        return { anticipo_prenotazioneGiorni: 0 };
      }
      
      return data || { anticipo_prenotazioneGiorni: 0 };
    },
  });
  
  // Carica i giorni di chiusura del negozio
  const { data: shopDaysOff = [] } = useShopDaysOff();


  // Date validation functions
  const isStartDateDisabled = (date: Date) => {
    // Calcola la data minima consentita (oggi + giorni di anticipo)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const anticipoGiorni = shopSettings?.anticipo_prenotazioneGiorni || 0;
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + anticipoGiorni);
    minDate.setHours(0, 0, 0, 0);
    
    // Disable dates before minimum date (today + anticipo giorni)
    if (isBefore(date, minDate)) return true;
    
    // Disable dates that fall within shop days off periods (per data di inizio)
    if (isDateDisabledForStart(date, shopDaysOff)) return true;
    
    // If end date is selected, disable dates after end date
    if (pendingFilters.endDate) {
      return isAfter(date, pendingFilters.endDate);
    }
    
    return false;
  };

  const isEndDateDisabled = (date: Date) => {
    // Calcola la data minima consentita (oggi + giorni di anticipo)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const anticipoGiorni = shopSettings?.anticipo_prenotazioneGiorni || 0;
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + anticipoGiorni);
    minDate.setHours(0, 0, 0, 0);
    
    // Disable dates before minimum date (today + anticipo giorni)
    if (isBefore(date, minDate)) return true;
    
    // Disable dates that fall within shop days off periods (per data di fine)
    // Le date con enable_booking=true POSSONO essere selezionate come data di fine
    if (isDateDisabledForEnd(date, shopDaysOff)) return true;
    
    // If no start date is selected, disable all dates
    if (!pendingFilters.startDate) return true;
    
    // If start date is selected, disable dates before start date
    return isBefore(date, pendingFilters.startDate);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setPendingValue("startDate", date);
    // If the new start date is after the current end date, clear the end date
    if (date && pendingFilters.endDate && isAfter(date, pendingFilters.endDate)) {
      setPendingValue("endDate", undefined);
    }
    // If start date is cleared, also clear the end date
    if (!date && pendingFilters.endDate) {
      setPendingValue("endDate", undefined);
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setPendingValue("endDate", date);
    
    // Verifica se la data selezionata ha enable_booking=true
    if (date && isDateWithEnabledBooking(date, shopDaysOff)) {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Mostra l'alert dialog
      setClosedShopAlertData({ date, nextDay });
      setShowClosedShopAlert(true);
    }
    
    // If the new end date is before the current start date, clear the start date
    if (date && pendingFilters.startDate && isBefore(date, pendingFilters.startDate)) {
      setPendingValue("startDate", undefined);
    }
  };

  

  return (
    <>
      {/* Alert Dialog per negozio chiuso */}
      <AlertDialog open={showClosedShopAlert} onOpenChange={setShowClosedShopAlert}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <span className="text-2xl">⚠️</span>
              Attenzione: Negozio Chiuso
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {closedShopAlertData && (
                <>
                  Ti informiamo che il <strong>{format(closedShopAlertData.date, "dd/MM/yyyy", { locale: it })}</strong> il negozio sarà chiuso, 
                  pertanto la riconsegna del prodotto avverrà il giorno successivo (<strong>{format(closedShopAlertData.nextDay, "dd/MM/yyyy", { locale: it })}</strong>). 
                  Il prezzo verrà comunque calcolato sui giorni di prenotazione selezionati.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowClosedShopAlert(false)}>
              Ho capito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Genere */}
        <div className="w-full lg:w-48">
          <Select 
            value={pendingFilters.selectedAttributeValue || "all"} 
            onValueChange={(value) => {
              setPendingValue("selectedAttributeValue", value === "all" ? "" : value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona Genere" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i generi</SelectItem>
              {loadingAttributeValues ? (
                <SelectItem value="loading" disabled>Caricamento...</SelectItem>
              ) : attributeValues && attributeValues.length > 0 ? (
                attributeValues.map((attrVal: any) => (
                  <SelectItem key={attrVal.id} value={attrVal.id}>
                    {attrVal.value}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-data" disabled>Nessun genere disponibile</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Categoria */}
        <div className="w-full lg:w-48">
          <Select 
            value={pendingFilters.selectedCategory || "all"} 
            onValueChange={(value) => {
              setPendingValue("selectedCategory", value === "all" ? "" : value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              {loadingCategories ? (
                <SelectItem value="loading" disabled>Caricamento...</SelectItem>
              ) : (
                categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Data inizio */}
        <div className="w-full lg:w-40">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {pendingFilters.startDate 
                  ? format(pendingFilters.startDate, "dd/MM/yyyy", { locale: it })
                  : "Data inizio"
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={pendingFilters.startDate}
                onSelect={handleStartDateChange}
                disabled={isStartDateDisabled}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Data fine */}
        <div className="w-full lg:w-40">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {pendingFilters.endDate 
                  ? format(pendingFilters.endDate, "dd/MM/yyyy", { locale: it })
                  : "Data fine"
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={pendingFilters.endDate}
                onSelect={handleEndDateChange}
                disabled={isEndDateDisabled}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Pulsante reset */}
        <div className="flex gap-2 items-center">
          <Button 
            variant="outline" 
            onClick={handleResetFilters} 
            className="lg:w-auto"
          >
            Reset Filtri
          </Button>
        </div>
      </div>
    </div>
    </>
  );
};

export default CatalogTopFilters;
