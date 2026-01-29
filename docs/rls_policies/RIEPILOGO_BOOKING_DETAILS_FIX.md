# 🔒 Fix Privacy Issue: booking_details RLS Policies

## 📋 Riepilogo

**Data:** 7 Dicembre 2025  
**Problema:** Violazione GDPR - Esposizione dati sensibili  
**Soluzione:** Funzioni SQL con SECURITY DEFINER + Rimozione policy pubblica

---

## 🚨 Problema Identificato

### Policy Problematica

La tabella `booking_details` aveva una policy RLS pubblica che esponeva dati sensibili a **chiunque**, anche utenti non autenticati:

```sql
CREATE POLICY "Anyone can view product booking_details for availability check"
  ON public.booking_details
  FOR SELECT
  USING (true);  -- ← Permette a TUTTI di vedere TUTTE le righe!
```

### Dati Sensibili Esposti

Con questa policy, **chiunque** poteva vedere:
- ✅ `user_id` - ID degli utenti che hanno fatto prenotazioni
- ✅ `price` - Prezzi delle prenotazioni
- ✅ `delivery_method` - Metodo di consegna
- ✅ `start_date`, `end_date` - Date delle prenotazioni
- ✅ `booking_id` - ID delle prenotazioni
- ✅ Tutti gli altri campi della tabella

### Violazione GDPR

Questa policy viola i principi GDPR di:
- **Data Minimization**: Espone più dati del necessario
- **Privacy by Design**: Non protegge i dati personali
- **Access Control**: Permette accesso non autorizzato

---

## ✅ Soluzione Implementata

### 1. Policy Admin-Only

**Aggiunta PRIMA** di rimuovere la policy pubblica (per evitare interruzioni):

```sql
CREATE POLICY "Admins can view all booking_details"
  ON public.booking_details
  FOR SELECT
  TO authenticated
  USING (is_admin_user());
```

**Risultato:**
- ✅ Solo gli admin possono vedere tutti i `booking_details`
- ✅ Utenti normali non possono più vedere dati di altri utenti

### 2. Rimozione Policy Pubblica

```sql
DROP POLICY IF EXISTS "Anyone can view product booking_details for availability check" 
  ON public.booking_details;
```

**Risultato:**
- ✅ Nessun utente pubblico può più vedere `booking_details` direttamente
- ✅ Protezione completa dei dati sensibili

### 3. Funzioni SQL Sicure

Creazione di funzioni SQL con `SECURITY DEFINER` che:
- Bypassano RLS internamente (per leggere i dati)
- Restituiscono **solo** i dati necessari (senza dati sensibili)
- Sono accessibili pubblicamente (anon/authenticated)

#### Funzione 1: `check_unit_availability`

**Scopo:** Controllare se un'unità è disponibile per un periodo specifico

```sql
CREATE OR REPLACE FUNCTION public.check_unit_availability(
  p_unit_ids uuid[],
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
RETURNS TABLE (
  unit_id uuid,
  is_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
```

**Restituisce:**
- ✅ `unit_id` - ID dell'unità
- ✅ `is_available` - Boolean (true/false)

**NON restituisce:**
- ❌ `user_id` - ID utente
- ❌ `price` - Prezzo
- ❌ `delivery_method` - Metodo consegna
- ❌ Altri dati sensibili

**Utilizzo:**
```typescript
const { data } = await supabase.rpc('check_unit_availability', {
  p_unit_ids: unitIds,
  p_start_date: startDateStr,
  p_end_date: endDateStr
});
```

#### Funzione 2: `get_booking_details_dates`

**Scopo:** Ottenere le date dei booking_details per visualizzazione calendario

```sql
CREATE OR REPLACE FUNCTION public.get_booking_details_dates(
  p_unit_ids uuid[]
)
RETURNS TABLE (
  id uuid,
  booking_id uuid,
  unit_id uuid,
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
```

