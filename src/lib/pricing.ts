import { supabase } from '@/integrations/supabase/client';

/**
 * Trova l'id_price_period appropriato basandosi sul numero di giorni di noleggio
 * @param rentalDays - Numero di giorni di noleggio
 * @returns L'id del periodo di prezzo corrispondente, o null se non trovato
 */
export async function findPricePeriodId(rentalDays: number): Promise<string | null> {
  console.log('[findPricePeriodId] Cercando periodo per giorni:', rentalDays);
  
  // Prima proviamo a vedere tutti i campi disponibili nella tabella
  const { data: samplePeriod, error: sampleError } = await supabase
    .from('price_periods')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (sampleError) {
    console.error('[findPricePeriodId] Errore nel caricamento campi:', sampleError);
    return null;
  }
  
  if (samplePeriod) {
    console.log('[findPricePeriodId] Campi disponibili nella tabella price_periods:', Object.keys(samplePeriod));
    console.log('[findPricePeriodId] Esempio periodo:', samplePeriod);
  }
  
  // Carica tutti i periodi dalla tabella price_periods
  // Prova con diversi nomi di campi comuni
  const { data: pricePeriods, error } = await supabase
    .from('price_periods')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('[findPricePeriodId] Errore nel caricamento dei periodi:', error);
    return null;
  }

  if (!pricePeriods || pricePeriods.length === 0) {
    console.warn('[findPricePeriodId] Nessun periodo trovato nella tabella price_periods');
    return null;
  }

  // Cerca i campi che potrebbero rappresentare min/max giorni
  // Prova vari nomi comuni
  const possibleMinFields = ['min_days', 'days_from', 'start_days', 'from_days', 'min', 'days_min'];
  const possibleMaxFields = ['max_days', 'days_to', 'end_days', 'to_days', 'max', 'days_max'];
  const possibleDaysFields = ['days', 'day', 'num_days', 'duration_days'];
  
  let minField: string | null = null;
  let maxField: string | null = null;
  let daysField: string | null = null;
  
  if (samplePeriod) {
    for (const field of possibleMinFields) {
      if (field in samplePeriod) {
        minField = field;
        break;
      }
    }
    for (const field of possibleMaxFields) {
      if (field in samplePeriod) {
        maxField = field;
        break;
      }
    }
    for (const field of possibleDaysFields) {
      if (field in samplePeriod) {
        daysField = field;
        break;
      }
    }
  }
  
  console.log('[findPricePeriodId] Campi trovati:', { minField, maxField, daysField });

  // Se abbiamo trovato i campi min/max, usa la logica di matching per range
  if (minField && maxField) {
    const matchingPeriod = pricePeriods.find((period: any) => {
      const minDays = period[minField] ?? 0;
      const maxDays = period[maxField];
      
      if (maxDays === null || maxDays === undefined) {
        // Periodo illimitato (es. stagionale)
        return rentalDays >= minDays;
      }
      
      return rentalDays >= minDays && rentalDays <= maxDays;
    });

    if (matchingPeriod) {
      console.log('[findPricePeriodId] Periodo trovato (range):', {
        id: matchingPeriod.id,
        minValue: matchingPeriod[minField],
        maxValue: matchingPeriod[maxField],
        rentalDays
      });
      return matchingPeriod.id;
    }
  }
  
  // Se abbiamo trovato un campo days, cerca corrispondenza esatta
  if (daysField) {
    const matchingPeriod = pricePeriods.find((period: any) => {
      return period[daysField] === rentalDays;
    });

    if (matchingPeriod) {
      console.log('[findPricePeriodId] Periodo trovato (esatto):', {
        id: matchingPeriod.id,
        daysValue: matchingPeriod[daysField],
        rentalDays
      });
      return matchingPeriod.id;
    }
  }
  
  // Se non abbiamo trovato i campi, prova a cercare usando tutti i campi numerici disponibili
  // come potenziali indicatori di giorni
  console.warn('[findPricePeriodId] Campi min/max/days non trovati, provando con tutti i campi numerici');
  
  // Cerca tutti i campi numerici nel primo periodo
  if (samplePeriod) {
    const numericFields = Object.keys(samplePeriod).filter(key => {
      const value = samplePeriod[key];
      return typeof value === 'number' && key !== 'id';
    });
    
    console.log('[findPricePeriodId] Campi numerici trovati:', numericFields);
    
    // Prova a trovare un periodo che corrisponde a rentalDays usando i campi numerici
    for (const field of numericFields) {
      // Cerca corrispondenza esatta
      const exactMatch = pricePeriods.find((period: any) => period[field] === rentalDays);
      if (exactMatch) {
        console.log('[findPricePeriodId] Periodo trovato (campo numerico esatto):', {
          id: exactMatch.id,
          field,
          value: exactMatch[field],
          rentalDays
        });
        return exactMatch.id;
      }
      
      // Cerca range (se il campo è min)
      const rangeMatch = pricePeriods.find((period: any) => {
        const fieldValue = period[field];
        if (typeof fieldValue === 'number') {
          // Se il valore è <= rentalDays, potrebbe essere un min
          // Cerchiamo anche un campo max corrispondente
          return fieldValue <= rentalDays;
        }
        return false;
      });
      
      if (rangeMatch) {
        // Verifica se c'è un campo max corrispondente
        const maxField = numericFields.find(f => f !== field && (f.includes('max') || f.includes('to') || f.includes('end')));
        if (maxField) {
          const maxValue = rangeMatch[maxField];
          if (maxValue === null || maxValue === undefined || rentalDays <= maxValue) {
            console.log('[findPricePeriodId] Periodo trovato (range numerico):', {
              id: rangeMatch.id,
              minField: field,
              maxField,
              minValue: rangeMatch[field],
              maxValue,
              rentalDays
            });
            return rangeMatch.id;
          }
        } else {
          // Se non c'è max, potrebbe essere un periodo illimitato
          console.log('[findPricePeriodId] Periodo trovato (min numerico, senza max):', {
            id: rangeMatch.id,
            field,
            value: rangeMatch[field],
            rentalDays
          });
          return rangeMatch.id;
        }
      }
    }
  }

  console.warn('[findPricePeriodId] Periodi disponibili:', pricePeriods.map((p: any) => ({ id: p.id, keys: Object.keys(p), values: p })));
  console.warn('[findPricePeriodId] Nessun periodo corrispondente trovato per giorni:', rentalDays);
  return null;
}

