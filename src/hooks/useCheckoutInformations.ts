import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InformationType {
  id: string;
  name: string; // Es: "text", "select", "textarea", "checkbox", "radio", "date", "number"
}

export interface InformationAttributeValue {
  id: string;
  id_information: string; // Questo è l'ID dell'informazione a cui appartiene
  value: string;
}

export interface Information {
  id: string;
  name: string; // Nome del campo da mostrare
  type: string; // ID del tipo (foreign key a information_type)
  required: boolean;
  order: number | null;
  is_active: boolean;
  width: number | null; // Larghezza in 12esimi (1-12)
  validation: string | null; // Nome della validazione direttamente (es: "email", "phone")
  profile_field_link: string | null; // Nome del campo della tabella profiles da usare per pre-compilare
  information_type?: InformationType;
  information_attributes_values?: InformationAttributeValue[];
  informations_subcategories?: Array<{ id_subcategories: string | number }>; // Sottocategorie per cui questa informazione è visibile
}

/**
 * Filtra le informazioni in base alla sottocategoria del prodotto
 * @param informations - Array di tutte le informazioni disponibili
 * @param subcategoryId - ID della sottocategoria del prodotto (string o null)
 * @returns Array di informazioni filtrate per la sottocategoria
 */
export function filterInformationsBySubcategory(
  informations: Information[],
  subcategoryId: string | null | undefined
): Information[] {
  if (!subcategoryId) {
    // Se non c'è sottocategoria, non mostrare nessuna informazione
    // (tutte le informazioni devono essere associate a una sottocategoria specifica)
    console.log('[filterInformationsBySubcategory] No subcategoryId provided, returning empty array');
    return [];
  }

  console.log('[filterInformationsBySubcategory] Filtering informations for subcategoryId:', subcategoryId);
  console.log('[filterInformationsBySubcategory] Total informations:', informations.length);

  const filtered = informations.filter((info) => {
    const subcategories = info.informations_subcategories || [];
    
    // Se l'informazione non ha entry in informations_subcategories, NON mostrarla
    if (subcategories.length === 0) {
      console.log(`[filterInformationsBySubcategory] ✗ "${info.name}" has NO entries in informations_subcategories - HIDING`);
      return false;
    }
    
    // Mostra l'informazione SOLO se ha una entry in informations_subcategories con id_subcategories = subcategoryId
    const hasSubcategoryMatch = subcategories.some((sc) => {
      const scId = String(sc.id_subcategories);
      const targetId = String(subcategoryId);
      const matches = scId === targetId;
      if (matches) {
        console.log(`[filterInformationsBySubcategory] ✓ "${info.name}" matches subcategory ${targetId}`);
      }
      return matches;
    });
    
    if (!hasSubcategoryMatch) {
      console.log(`[filterInformationsBySubcategory] ✗ "${info.name}" does NOT match (has: [${subcategories.map(sc => String(sc.id_subcategories)).join(', ')}], looking for: ${String(subcategoryId)})`);
    }
    
    return hasSubcategoryMatch;
  });

  console.log('[filterInformationsBySubcategory] Filtered informations:', filtered.length);
  console.log('[filterInformationsBySubcategory] Filtered names:', filtered.map(f => f.name));

  return filtered;
}