**Restituisce:**
- ✅ `id` - ID del booking_detail
- ✅ `booking_id` - ID della prenotazione
- ✅ `unit_id` - ID dell'unità
- ✅ `start_date`, `end_date` - Date

**NON restituisce:**
- ❌ `user_id` - ID utente
- ❌ `price` - Prezzo
- ❌ `delivery_method` - Metodo consegna

#### Funzione 3: `get_booking_details_with_time_slots`

**Scopo:** Ottenere date e fasce orarie per controllo slot temporali

```sql
CREATE OR REPLACE FUNCTION public.get_booking_details_with_time_slots(
  p_unit_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  booking_id uuid,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  ritiro_fasciaoraria_inizio text,
  ritiro_fasciaoraria_fine text
)
LANGUAGE plpgsql
SECURITY DEFINER
```

**Restituisce:**
- ✅ Date e fasce orarie necessarie per controllo disponibilità slot

**NON restituisce:**
- ❌ `user_id` - ID utente
- ❌ `price` - Prezzo
- ❌ Altri dati sensibili

---

## 📝 File Modificati

### Database (Migrations)

**File:** `supabase/migrations/20251207124958-fix-booking-details-rls-privacy.sql`

**Contenuto:**
1. ✅ Policy admin-only per SELECT
2. ✅ Rimozione policy pubblica
3. ✅ Funzione `check_unit_availability`
4. ✅ Funzione `get_booking_details_dates`
5. ✅ Funzione `get_booking_details_with_time_slots`
6. ✅ Grant execute su tutte le funzioni

### Frontend (TypeScript/React)

#### 1. `src/pages/BookingDetails.tsx`

**Prima:**
```typescript
const { data: overlappingDetails } = await supabase
  .from('booking_details')
  .select('unit_id, booking_id')
  .in('unit_id', unitIds)
  .lte('start_date', endDateStr)
  .gte('end_date', startDateStr);
```

**Dopo:**
```typescript
const { data: availabilityData } = await supabase
  .rpc('check_unit_availability', {
    p_unit_ids: unitIds,
    p_start_date: startDateStr,
    p_end_date: endDateStr
  });
```

#### 2. `src/pages/Cart.tsx`

**Prima:**
```typescript
const { data: overlappingDetails } = await supabase
  .from('booking_details')
  .select('booking_id, unit_id')
  .eq('unit_id', unitId)
  .lte('start_date', endDateStr)
  .gte('end_date', startDateStr);
```

**Dopo:**
```typescript
const { data: availabilityData } = await supabase
  .rpc('check_unit_availability', {
    p_unit_ids: [unitId],
    p_start_date: startDateStr,
    p_end_date: endDateStr
  });
```

#### 3. `src/components/RentalQuoteCard.tsx`

**Prima:**
```typescript
const { data: bookingDetails } = await supabase
  .from("booking_details")
  .select("id, booking_id, unit_id, start_date, end_date")
  .in("unit_id", unitIds);
```

**Dopo:**
```typescript
const { data: bookingDetails } = await supabase
  .rpc('get_booking_details_dates', {
    p_unit_ids: unitIds
  });
```

#### 4. `src/pages/Checkout.tsx` (3 occorrenze)

**Prima:**
```typescript
const { data: overlappingDetails } = await supabase
  .from('booking_details')
  .select('unit_id, booking_id')
  .in('unit_id', unitIds)
  .lte('start_date', endDateStr)
  .gte('end_date', startDateStr);
```

**Dopo:**
```typescript
const { data: availabilityData } = await supabase
  .rpc('check_unit_availability', {
    p_unit_ids: unitIds,
    p_start_date: startDateStr,
    p_end_date: endDateStr
  });
```

#### 5. `src/components/BookingDialog.tsx`

**Prima:**
```typescript
const { data: lastBookingDetails } = await supabase
  .from("booking_details")
  .select("booking_id, start_date, end_date")
  .eq("unit_id", product.id)
  .gte("start_date", format(startDate, "yyyy-MM-dd"))
  .lte("end_date", format(endDate, "yyyy-MM-dd"));
```

