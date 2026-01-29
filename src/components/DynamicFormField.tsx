import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { Information, InformationAttributeValue } from '@/hooks/useCheckoutInformations';

interface DynamicFormFieldProps {
  information: Information;
  value: any;
  onChange: (value: any) => void;
  onValidationChange?: (isValid: boolean, errorMessage?: string) => void;
  error?: string;
  minDate?: string; // Data minima per campi di tipo date (formato YYYY-MM-DD)
  maxDate?: string; // Data massima per campi di tipo date (formato YYYY-MM-DD)
}

// Funzioni di validazione
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone: string): boolean => {
  // Rimuove spazi, trattini, parentesi e il prefisso +
  const cleaned = phone.replace(/[\s\-()\+]/g, '');
  // Verifica che contenga solo numeri e abbia una lunghezza ragionevole (almeno 7 cifre, max 15)
  return /^\d{7,15}$/.test(cleaned);
};

export const DynamicFormField: React.FC<DynamicFormFieldProps> = ({
  information,
  value,
  onChange,
  onValidationChange,
  error,
  minDate,
  maxDate,
}) => {
  const fieldType = information.information_type?.name || 'text';
  const attributeValues = information.information_attributes_values || [];
  // Converti required a booleano in modo esplicito
  // Se è null/undefined, usa true come default (comportamento originale)
  // Altrimenti usa il valore effettivo (true o false)
  const isRequired = information.required !== null && information.required !== undefined 
    ? Boolean(information.required) 
    : true;
  // Il campo 'validation' contiene direttamente il nome della validazione (es: "email", "phone")
  const validationName = information.validation ? String(information.validation).toLowerCase().trim() : null;
  
  // Usa un ref per memorizzare l'ultimo risultato della validazione per evitare loop infiniti
  const lastValidationResultRef = React.useRef<{ isValid: boolean; errorMessage: string } | null>(null);
  const onValidationChangeRef = React.useRef(onValidationChange);
  
  // Aggiorna il ref quando cambia la funzione
  React.useEffect(() => {
    onValidationChangeRef.current = onValidationChange;
  }, [onValidationChange]);
  
  // Validazione del valore
  React.useEffect(() => {
    if (!onValidationChangeRef.current) {
      return;
    }
    
    const valueStr = value ? String(value).trim() : '';
    
    // Validazione per campi di tipo date con minDate/maxDate
    if (fieldType === 'date' && (minDate || maxDate)) {
      if (!valueStr) {
        // Se il campo è vuoto, non validare il range (la validazione required viene gestita altrove)
        if (!isRequired) {
          const result = { isValid: true, errorMessage: '' };
          if (!lastValidationResultRef.current || 
              lastValidationResultRef.current.isValid !== result.isValid ||
              lastValidationResultRef.current.errorMessage !== result.errorMessage) {
            lastValidationResultRef.current = result;
            onValidationChangeRef.current(true, '');
          }
        }
        return;
      }
      
      // Valida che la data sia nel range
      // Usa solo la parte data (YYYY-MM-DD) per il confronto, ignorando l'ora
      const selectedDate = new Date(valueStr + 'T00:00:00');
      const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : null;
      const maxDateObj = maxDate ? new Date(maxDate + 'T00:00:00') : null;
      
      let isValid = true;
      let errorMessage = '';
      
      if (minDateObj && selectedDate < minDateObj) {
        isValid = false;
        const minDateFormatted = minDateObj.toLocaleDateString('it-IT');
        errorMessage = `La data deve essere successiva al ${minDateFormatted}`;
      } else if (maxDateObj && selectedDate > maxDateObj) {
        isValid = false;
        const maxDateFormatted = maxDateObj.toLocaleDateString('it-IT');
        errorMessage = `La data deve essere antecedente al ${maxDateFormatted}`;
      }
      
      const result = { isValid, errorMessage };
      if (!lastValidationResultRef.current || 
          lastValidationResultRef.current.isValid !== result.isValid ||
          lastValidationResultRef.current.errorMessage !== result.errorMessage) {
        lastValidationResultRef.current = result;
        onValidationChangeRef.current(isValid, errorMessage);
      }
      return;
    }
    
    // Se c'è una validazione specificata
    if (validationName) {
      // Se il campo è vuoto, non validare il formato (la validazione required viene gestita altrove)
      if (!valueStr) {
        // Se non è required, il formato è valido (non c'è nulla da validare)
        if (!isRequired) {
          const result = { isValid: true, errorMessage: '' };
          // Chiama solo se il risultato è cambiato
          if (!lastValidationResultRef.current || 
              lastValidationResultRef.current.isValid !== result.isValid ||
              lastValidationResultRef.current.errorMessage !== result.errorMessage) {
            lastValidationResultRef.current = result;
            onValidationChangeRef.current(true, '');
          }
        }
        return;
      }
      
      // Se c'è un valore, valida il formato
      let isValid = true;
      let errorMessage = '';
      
      if (validationName === 'email') {
        isValid = validateEmail(valueStr);
        if (!isValid) {
          errorMessage = 'Inserisci un indirizzo email valido';
        }
      } else if (validationName === 'phone') {
        isValid = validatePhone(valueStr);
        if (!isValid) {
          errorMessage = 'Inserisci un numero di telefono valido';
        }
      }
      
      const result = { isValid, errorMessage };
      // Chiama solo se il risultato è cambiato
      if (!lastValidationResultRef.current || 
          lastValidationResultRef.current.isValid !== result.isValid ||
          lastValidationResultRef.current.errorMessage !== result.errorMessage) {
        lastValidationResultRef.current = result;
        onValidationChangeRef.current(isValid, errorMessage);
      }
    } else {
      // Se non c'è validazione, il campo è valido (la validazione required viene gestita altrove)
      const result = { isValid: true, errorMessage: '' };
      // Chiama solo se il risultato è cambiato
      if (!lastValidationResultRef.current || 
          lastValidationResultRef.current.isValid !== result.isValid ||
          lastValidationResultRef.current.errorMessage !== result.errorMessage) {
        lastValidationResultRef.current = result;
        onValidationChangeRef.current(true, '');
      }
    }
  }, [value, validationName, isRequired, information.name, fieldType, minDate, maxDate]);

  // Verifica se il campo è Peso, Piede o Altezza (case-insensitive)
  const isNumericField = () => {
    const fieldName = information.name?.toLowerCase() || '';
    return fieldName === 'peso' || fieldName === 'piede' || fieldName === 'altezza';
  };

  // Funzione per validare e filtrare input numerico (solo numeri, virgola o punto)
  const handleNumericInput = (inputValue: string): string => {
    // Permetti solo numeri, virgola e punto
    // Rimuovi tutti i caratteri non validi
    let cleaned = inputValue.replace(/[^0-9,.]/g, '');
    
    // Assicurati che ci sia al massimo un separatore decimale (virgola o punto)
    // Se ci sono più separatori, mantieni solo il primo
    const commaIndex = cleaned.indexOf(',');
    const dotIndex = cleaned.indexOf('.');
    
    if (commaIndex !== -1 && dotIndex !== -1) {
      // Se ci sono entrambi, mantieni quello che appare per primo
      if (commaIndex < dotIndex) {
        cleaned = cleaned.replace(/\./g, '');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (commaIndex !== -1) {
      // Se c'è solo la virgola, rimuovi eventuali punti aggiuntivi (non dovrebbero esserci, ma per sicurezza)
      const parts = cleaned.split(',');
      if (parts.length > 2) {
        cleaned = parts[0] + ',' + parts.slice(1).join('');
      }
    } else if (dotIndex !== -1) {
      // Se c'è solo il punto, rimuovi eventuali virgole aggiuntive (non dovrebbero esserci, ma per sicurezza)
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
      }
    }
    
    return cleaned;
  };

  const renderField = () => {
    switch (fieldType) {
      case 'text':
        // Determina il tipo di input basandosi sulla validazione
        // Il campo 'validation' contiene direttamente il nome della validazione (es: "email", "phone")
        let inputType = 'text';
        if (validationName === 'email') {
          inputType = 'email';
        } else if (validationName === 'phone') {
          inputType = 'tel';
        }
        
        // Se è un campo numerico (Peso, Piede, Altezza), applica la validazione
        if (isNumericField()) {
          return (
            <Input
              type="text"
              inputMode="decimal"
              value={value || ''}
              onChange={(e) => {
                const filteredValue = handleNumericInput(e.target.value);
                onChange(filteredValue);
              }}
              onKeyDown={(e) => {
                // Permetti solo numeri, virgola, punto, backspace, delete, tab, escape, enter
                // e le frecce di navigazione
                const allowedKeys = [
                  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                  'Home', 'End'
                ];
                const isNumber = /^[0-9]$/.test(e.key);
                const isCommaOrDot = e.key === ',' || e.key === '.';
                const isAllowedKey = allowedKeys.includes(e.key);
                
                if (!isNumber && !isCommaOrDot && !isAllowedKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                }
                
                // Previeni più di un separatore decimale
                if (isCommaOrDot) {
                  const currentValue = String(value || '');
                  if (currentValue.includes(',') || currentValue.includes('.')) {
                    e.preventDefault();
                  }
                }
              }}
              className={error ? 'border-red-500' : ''}
              required={isRequired}
            />
          );
        }
        
        return (
          <Input
            type={inputType}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-red-500' : ''}
            required={isRequired}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-red-500' : ''}
            rows={4}
            required={isRequired}
          />
        );

      case 'number':
        // Se è un campo numerico (Peso, Piede, Altezza), usa input text con validazione
        if (isNumericField()) {
          return (
            <Input
              type="text"
              inputMode="decimal"
              value={value || ''}
              onChange={(e) => {
                const filteredValue = handleNumericInput(e.target.value);
                onChange(filteredValue);
              }}
              onKeyDown={(e) => {
                // Permetti solo numeri, virgola, punto, backspace, delete, tab, escape, enter
                // e le frecce di navigazione
                const allowedKeys = [
                  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                  'Home', 'End'
                ];
                const isNumber = /^[0-9]$/.test(e.key);
                const isCommaOrDot = e.key === ',' || e.key === '.';
                const isAllowedKey = allowedKeys.includes(e.key);
                
                if (!isNumber && !isCommaOrDot && !isAllowedKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                }
                
                // Previeni più di un separatore decimale
                if (isCommaOrDot) {
                  const currentValue = String(value || '');
                  if (currentValue.includes(',') || currentValue.includes('.')) {
                    e.preventDefault();
                  }
                }
              }}
              className={error ? 'border-red-500' : ''}
              required={isRequired}
            />
          );
        }
        
        return (
          <Input
            type="number"
            min="0"
            step="any"
            value={value || ''}
            onChange={(e) => {
              const inputValue = e.target.value;
              // Permetti stringa vuota o valori numerici non negativi
              if (inputValue === '') {
                onChange('');
              } else {
                const numValue = Number(inputValue);
                // Impedisci valori negativi
                if (!isNaN(numValue) && numValue >= 0) {
                  onChange(numValue);
                }
              }
            }}
            onKeyDown={(e) => {
              // Impedisci l'inserimento del segno meno
              if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                e.preventDefault();
              }
            }}
            className={error ? 'border-red-500' : ''}
            required={isRequired}
          />
        );

      case 'date':
        const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const inputValue = e.target.value;
          
          // Permetti sempre l'aggiornamento del valore durante la digitazione
          // La validazione verrà fatta nel useEffect e mostrerà solo l'errore
          // senza cancellare il valore
          onChange(inputValue);
        };
        
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={handleDateChange}
            onBlur={(e) => {
              // Validazione al blur solo se la data è completa e fuori range
              const inputValue = e.target.value;
              
              // Verifica che la data sia in formato completo YYYY-MM-DD
              const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(inputValue);
              
              if (inputValue && isCompleteDate && (minDate || maxDate)) {
                // Usa solo la parte data (YYYY-MM-DD) per il confronto, ignorando l'ora
                const selectedDate = new Date(inputValue + 'T00:00:00');
                const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : null;
                const maxDateObj = maxDate ? new Date(maxDate + 'T00:00:00') : null;
                
                // Verifica che la data sia valida (non Invalid Date)
                if (isNaN(selectedDate.getTime())) {
                  return;
                }
                
                const isBeforeMin = minDateObj && selectedDate < minDateObj;
                const isAfterMax = maxDateObj && selectedDate > maxDateObj;
                
                if (isBeforeMin || isAfterMax) {
                  // Reset al valore precedente solo al blur se la data è completa ma fuori range
                  e.target.value = value || '';
                  // Aggiorna lo stato per triggerare la validazione
                  onChange(value || '');
                }
              }
            }}
            className={error ? 'border-red-500' : ''}
            required={isRequired}
            min={minDate}
            max={maxDate}
          />
        );

      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={onChange}
            required={isRequired}
          >
            <SelectTrigger className={error ? 'border-red-500' : ''}>
              <SelectValue placeholder="Seleziona un'opzione" />
            </SelectTrigger>
            <SelectContent>
              {attributeValues.map((attr: InformationAttributeValue) => (
                <SelectItem key={attr.id} value={attr.value}>
                  {attr.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            value={value || ''}
            onValueChange={onChange}
          >
            <div className="flex flex-col gap-2">
              {attributeValues.map((attr: InformationAttributeValue) => (
                <div key={attr.id} className="flex items-center space-x-2 bg-gray-50 rounded-md p-2 border border-gray-200 hover:bg-gray-100 transition-colors">
                  <RadioGroupItem value={attr.value} id={`${information.id}-${attr.id}`} />
                  <Label
                    htmlFor={`${information.id}-${attr.id}`}
                    className="text-sm font-normal cursor-pointer text-gray-700 flex-1"
                  >
                    {attr.value}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        );

      case 'checkbox':
        // Checkbox singolo (boolean)
        const isChecked = value === true;
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={information.id}
              checked={isChecked}
              onCheckedChange={(checked) => {
                onChange(checked);
              }}
              className="h-4 w-4"
            />
            <Label htmlFor={information.id} className="text-sm font-normal cursor-pointer text-gray-700">
              {information.name}
            </Label>
          </div>
        );

      case 'multiselect':
      case 'checkbox-group':
        // Checkbox multipli - mostra tutti i valori degli attributi come checkbox separati
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {attributeValues.map((attr: InformationAttributeValue) => {
              const isSelected = selectedValues.includes(attr.value);
              return (
                <div key={attr.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${information.id}-${attr.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const newValue = checked
                        ? [...selectedValues, attr.value]
                        : selectedValues.filter((v: any) => v !== attr.value);
                      onChange(newValue);
                    }}
                    className="h-4 w-4"
                  />
                  <Label
                    htmlFor={`${information.id}-${attr.id}`}
                    className="text-sm font-normal cursor-pointer text-gray-700"
                  >
                    {attr.value}
                  </Label>
                </div>
              );
            })}
          </div>
        );

      default:
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-red-500' : ''}
            required={isRequired}
          />
        );
    }
  };

  // Per checkbox singolo, il label è già incluso nel campo
  if (fieldType === 'checkbox') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center space-x-2 bg-gray-50 rounded-md p-2 border border-gray-200">
          {renderField()}
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }


  // Per multiselect/checkbox-group, mostra il label sopra
  if (fieldType === 'multiselect' || fieldType === 'checkbox-group') {
    return (
      <div className="space-y-2">
        <Label htmlFor={information.id} className="text-sm font-semibold text-gray-700">
          {information.name}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          {renderField()}
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={information.id} className="text-sm font-semibold text-gray-700">
        {information.name}
        {isRequired && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {renderField()}
      {/* Nota informativa per limiti di data di nascita */}
      {fieldType === 'date' && (minDate || maxDate) && information.name?.toLowerCase().includes('nascita') && (
        <p className="text-xs text-blue-600 mt-1 italic">
          {minDate && maxDate 
            ? 'Il bambino deve avere tra 2 e 13 anni compiuti'
            : maxDate 
            ? 'L\'utilizzatore deve avere almeno 14 anni compiuti'
            : null}
        </p>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

