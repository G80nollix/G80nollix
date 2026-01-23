// User and Authentication Types
export interface User {
  id: string;
  email: string;
  user_metadata: UserMetadata;
}

export interface UserMetadata {
  user_type: 'individual' | 'admin';
  first_name?: string;
  last_name?: string;
  phone?: string;
  birth_date?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  province?: string;
  tax_code?: string;
  company_name?: string;
  vat_number?: string;
  company_address?: string;
  company_city?: string;
  company_postal_code?: string;
  company_province?: string;
  legal_representative?: string;
  business_sector?: string;
  company_description?: string;
  website?: string;
  registration_number?: string;
}

// Product Types
export interface Product {
  id: string;
  name: string; // Cambiato da title
  description: string | null;
  id_product_subcategory: string | null;
  id_brand: string | null;
  id_model: string | null;
  company_id: string | null;
  is_active: boolean;
  can_be_delivered: boolean;
  can_be_picked_up: boolean;
  has_variants: boolean;
  images: string[]; // Array di URL delle immagini del prodotto
  price_hour: number | null;
  price_daily: number | null;
  price_weekly: number | null;
  price_monthly: number | null;
  price_season: number | null;
  deposit: number | null;
  min_rent_days: number | null;
  min_rent_hours: number | null;
  created_at: string | null;
  updated_at: string | null;
  // Relazioni joinate
  product_brand?: {
    id: string;
    name: string;
  };
  product_model?: {
    id: string;
    name: string;
  };
  // Variante principale (per compatibilità con UI esistente)
  variant?: ProductVariant;
  // Campi legacy per compatibilità UI (mappati da variant)
  title?: string; // Alias per name
  brand?: string; // Da product_brand.name
  model?: string; // Da product_model.name
  price_month?: number; // Da variant.price_monthly
  status?: 'active' | 'paused' | 'draft'; // Mappato da is_active
  delivery?: boolean; // Alias per can_be_delivered
  pickup_on_site?: boolean; // Alias per can_be_picked_up
}

// Product Variant Types
export interface ProductVariant {
  id: string;
  id_product: string;
  is_active: boolean;
  price_hour: number | null;
  price_daily: number | null;
  price_weekly: number | null;
  price_monthly: number | null;
  price_season: number | null;
  deposit: number | null;
  images: string[];
  created_at: string | null;
  updated_at: string | null;
}

// Booking Types
export interface Booking {
  id: string; // UUID
  user_id: string; // UUID
  product_id?: string; // UUID - Opzionale: campo calcolato/virtuale, non esiste più nella tabella bookings
  start_date?: string | null; // TIMESTAMP WITH TIME ZONE - Calcolato da booking_details
  end_date?: string | null; // TIMESTAMP WITH TIME ZONE - Calcolato da booking_details
  price_total: number; // NUMERIC
  delivery_method: 'pickup' | 'delivery'; // TEXT with CHECK constraint
  delivery_address: string | null; // TEXT
  status: 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment' | 'pendingRefund' | 'succeededRefund' | 'paymentError'; // TEXT with DEFAULT 'cart'
  created_at: string; // TIMESTAMP WITH TIME ZONE
  updated_at: string; // TIMESTAMP WITH TIME ZONE
  rifPrenotazione: number; // IDENTITY - codice di conferma automatico
  price_daily?: number | null; // NUMERIC - Non più in bookings, solo in booking_details
  price_weekly?: number | null; // NUMERIC - Non più in bookings, solo in booking_details
  price_hour?: number | null; // NUMERIC - Non più in bookings, solo in booking_details
  price_month?: number | null; // NUMERIC - Non più in bookings, solo in booking_details
  deposito?: number | null; // NUMERIC
  cart?: boolean | null; // BOOLEAN - indica se la prenotazione è nel carrello
}