/**
 * Trova l'id_price_period per il prezzo orario (noleggio orario)
 * @returns L'id del periodo di prezzo orario, o null se non trovato
 */
export async function findHourlyPricePeriodId(): Promise<string | null> {
  console.log('[findHourlyPricePeriodId] Cercando periodo orario');
  
  // La struttura della tabella price_periods non è nota
  // Per ora, cerca nella product_variant_price_list un prezzo con id_price_period
  // che corrisponde a un periodo orario (potrebbe essere identificato da un nome o altro campo)
  // TODO: Implementare logica corretta basata sulla struttura reale della tabella
  
  // Prova a cercare tutti i periodi e vedere se c'è un pattern
  const { data: allPeriods, error } = await supabase
    .from('price_periods')
    .select('id')
    .limit(10);

  if (error) {
    console.error('[findHourlyPricePeriodId] Errore nel caricamento dei periodi:', error);
    return null;
  }

  // Per ora, restituiamo null e la logica userà il prezzo stagionale di default
  // TODO: Implementare logica corretta quando si conosce la struttura della tabella
  console.warn('[findHourlyPricePeriodId] Struttura price_periods non supportata, restituendo null');
  return null;
}

/**
 * Trova l'id_price_period per il prezzo stagionale di default
 * @returns L'id del periodo stagionale di default, o null se non trovato
 */
async function findDefaultSeasonalPricePeriodId(): Promise<string | null> {
  console.log('[findDefaultSeasonalPricePeriodId] Cercando periodo stagionale di default');
  
  // La struttura della tabella price_periods non è nota
  // Per ora, restituiamo il primo periodo disponibile come fallback
  // TODO: Implementare logica corretta basata sulla struttura reale della tabella
  
  const { data: allPeriods, error } = await supabase
    .from('price_periods')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[findDefaultSeasonalPricePeriodId] Errore nel caricamento dei periodi:', error);
    return null;
  }

  if (allPeriods) {
    console.log('[findDefaultSeasonalPricePeriodId] Usando primo periodo come default:', allPeriods.id);
    return allPeriods.id;
  }

  console.warn('[findDefaultSeasonalPricePeriodId] Nessun periodo trovato');
  return null;
}

/**
 * Recupera il prezzo per una variante di prodotto dalla tabella product_variant_price_list
 * usando id_price_period invece di days
 * @param variantId - ID della variante del prodotto
 * @param rentalDays - Numero di giorni di noleggio
 * @param rentalHours - Numero di ore di noleggio (opzionale, per noleggi orari)
 * @param isSameDayBooking - Se true, indica che è un noleggio nello stesso giorno
 * @returns Il prezzo totale calcolato
 */
