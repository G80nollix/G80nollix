
export const SUCCESS_MESSAGES = {
  AUTH: {
    SIGNUP: "Registrazione completata con successo!",
    SIGNIN: "Accesso effettuato con successo!",
    SIGNOUT: "Logout effettuato con successo!",
  }
};

export const ERROR_MESSAGES = {
  GENERIC: "Si è verificato un errore. Riprova più tardi.",
  AUTH: {
    EMAIL_EXISTS: "Questo indirizzo email è già registrato.",
    WEAK_PASSWORD: "La password deve essere di almeno 6 caratteri.",
    INVALID_CREDENTIALS: "Credenziali non valide. Controlla email e password.",
    GOOGLE_ERROR: "Errore durante l'accesso con Google. Riprova.",
  }
};

export const DELIVERY_TYPES = [
  "Tutti",
  "Ritiro in sede",
  "Consegna a domicilio"
];

export const DEFAULT_IMAGES = {
  PRODUCT: "/placeholder.svg",
  productThumbnail: "/placeholder.svg"
};

export const PRODUCT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  DRAFT: "draft"
};

export const OWNER_TYPES = {
  INDIVIDUAL: "individual",
  COMPANY: "company",
  PRIVATE: "individual"
};

export const CONDITIONS = [
  "Nuovo",
  "Come nuovo",
  "Usato - Ottime condizioni",
  "Usato - Buone condizioni",
  "Usato - Condizioni accettabili"
];

// Minimal, curated list of common international calling codes
export const COUNTRY_CALLING_CODES: Array<{ code: string; country: string; iso2: string; maxDigits: number }> = [
  { code: "+39", country: "Italia", iso2: "IT", maxDigits: 10 },
  { code: "+41", country: "Svizzera", iso2: "CH", maxDigits: 9 },
  { code: "+33", country: "Francia", iso2: "FR", maxDigits: 9 },
  { code: "+34", country: "Spagna", iso2: "ES", maxDigits: 9 },
  { code: "+44", country: "Regno Unito", iso2: "GB", maxDigits: 10 },
  { code: "+49", country: "Germania", iso2: "DE", maxDigits: 11 },
  { code: "+43", country: "Austria", iso2: "AT", maxDigits: 10 },
  { code: "+31", country: "Paesi Bassi", iso2: "NL", maxDigits: 9 },
  { code: "+32", country: "Belgio", iso2: "BE", maxDigits: 9 },
  { code: "+351", country: "Portogallo", iso2: "PT", maxDigits: 9 },
  { code: "+30", country: "Grecia", iso2: "GR", maxDigits: 10 },
  { code: "+36", country: "Ungheria", iso2: "HU", maxDigits: 9 },
  { code: "+420", country: "Repubblica Ceca", iso2: "CZ", maxDigits: 9 },
  { code: "+421", country: "Slovacchia", iso2: "SK", maxDigits: 9 },
  { code: "+48", country: "Polonia", iso2: "PL", maxDigits: 9 },
  { code: "+46", country: "Svezia", iso2: "SE", maxDigits: 9 },
  { code: "+47", country: "Norvegia", iso2: "NO", maxDigits: 8 },
  { code: "+45", country: "Danimarca", iso2: "DK", maxDigits: 8 },
  { code: "+353", country: "Irlanda", iso2: "IE", maxDigits: 9 },
  { code: "+40", country: "Romania", iso2: "RO", maxDigits: 9 },
  { code: "+359", country: "Bulgaria", iso2: "BG", maxDigits: 9 },
  { code: "+386", country: "Slovenia", iso2: "SI", maxDigits: 8 },
  { code: "+385", country: "Croazia", iso2: "HR", maxDigits: 9 },
  { code: "+1", country: "USA/Canada", iso2: "US", maxDigits: 10 },
  { code: "+52", country: "Messico", iso2: "MX", maxDigits: 10 },
  { code: "+55", country: "Brasile", iso2: "BR", maxDigits: 11 },
  { code: "+54", country: "Argentina", iso2: "AR", maxDigits: 10 },
  { code: "+61", country: "Australia", iso2: "AU", maxDigits: 9 },
  { code: "+64", country: "Nuova Zelanda", iso2: "NZ", maxDigits: 9 },
  { code: "+81", country: "Giappone", iso2: "JP", maxDigits: 10 },
  { code: "+82", country: "Corea del Sud", iso2: "KR", maxDigits: 10 },
  { code: "+86", country: "Cina", iso2: "CN", maxDigits: 11 },
  { code: "+91", country: "India", iso2: "IN", maxDigits: 10 },
  { code: "+971", country: "EAU", iso2: "AE", maxDigits: 9 },
  { code: "+7", country: "Russia", iso2: "RU", maxDigits: 10 },
  { code: "+90", country: "Turchia", iso2: "TR", maxDigits: 10 },
];