// Booking Creation Types
export interface CreateBookingData {
  user_id: string;
  product_id?: string; // Opzionale: non viene inserito in bookings, va in booking_details come unit_id
  start_date?: string; // ISO string - Non viene inserito in bookings, va in booking_details
  end_date?: string; // ISO string - Non viene inserito in bookings, va in booking_details
  price_total: number;
  delivery_method: 'pickup' | 'delivery';
  delivery_address: string | null;
  status: 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment';
  price_daily?: number | null; // NUMERIC - Non viene inserito in bookings, va in booking_details
  price_weekly?: number | null; // NUMERIC - Non viene inserito in bookings, va in booking_details
  price_hour?: number | null; // NUMERIC - Non viene inserito in bookings, va in booking_details
  price_month?: number | null; // NUMERIC - Non viene inserito in bookings, va in booking_details
  deposito?: number | null; // NUMERIC
  cart?: boolean | null; // BOOLEAN - indica se la prenotazione è nel carrello
  // rifPrenotazione is not included as it's an IDENTITY field generated automatically by the database
}

// Filter Types
export interface ProductFilters {
  equipmentName: string;
  selectedCategory: string;
  selectedSubcategory: string;
  selectedAttributeValue: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  priceRange: [number, number];
  condition: string;
  deliveryType: string;
  brand?: string;
  model?: string;
}

// Search Types
export interface SearchParams {
  equipmentName?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

// UI Types
export interface Category {
  name: string;
  color: string;
  icon: React.ReactNode;
  count: number;
}

export interface Testimonial {
  name: string;
  rating: number;
  text: string;
  badge: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  limit: number;
}

// Form Types
export interface ProductFormData {
  // Campi principali (nuova struttura)
  name?: string; // Cambiato da title
  id_product_subcategory?: string;
  id_brand?: string | null;
  id_model?: string | null;
  is_active?: boolean;
  can_be_delivered?: boolean;
  can_be_picked_up?: boolean;
  has_variants?: boolean;
  price_hour?: number | null;
  price_daily?: number | null;
  price_weekly?: number | null;
  price_monthly?: number | null;
  price_season?: number | null;
  company_id?: string | null;
  // Variante (nuova struttura)
  variant?: {
    price?: number | null;
    price_hour?: number | null;
    price_daily?: number | null;
    price_weekly?: number | null;
    price_monthly?: number | null;
    deposit?: number | null;
    images?: string[];
    is_active?: boolean;
  };
  // Attributi informativi (is_variable = false)
  informativeAttributes?: { [attributeId: string]: string }; // attributeId -> attributeValueId
  // Prezzi per periodo (salvati in product_price_list)
  pricePeriods?: { [periodId: string]: number | null }; // periodId -> price
  // Campi legacy per compatibilità con form esistente
  title?: string; // Alias per name
  description?: string;
  brand?: string; // Per ricerca/display
  model?: string; // Per ricerca/display
  status?: 'active' | 'paused' | 'draft'; // Mappato da is_active
  delivery?: boolean; // Alias per can_be_delivered
  pickup_on_site?: boolean; // Alias per can_be_picked_up
  deposit?: number; // Da variant.deposit
  images?: string[]; // Da variant.images
  product_category_id?: string; // Legacy - non più usato
  product_subcategory_id?: string; // Legacy - alias per id_product_subcategory
  product_condition_id?: string; // Legacy - rimosso dalla nuova struttura
  min_rent_duration_day?: number; // Legacy - rimosso
  min_rent_duration_hours?: number; // Legacy - rimosso
  dimensions?: string; // Legacy - rimosso
  weight?: string; // Legacy - rimosso
}

// Component Props Types
export interface ProductCardProps {
  product: Product;
  onProductClick: (productId: string) => void;
}

export interface ProductListProps {
  products: Product[];
  isLoading: boolean;
  error: Error | null;
}

// Hook Return Types
export interface UseProductsReturn {
  products: Product[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseProductReturn {
  product: Product | null;
  isLoading: boolean;
  error: Error | null;
}

export interface UseBookingsReturn {
  bookings: Booking[];
  isLoading: boolean;
  error: Error | null;
}