export async function calculateRentalPrice(
  variantId: string,
  rentalDays: number,
  rentalHours: number = 0,
  isSameDayBooking: boolean = false
): Promise<number> {
  console.log('[calculateRentalPrice] Inizio calcolo:', {
    variantId,
    rentalDays,
    rentalHours,
    isSameDayBooking
  });

  // Se è un noleggio orario (stesso giorno con orari specificati), recupera il prezzo orario dalla tabella
  if (rentalHours > 0 && isSameDayBooking) {
    console.log('[calculateRentalPrice] Noleggio orario: cercando prezzo orario usando id_price_period');
    const hourlyPeriodId = await findHourlyPricePeriodId();
    
    if (hourlyPeriodId) {
      const { data: hourlyPriceEntry, error: hourlyPriceError } = await supabase
        .from('product_variant_price_list')
        .select('price, id_price_period, id_product_variant')
        .eq('id_product_variant', variantId)
        .eq('id_price_period', hourlyPeriodId)
        .maybeSingle();

      if (hourlyPriceError) {
        console.error('[calculateRentalPrice] Errore nel recupero del prezzo orario:', hourlyPriceError);
      } else if (hourlyPriceEntry && hourlyPriceEntry.price !== null && hourlyPriceEntry.price !== undefined) {
        const hourlyPrice = Number(hourlyPriceEntry.price);
        const hourlyTotal = hourlyPrice * rentalHours;
        console.log('[calculateRentalPrice] Prezzo orario trovato:', { hourlyPrice, rentalHours, total: hourlyTotal });
        return hourlyTotal;
      } else {
        console.warn('[calculateRentalPrice] Nessun prezzo orario trovato, cercando prezzo stagionale di default');
      }
    } else {
      console.warn('[calculateRentalPrice] Nessun periodo orario trovato, cercando prezzo stagionale di default');
    }
  }

  // Cerca il prezzo nella tabella product_variant_price_list usando id_price_period
  console.log('[calculateRentalPrice] Cercando prezzo per periodo corrispondente a giorni:', { variantId, rentalDays });
  const pricePeriodId = await findPricePeriodId(rentalDays);
  
  if (pricePeriodId) {
    const { data: priceListEntry, error: priceListError } = await supabase
      .from('product_variant_price_list')
      .select('price, id_price_period, id_product_variant')
      .eq('id_product_variant', variantId)
      .eq('id_price_period', pricePeriodId)
      .maybeSingle();

    if (priceListError) {
      console.error('[calculateRentalPrice] Errore nel recupero del prezzo dalla price list:', {
        error: priceListError,
        variantId,
        pricePeriodId,
        rentalDays,
        message: priceListError.message,
        details: priceListError.details,
        hint: priceListError.hint
      });
    } else {
      console.log('[calculateRentalPrice] Risultato query periodo:', {
        found: !!priceListEntry,
        data: priceListEntry
      });
    }

    // Se trova un prezzo per il periodo specificato, lo usa
    if (priceListEntry && priceListEntry.price !== null && priceListEntry.price !== undefined) {
      const price = Number(priceListEntry.price);
      console.log('[calculateRentalPrice] Prezzo trovato per periodo:', price);
      return price;
    }
  }

  // Se non trova corrispondenza, cerca tutti i prezzi disponibili per questa variante
  // e prova a trovare il periodo più appropriato
  console.log('[calculateRentalPrice] Cercando tutti i prezzi disponibili per la variante:', { variantId });
  
  const { data: allPrices, error: allPricesError } = await supabase
    .from('product_variant_price_list')
    .select('id, id_price_period, price, id_product_variant')
    .eq('id_product_variant', variantId);

  if (allPricesError) {
    console.error('[calculateRentalPrice] Errore nel recupero di tutti i prezzi:', allPricesError);
    // Fallback al prezzo stagionale di default
    return await getDefaultPrice(variantId);
  }

  console.log('[calculateRentalPrice] Tutti i prezzi disponibili per questa variante:', {
    found: allPrices?.length || 0,
    prices: allPrices
  });

  if (!allPrices || allPrices.length === 0) {
    console.warn(`[calculateRentalPrice] Nessun prezzo trovato per la variante ${variantId}`);
    return 0;
  }

  // Se abbiamo più prezzi, cerca di trovare il periodo più appropriato
  // Carica tutti i periodi per confrontare
  const { data: allPeriods, error: periodsError } = await supabase
    .from('price_periods')
    .select('*');

  if (!periodsError && allPeriods) {
    // Per ogni prezzo, cerca di capire a quanti giorni corrisponde il periodo
    // e scegli quello più appropriato per rentalDays
    let bestMatch: { price: number; periodId: string; days: number } | null = null;
    
    for (const priceEntry of allPrices) {
      if (!priceEntry.price) continue;
      
      const period = allPeriods.find((p: any) => p.id === priceEntry.id_price_period);
      if (!period) continue;
      
      // Cerca di determinare i giorni del periodo
      const periodDays = getPeriodDays(period, rentalDays);
      
      if (periodDays !== null) {
        // Se il periodo corrisponde esattamente o è il più vicino
        if (periodDays === rentalDays) {
          // Corrispondenza esatta
          console.log('[calculateRentalPrice] Trovato periodo esatto:', {
            periodId: priceEntry.id_price_period,
            days: periodDays,
            price: priceEntry.price
          });
          return Number(priceEntry.price);
        }
        
        // Se il periodo contiene rentalDays (range)
        if (periodDays > 0 && rentalDays >= periodDays) {
          if (!bestMatch || periodDays > bestMatch.days) {
            bestMatch = {
              price: Number(priceEntry.price),
              periodId: priceEntry.id_price_period,
              days: periodDays
            };
          }
        }
      }
    }
    
    if (bestMatch) {
      console.log('[calculateRentalPrice] Trovato periodo migliore:', bestMatch);
      return bestMatch.price;
    }
  }

  // Se non trova un match migliore, prova a usare il prezzo giornaliero moltiplicato per i giorni
  console.log('[calculateRentalPrice] Nessun match trovato, cercando prezzo giornaliero per calcolo: prezzo_giornaliero * giorni');
  const dailyPeriodId = await findPricePeriodId(1); // Periodo per 1 giorno
  
  if (dailyPeriodId) {
    const { data: dailyPriceEntry, error: dailyPriceError } = await supabase
      .from('product_variant_price_list')
      .select('price, id_price_period, id_product_variant')
      .eq('id_product_variant', variantId)
      .eq('id_price_period', dailyPeriodId)
      .maybeSingle();

    if (!dailyPriceError && dailyPriceEntry && dailyPriceEntry.price !== null && dailyPriceEntry.price !== undefined) {
      const dailyPrice = Number(dailyPriceEntry.price);
      const calculatedPrice = dailyPrice * rentalDays;
      console.log('[calculateRentalPrice] Prezzo giornaliero trovato, calcolato:', {
        dailyPrice,
        rentalDays,
        calculatedPrice
      });
      return calculatedPrice;
    }
  }

  // Se non trova il prezzo giornaliero, usa il primo prezzo disponibile come fallback
  // (potrebbe essere il prezzo di default)
  const firstPrice = allPrices[0];
  if (firstPrice && firstPrice.price !== null && firstPrice.price !== undefined) {
    console.log('[calculateRentalPrice] Usando primo prezzo disponibile come fallback:', {
      periodId: firstPrice.id_price_period,
      price: firstPrice.price
    });
    return Number(firstPrice.price);
  }

  // Ultimo fallback: prezzo stagionale di default
  return await getDefaultPrice(variantId);
}