export function useCheckoutInformations() {
  return useQuery({
    queryKey: ['checkout-informations'],
    queryFn: async () => {
      try {
        console.log('=== Starting useCheckoutInformations query ===');
        
        // Prima prova una query semplice per verificare se RLS blocca l'accesso
        const { data: testData, error: testError } = await supabase
          .from('informations')
          .select('*')
          .limit(1);
        
        console.log('Test query result:', {
          data: testData,
          error: testError,
          hasData: !!testData && testData.length > 0
        });
        
        if (testError) {
          console.error('Test query error (possible RLS issue):', testError);
          console.error('Error code:', testError.code);
          console.error('Error message:', testError.message);
          console.error('Error hint:', testError.hint);
          
          // Se è un errore di RLS, potrebbe non essere visibile come errore esplicito
          // ma la query restituisce array vuoto
          if (testError.code === 'PGRST301' || testError.message?.includes('permission') || testError.message?.includes('policy')) {
            console.warn('⚠️ Possible RLS (Row Level Security) issue - check database policies for informations table');
          }
        }
        
        // Carica le informazioni base dalla tabella 'informations'
        // Il campo 'validation' contiene direttamente il nome della validazione (es: "email", "phone")
        // Filtra solo quelle attive (is_active = true)
        const { data: informationsBase, error: baseError, count } = await supabase
          .from('informations')
          .select(`
            id, 
            name, 
            type, 
            required, 
            order, 
            is_active, 
            width, 
            validation, 
            profile_field_link
          `, { count: 'exact' })
          .eq('is_active', true)
          .order('order', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true });

        console.log('Main query result:', {
          data: informationsBase,
          error: baseError,
          count: count,
          dataLength: informationsBase?.length,
          isEmpty: !informationsBase || informationsBase.length === 0
        });

        if (baseError) {
          console.error('Error loading informations:', baseError);
          console.error('Error details:', {
            message: baseError.message,
            code: baseError.code,
            details: baseError.details,
            hint: baseError.hint
          });
          
          // Se è un errore di RLS, informa l'utente
          if (baseError.code === 'PGRST301' || baseError.message?.includes('permission') || baseError.message?.includes('policy')) {
            console.warn('⚠️ RLS (Row Level Security) is blocking access to informations table');
            console.warn('⚠️ Please check database policies or run as admin user');
          }
          
          throw baseError;
        }

        const informations = informationsBase || [];
        console.log('Base informations loaded:', informations);
        console.log('Informations count from query:', count);
        console.log('Informations array length:', informations.length);
        
        // Log per debug: verifica i campi required
        console.log('Required fields check:', informations.map((info: any) => ({
          name: info.name,
          required: info.required,
          requiredType: typeof info.required,
          requiredValue: info.required
        })));
        
        // Se count è > 0 ma l'array è vuoto, potrebbe essere RLS
        if (count && count > 0 && informations.length === 0) {
          console.warn('⚠️ WARNING: Count says there are records but array is empty - likely RLS issue!');
          console.warn('⚠️ Count:', count, 'Array length:', informations.length);
        }

        if (informations.length === 0) {
          console.warn('No informations found in database');
          return [] as Information[];
        }

        // Carica i tipi per ogni informazione
        // I tipi sono bigint, quindi manteniamo come numeri per la query
        const informationTypeIds = [...new Set(informations.map((info: any) => info.type).filter(Boolean))];
        
        console.log('Information type IDs to load:', informationTypeIds);
        
        let typesMap = new Map();
        if (informationTypeIds.length > 0) {
          const { data: types, error: typesError } = await supabase
            .from('information_type')
            .select('id, name')
            .in('id', informationTypeIds);

          if (typesError) {
            console.error('Error loading information types:', typesError);
          } else {
            console.log('Information types loaded from DB:', types);
            // Crea la mappa usando sia il numero che la stringa come chiave
            (types || []).forEach((t: any) => {
              typesMap.set(t.id, t);
              typesMap.set(String(t.id), t);
            });
            console.log('Types map created:', Array.from(typesMap.entries()));
          }
        }

        // Carica i valori degli attributi per ogni informazione
        // La tabella si chiama 'information_attributes_values' (plurale) e la colonna è 'information_id'
        // Manteniamo gli ID come numeri per la query (bigint)
        const informationIds = informations.map((info: any) => info.id);
        console.log('Information IDs to load attribute values for:', informationIds);
        
        const { data: attributeValues, error: valuesError } = await supabase
          .from('information_attributes_values')
          .select('id, information_id, value')
          .in('information_id', informationIds);

        if (valuesError) {
          console.error('Error loading attribute values:', valuesError);
        } else {
          console.log('Attribute values loaded:', attributeValues);
        }

        const valuesMap = new Map<string | number, any[]>();
        (attributeValues || []).forEach((av: any) => {
          // Usa sia il numero che la stringa come chiave
          const infoIdNum = av.information_id;
          const infoIdStr = String(av.information_id);
          
          if (!valuesMap.has(infoIdNum)) {
            valuesMap.set(infoIdNum, []);
          }
          if (!valuesMap.has(infoIdStr)) {
            valuesMap.set(infoIdStr, []);
          }
          
          const valueObj = {
            id: String(av.id),
            id_information: String(av.information_id),
            value: av.value
          };
          
          valuesMap.get(infoIdNum)!.push(valueObj);
          valuesMap.get(infoIdStr)!.push(valueObj);
        });

        console.log('Values map created:', Array.from(valuesMap.keys()));

        // Carica le relazioni informations_subcategories separatamente
        // Questo ci permette di fare il matching esplicito tramite id_informations (ID dell'informazione)
        const informationIdsForSubcategories = informations.map((info: any) => info.id);
        console.log('Loading informations_subcategories for information IDs:', informationIdsForSubcategories);
        
        const { data: informationsSubcategories, error: subcategoriesError } = await supabase
          .from('informations_subcategories')
          .select('id_informations, id_subcategories')
          .in('id_informations', informationIdsForSubcategories);

        if (subcategoriesError) {
          console.error('Error loading informations_subcategories:', subcategoriesError);
        } else {
          console.log('Loaded informations_subcategories:', informationsSubcategories);
          console.log('Total informations_subcategories entries:', informationsSubcategories?.length || 0);
        }

        // Crea una mappa: informationId -> array di subcategoryIds
        // Il matching viene fatto tramite id_informations (ID dell'informazione)
        const subcategoriesMap = new Map<string | number, Array<{ id_subcategories: string | number }>>();
        (informationsSubcategories || []).forEach((isc: any) => {
          const infoId = isc.id_informations; // ID dell'informazione dalla tabella informations_subcategories
          const infoIdStr = String(infoId);
          const subcategoryId = isc.id_subcategories; // ID della sottocategoria
          
          console.log(`[useCheckoutInformations] Mapping: information ID ${infoId} -> subcategory ID ${subcategoryId}`);
          
          // Usa sia il numero che la stringa come chiave per il matching
          if (!subcategoriesMap.has(infoId)) {
            subcategoriesMap.set(infoId, []);
          }
          if (!subcategoriesMap.has(infoIdStr)) {
            subcategoriesMap.set(infoIdStr, []);
          }
          
          const subcategoryObj = { id_subcategories: subcategoryId };
          subcategoriesMap.get(infoId)!.push(subcategoryObj);
          subcategoriesMap.get(infoIdStr)!.push(subcategoryObj);
        });

        console.log('Subcategories map created:', Array.from(subcategoriesMap.entries()).map(([k, v]) => [String(k), v.map(s => String(s.id_subcategories))]));

        // Combina i dati e filtra solo quelli attivi (doppio controllo lato client)
        // NON filtriamo per sottocategoria qui - lo faremo lato client quando renderizziamo i form
        const result: Information[] = informations
          .filter((info: any) => info.is_active !== false) // Filtra solo quelli attivi
          .map((info: any) => {
            const infoId = info.id; // ID dell'informazione dalla tabella informations
            const infoIdStr = String(infoId);
            const typeId = info.type;
            // Il campo 'validation' contiene direttamente il nome della validazione (es: "email", "phone")
            const validationName = info.validation ? String(info.validation).toLowerCase().trim() : null;
            
            // Recupera le sottocategorie dalla mappa usando l'ID dell'informazione
            // Il matching viene fatto tramite id_informations (ID dell'informazione)
            const mappedSubcategories = subcategoriesMap.get(infoId) || subcategoriesMap.get(infoIdStr) || [];
            
            console.log(`[useCheckoutInformations] Information "${info.name}" (ID: ${infoId}):`, {
              hasSubcategories: mappedSubcategories.length > 0,
              subcategoryIds: mappedSubcategories.map(s => String(s.id_subcategories))
            });

            // Converti required a booleano in modo esplicito
            // Gestisce sia booleani che stringhe "true"/"false"
            let requiredValue: boolean;
            if (typeof info.required === 'boolean') {
              requiredValue = info.required;
            } else if (typeof info.required === 'string') {
              requiredValue = info.required.toLowerCase() === 'true';
            } else if (info.required === null || info.required === undefined) {
              // Se è null o undefined, usa true come default (comportamento originale)
              requiredValue = true;
            } else {
              // Per qualsiasi altro valore, converti a booleano
              requiredValue = Boolean(info.required);
            }

            const mappedInfo: Information = {
              id: infoIdStr,
              name: info.name,
              type: String(typeId),
              required: requiredValue,
              order: info.order,
              is_active: info.is_active ?? true,
              width: info.width ?? null,
              validation: validationName, // Nome della validazione direttamente (es: "email", "phone")
              profile_field_link: info.profile_field_link ? String(info.profile_field_link) : null, // Nome del campo della tabella profiles
              information_type: typesMap.get(typeId) || typesMap.get(String(typeId)),
              information_attributes_values: valuesMap.get(infoId) || valuesMap.get(infoIdStr) || [],
              informations_subcategories: mappedSubcategories,
            };
            
            console.log(`[useCheckoutInformations] Mapped info for "${info.name}":`, {
              id: mappedInfo.id,
              type: mappedInfo.type,
              hasType: !!mappedInfo.information_type,
              typeName: mappedInfo.information_type?.name,
              attributeValuesCount: mappedInfo.information_attributes_values.length,
              validation: mappedInfo.validation,
              is_active: mappedInfo.is_active,
              required: mappedInfo.required,
              requiredRaw: info.required,
              requiredType: typeof info.required
            });
            
            return mappedInfo;
          });

        console.log('Final result count:', result.length);
        console.log('Final informations with relations:', result);

        console.log('Final informations with relations:', result);
        return result;
      } catch (error) {
        console.error('Error in useCheckoutInformations:', error);
        // Ritorna array vuoto invece di lanciare errore per non bloccare la pagina
        return [] as Information[];
      }
    },
  });
}

