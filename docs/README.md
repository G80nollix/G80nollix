# Nollix - Piattaforma di Noleggio Sportivo

Una piattaforma moderna per il noleggio di attrezzatura sportiva, costruita con React, TypeScript e Supabase.

## 🏗️ Architettura del Progettoo

Il progetto è stato completamente riorganizzato seguendo i principi di ingegneria del software per garantire:

- **Modularità**: Componenti piccoli e riutilizzabili
- **Separazione delle responsabilità**: UI, business logic e data access separati.
- **Tipizzazione forte**: TypeScript per prevenire errori a runtime
- **Gestione dello stato centralizzata**: React Query per la gestione dello stato server
- **Gestione errori robusta**: Error boundaries e gestione errori centralizzataa

### 📁 Struttura delle Cartelle 

```
src/
├── components/           # Componenti UI riutilizzabili
│   ├── ui/              # Componenti base (shadcn/ui)
│   ├── products/        # Componenti specifici per i prodotti
│   └── auth/            # Componenti per l'autenticazione
├── hooks/               # Custom hooks per la logica di business
├── services/            # Layer di servizi per le API
├── types/               # Definizioni TypeScript
├── constants/           # Costanti dell'applicazione
├── pages/               # Componenti pagina
├── integrations/        # Integrazioni esterne (Supabase)
└── lib/                 # Utility e configurazioni
```

### 🔧 Principi Architetturali Implementati

#### 1. **Single Responsibility Principle (SRP)**
- Ogni componente ha una sola responsabilità
- Separazione tra UI, business logic e data access
- Hooks personalizzati per la logica di business

#### 2. **Dependency Inversion Principle (DIP)**
- Layer di servizi per astrazione delle API
- Inversione di controllo tramite hooks
- Dipendenze iniettate tramite props

#### 3. **Open/Closed Principle (OCP)**
- Componenti estensibili tramite props
- Configurazione tramite costanti
- Pattern di composizione per estensibilità

#### 4. **Interface Segregation Principle (ISP)**
- Interfacce TypeScript specifiche per ogni use case
- Props tipizzate per ogni componente
- Separazione delle responsabilità nei servizi

#### 5. **Liskov Substitution Principle (LSP)**
- Implementazione coerente delle interfacce
- Sostituibilità dei componenti
- Comportamento prevedibile

## 🚀 Tecnologie Utilizzate

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui
- **State Management**: React Query (TanStack Query)
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Routing**: React Router v6
- **Form Handling**: React Hook Form
- **Validation**: Zod

## 📦 Installazione

```bash
# Clona il repository
git clone <repository-url>
cd nolly-sport-share

# Installa le dipendenze
npm install

# Configura le variabili d'ambiente
cp .env.example .env.local
# Modifica .env.local con le tue credenziali Supabase

# Avvia il server di sviluppo
npm run dev
```

## 🔧 Configurazione

### Variabili d'Ambiente

Crea un file `.env.local` con le seguenti variabili:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🚀 Deploy

### Deploy su Vercel

Il progetto è configurato per il deploy su Vercel con il file `vercel.json` che gestisce correttamente le route SPA.

1. **Connetti il repository a Vercel**
2. **Configura le variabili d'ambiente**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Deploy automatico** - Vercel si occuperà del resto

### Deploy su Netlify

Se preferisci usare Netlify, il file `public/_redirects` è già configurato per gestire le route SPA.

### Note Importanti

- ✅ Tutte le route admin sono protette con `AdminProtectedRoute`
- ✅ Il routing SPA è configurato correttamente
- ✅ Le variabili d'ambiente devono essere configurate nel provider di hosting

## 📧 Sistema Email

### Funzioni Email

- **`send-email`**: Funzione generica per invio email con HTML personalizzato (usata per tutti i tipi di email)

### Flusso Email di Benvenuto

1. **Registrazione Autonoma**: 
   - L'utente si registra tramite il form
   - Il trigger `on_auth_user_created` crea il profilo utente
   - `send-email` viene chiamata direttamente dal frontend con HTML personalizzato

2. **Creazione da Admin**:
   - L'admin crea un utente
   - `create-customer-account` chiama direttamente `send-email` con template personalizzato

### Supabase Setup

1. Crea un progetto su [Supabase](https://supabase.com)
2. Configura le tabelle del database (vedi `supabase/migrations/`)
3. Configura l'autenticazione
4. Configura le policy RLS

## 🏃‍♂️ Utilizzo

### Sviluppo

```bash
# Avvia il server di sviluppo
npm run dev

# Build per produzione
npm run build

# Preview build
npm run preview

# Linting
npm run lint

# Type checking
npm run type-check
```

### Struttura dei Componenti

#### Componenti Modulari

```typescript
// Esempio di componente modulare
interface ProductCardProps {
  product: Product;
  onProductClick: (productId: string) => void;
}

export const ProductCard = ({ product, onProductClick }: ProductCardProps) => {
  // Logica del componente
};
```

#### Custom Hooks

```typescript
// Esempio di hook personalizzato
export const useProducts = (filters: ProductFilters, userId?: string) => {
  // Logica di business
  return { products, isLoading, error, refetch };
};
```

#### Servizi API

```typescript
// Esempio di servizio API
export class ProductService {
  static async getProducts(filters: ProductFilters): Promise<ApiResponse<Product[]>> {
    // Logica di accesso ai dati
  }
}
```

## 🧪 Testing

```bash
# Esegui i test
npm run test

# Test con coverage
npm run test:coverage

# Test e2e
npm run test:e2e
```

## 📚 Documentazione API

### Endpoints Principali

- `GET /products` - Lista prodotti
- `GET /products/:id` - Dettaglio prodotto
- `POST /products` - Crea prodotto
- `PUT /products/:id` - Aggiorna prodotto
- `DELETE /products/:id` - Elimina prodotto

### Autenticazione

L'applicazione utilizza Supabase Auth con:
- Email/Password
- OAuth (Google)
- Session management automatico

## 🔒 Sicurezza

- **RLS (Row Level Security)** su Supabase
- **Validazione input** con Zod
- **Sanitizzazione** dei dati
- **Error boundaries** per gestione errori
- **Type safety** con TypeScript

## 🚀 Deployment

### Vercel

```bash
# Deploy su Vercel
npm run build
vercel --prod
```

### Netlify

```bash
# Deploy su Netlify
npm run build
netlify deploy --prod
```

## 🤝 Contribuire

1. Fork il progetto
2. Crea un branch per la feature (`git checkout -b feature/AmazingFeature`)
3. Commit le modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

### Standard di Codice

- **TypeScript**: Tipizzazione forte per tutti i componenti
- **ESLint**: Configurazione rigorosa per la qualità del codice
- **Prettier**: Formattazione automatica
- **Conventional Commits**: Standard per i messaggi di commit

## 📄 Licenza

Questo progetto è sotto licenza MIT. Vedi il file `LICENSE` per i dettagli.

## 🆘 Supporto

Per supporto o domande:
- Apri una issue su GitHub
- Contatta il team di sviluppo
- Consulta la documentazione Supabase

## 🔄 Changelog

### v2.0.0 - Riorganizzazione Architetturale
- ✅ Separazione delle responsabilità
- ✅ Layer di servizi centralizzato
- ✅ Custom hooks per business logic
- ✅ Tipizzazione forte con TypeScript
- ✅ Error boundaries e gestione errori
- ✅ Costanti centralizzate
- ✅ Componenti modulari e riutilizzabili

### v1.0.0 - Release Iniziale
- ✅ Autenticazione utenti
- ✅ Gestione prodotti
- ✅ Sistema di prenotazioni
- ✅ UI responsive