/**
 * Helper function per ottenere il prezzo di default
 */
async function getDefaultPrice(variantId: string): Promise<number> {
  const defaultPeriodId = await findDefaultSeasonalPricePeriodId();
  
  if (defaultPeriodId) {
    const { data: defaultPriceEntry, error: defaultPriceError } = await supabase
      .from('product_variant_price_list')
      .select('price, id_price_period, id_product_variant')
      .eq('id_product_variant', variantId)
      .eq('id_price_period', defaultPeriodId)
      .maybeSingle();

    if (!defaultPriceError && defaultPriceEntry && defaultPriceEntry.price !== null && defaultPriceEntry.price !== undefined) {
      const price = Number(defaultPriceEntry.price);
      console.log('[getDefaultPrice] Prezzo stagionale di default trovato:', price);
      return price;
    }
  }

  return 0;
}

/**
 * Helper function per estrarre i giorni da un periodo
 * Cerca vari campi possibili e ritorna il valore più appropriato
 */
function getPeriodDays(period: any, rentalDays: number): number | null {
  // Cerca campi che potrebbero rappresentare giorni
  const possibleFields = ['days', 'day', 'num_days', 'duration_days', 'min_days', 'days_from', 'start_days'];
  
  for (const field of possibleFields) {
    if (field in period && typeof period[field] === 'number') {
      return period[field];
    }
  }
  
  // Se non trova un campo diretto, prova a usare min_days se disponibile
  const minFields = ['min_days', 'days_from', 'start_days'];
  for (const field of minFields) {
    if (field in period && typeof period[field] === 'number') {
      return period[field];
    }
  }
  
  return null;
}