**Dopo:**
```typescript
const { data: lastBookingDetails } = await supabase
  .rpc('get_booking_details_with_time_slots', {
    p_unit_id: product.id,
    p_start_date: format(startDate, "yyyy-MM-dd"),
    p_end_date: format(endDate, "yyyy-MM-dd")
  });
```

---

## 🔐 Sicurezza

### Prima del Fix

| Aspetto | Stato |
|---------|-------|
| Policy pubblica SELECT | ❌ Attiva (`USING (true)`) |
| Dati sensibili esposti | ❌ Sì (user_id, price, ecc.) |
| Accesso non autenticato | ❌ Permesso |
| Conformità GDPR | ❌ Violato |

### Dopo il Fix

| Aspetto | Stato |
|---------|-------|
| Policy pubblica SELECT | ✅ Rimossa |
| Policy admin-only SELECT | ✅ Attiva |
| Dati sensibili esposti | ✅ No (solo dati necessari) |
| Accesso non autenticato | ✅ Solo tramite funzioni RPC |
| Conformità GDPR | ✅ Conforme |

---

## 🎯 Vantaggi della Soluzione

### 1. Privacy by Design

- ✅ Solo dati necessari esposti
- ✅ Nessun dato sensibile accessibile pubblicamente
- ✅ Conformità GDPR

### 2. Sicurezza

- ✅ RLS policies applicate correttamente
- ✅ Funzioni SQL con `SECURITY DEFINER` per controllo granulare
- ✅ Nessun accesso diretto ai dati sensibili

### 3. Performance

- ✅ Funzioni SQL ottimizzate
- ✅ Meno query multiple (logica centralizzata nel database)
- ✅ Cache e ottimizzazioni PostgreSQL

### 4. Manutenibilità

- ✅ Logica centralizzata nelle funzioni SQL
- ✅ Facile da modificare (un solo punto di modifica)
- ✅ Codice frontend più pulito

---

## 📊 Confronto: Prima vs Dopo

### Query Diretta (Prima)

```typescript
// ❌ Espone TUTTI i dati sensibili
const { data } = await supabase
  .from('booking_details')
  .select('*')  // ← Vede user_id, price, delivery_method, ecc.
  .in('unit_id', unitIds);
```

**Problemi:**
- Espone `user_id`, `price`, `delivery_method`, ecc.
- Violazione GDPR
- Accesso non controllato

### Funzione RPC (Dopo)

```typescript
// ✅ Espone SOLO dati necessari
const { data } = await supabase
  .rpc('check_unit_availability', {
    p_unit_ids: unitIds,
    p_start_date: startDateStr,
    p_end_date: endDateStr
  });
// Restituisce solo: unit_id, is_available
```

**Vantaggi:**
- Solo dati necessari esposti
- Nessun dato sensibile
- Conformità GDPR

---

## 🔍 Come Funziona SECURITY DEFINER

### Cosa Significa

```sql
SECURITY DEFINER
```

La funzione viene eseguita con i **privilegi del creatore** (di solito admin), non dell'utente che la chiama.

### Come Funziona

1. **Utente chiama la funzione:**
   ```typescript
   await supabase.rpc('check_unit_availability', {...});
   ```

2. **Funzione bypassa RLS:**
   - Eseguita con privilegi admin
   - Può leggere TUTTE le colonne di `booking_details`
   - RLS policies non si applicano

3. **Funzione restituisce solo dati necessari:**
   - Legge `user_id`, `price`, `delivery_method` internamente
   - Restituisce solo `unit_id` e `is_available`
   - Utente NON vede dati sensibili

### Esempio

```sql
-- Funzione legge internamente:
SELECT user_id, price, delivery_method, unit_id, start_date, end_date
FROM booking_details
WHERE unit_id = 'xxx';

-- Ma restituisce solo:
RETURNS TABLE (
  unit_id uuid,
  is_available boolean
);
```

