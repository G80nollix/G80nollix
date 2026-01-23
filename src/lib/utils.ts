import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convert ISO 3166-1 alpha-2 country code to flag emoji
// Example: "IT" -> "🇮🇹"
export function countryCodeToFlagEmoji(isoCode: string): string {
  if (!isoCode || isoCode.length !== 2) return "";
  const codePoints = isoCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Converte una data in formato ISO-8601 (YYYY-MM-DDTHH:mm:ss.sss) usando i valori locali
 * senza alcun offset di timezone. La data viene semplicemente formattata senza modifiche.
 * 
 * @param date - L'oggetto Date da convertire
 * @returns Stringa ISO nel formato YYYY-MM-DDTHH:mm:ss.sss (es: "2024-01-15T00:00:00.000")
 */
export function toItalianISOString(date: Date): string {
  // Log della data originale
  console.log('[toItalianISOString] Data originale:', {
    date: date,
    toString: date.toString(),
    toISOString: date.toISOString(),
    toLocaleString: date.toLocaleString('it-IT', { timeZone: 'Europe/Rome' }),
    getFullYear: date.getFullYear(),
    getMonth: date.getMonth() + 1,
    getDate: date.getDate(),
    getHours: date.getHours(),
    getMinutes: date.getMinutes(),
    getSeconds: date.getSeconds(),
    getMilliseconds: date.getMilliseconds(),
  });

  // Usa i valori locali della data direttamente, senza conversioni o offset
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  
  const result = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
  
  // Log del risultato
  console.log('[toItalianISOString] Data convertita:', {
    result,
    originalToISOString: date.toISOString(),
    difference: `Originale: ${date.toISOString()} vs Convertita: ${result}`,
  });
  
  return result;
}