**Risultato:** Utente vede solo `unit_id` e `is_available`, non `user_id`, `price`, ecc.

---

## ✅ Testing

### Verifica Policy

```sql
-- Verifica che la policy pubblica sia stata rimossa
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'booking_details' 
  AND policyname = 'Anyone can view product booking_details for availability check';
-- Risultato: [] (vuoto = policy rimossa)

-- Verifica che la policy admin esista
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'booking_details' 
  AND policyname = 'Admins can view all booking_details';
-- Risultato: Policy trovata
```

### Verifica Funzioni

```sql
-- Verifica che le funzioni esistano
SELECT proname 
FROM pg_proc 
WHERE proname IN (
  'check_unit_availability',
  'get_booking_details_dates',
  'get_booking_details_with_time_slots'
);
-- Risultato: 3 funzioni trovate
```

### Test Frontend

1. ✅ Verificare che il controllo disponibilità funzioni
2. ✅ Verificare che il calendario mostri le date corrette
3. ✅ Verificare che gli slot temporali siano controllati correttamente
4. ✅ Verificare che gli admin possano vedere tutti i booking_details

---

## 📌 Note Importanti

### Query che NON sono state modificate

Le seguenti query sono **corrette** e **non devono essere modificate**:

1. **INSERT/UPDATE/DELETE:**
   - Protette da RLS policies (solo i propri booking_details)
   - Non espongono dati sensibili (l'utente inserisce/aggiorna solo i propri dati)

2. **SELECT per carrello:**
   - Protette da RLS policy "Users can view own booking_details"
   - L'utente vede solo i propri booking_details

3. **Query admin:**
   - Gli admin possono vedere tutti i booking_details (policy admin-only)
   - Non è un problema di sicurezza (sono admin)

### Limitazioni

1. **Cart Bookings:**
   - La funzione `check_unit_availability` controlla solo prenotazioni confermate (`cart = false`)
   - Le prenotazioni nel carrello non bloccano la disponibilità
   - Questo è intenzionale (il carrello non è una prenotazione confermata)

2. **Esclusione Booking Detail Corrente:**
   - La funzione RPC non supporta l'esclusione di un `booking_detail` specifico
   - Per `Cart.tsx`, questo è gestito dalla logica che considera solo prenotazioni confermate

---

## 🎓 Lezioni Apprese

### 1. RLS Policies e Colonne

**Importante:** RLS policies controllano le **righe**, non le **colonne**.

- Una policy `USING (true)` permette di vedere **tutte le righe**
- Ma non limita le **colonne** visibili
- Se fai `.select('*')`, vedi **tutte le colonne**

### 2. SECURITY DEFINER

**Quando usare:**
- Quando serve bypassare RLS per logica complessa
- Quando serve restituire solo dati specifici (senza esporre tutto)
- Quando serve centralizzare la logica nel database

**Vantaggi:**
- Controllo granulare sui dati esposti
- Logica centralizzata
- Performance migliori

### 3. Privacy by Design

**Principio:**
- Esporre solo i dati **necessari**
- Non esporre dati **sensibili** se non necessario
- Usare funzioni SQL per controllare l'esposizione

---

## 📚 Riferimenti

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [GDPR Data Minimization](https://gdpr.eu/data-minimization/)

---

## ✅ Checklist Finale

- [x] Policy admin-only creata
- [x] Policy pubblica rimossa
- [x] Funzione `check_unit_availability` creata
- [x] Funzione `get_booking_details_dates` creata
- [x] Funzione `get_booking_details_with_time_slots` creata
- [x] Grant execute su tutte le funzioni
- [x] `BookingDetails.tsx` aggiornato
- [x] `Cart.tsx` aggiornato
- [x] `RentalQuoteCard.tsx` aggiornato
- [x] `Checkout.tsx` aggiornato (3 occorrenze)
- [x] `BookingDialog.tsx` aggiornato
- [x] Migration applicata al database
- [x] File riepilogo creato

---

**Status:** ✅ **COMPLETATO**

