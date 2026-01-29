# Schema Database - Sistema Gestione Prodotti

Questo documento descrive la struttura completa del database per la gestione di prodotti, categorie, attributi, varianti e unità fisiche. Questo schema supporta un sistema flessibile per descrivere prodotti generici e le loro specifiche istanze.

**Data di riferimento**: Novembre 2025

---

## 📋 Indice

1. [Panoramica Generale](#panoramica-generale)
2. [Entità Principali](#entità-principali)
3. [Gestione Attributi](#gestione-attributi)
4. [Varianti e Unità Fisiche](#varianti-e-unità-fisiche)
5. [Relazioni tra Tabelle](#relazioni-tra-tabelle)
6. [Note Implementative](#note-implementative)

---

## 🎯 Panoramica Generale

Il database è organizzato attorno all'entità **`Products`** (prodotto generico), che è categorizzata e può avere diverse **`Product_variants`** (varianti di prodotto). Ogni variante può avere attributi specifici e può essere associata a più **`Product_units`** (unità fisiche individuali).

**Flusso logico**:
```
Product_categories → Product_subcategories → Products → Product_variants → Product_units
```

**Caratteristiche principali**:
- ✅ Organizzazione gerarchica (Categorie → Sottocategorie → Prodotti)
- ✅ Gestione flessibile degli attributi per sottocategoria
- ✅ Sistema di varianti basato su combinazioni di attributi
- ✅ Tracciamento di unità fisiche individuali con seriali
- ✅ Supporto per modelli di prezzo multipli (vendita e noleggio)

---

## 🏗️ Entità Principali

### 1. `Product_categories`

**Scopo**: Rappresenta le categorie di alto livello a cui appartengono i prodotti (es. "Elettronica", "Abbigliamento", "Sport").

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco della categoria |
| `Name` | UNIQUE | Nome univoco della categoria |

**Relazioni**:
- Una categoria può avere molte sottocategorie (`Product_subcategories`)

**Esempio**:
```
ID: 1
Name: "Elettronica"
```

---

### 2. `Product_subcategories`

**Scopo**: Rappresenta le sottocategorie specifiche all'interno di una categoria (es. "Smartphone" sotto "Elettronica", "Pantaloni" sotto "Abbigliamento").

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco della sottocategoria |
| `ID_product_category` | FK | Chiave esterna che collega alla categoria padre |
| `Name` | | Nome della sottocategoria |
| `(ID_product_category, Name)` | UNIQUE | Assicura che il nome della sottocategoria sia univoco all'interno della sua categoria |

**Relazioni**:
- Appartiene a una `Product_categories`
- Una sottocategoria può avere molti prodotti generici (`Products`)

**Esempio**:
```
ID: 1
ID_product_category: 1
Name: "Smartphone"
```

---

### 3. `Products`

**Scopo**: Rappresenta il prodotto generico (es. "iPhone 15 Pro Max", "Nike Air Max 90").

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco del prodotto generico |
| `ID_product_subcategory` | FK | Chiave esterna che collega alla sottocategoria |
| `Name` | TEXT | Nome del prodotto generico |
| `Description` | TEXT | Descrizione dettagliata del prodotto (nullable) |
| `Is_active` | BOOLEAN | Indica se il prodotto è attivo (default: true) |
| `ID_brand` | FK | Chiave esterna che collega al marchio del prodotto (nullable) |
| `ID_model` | FK | Chiave esterna che collega al modello del prodotto (nullable) |
| `Can_be_delivered` | BOOLEAN | Indica se il prodotto può essere consegnato (default: true) |
| `Can_be_picked_up` | BOOLEAN | Indica se il prodotto può essere ritirato (default: true) |
| `Company_id` | FK | Chiave esterna che collega al profilo aziendale (nullable) |
| `Created_at` | TIMESTAMPTZ | Data di creazione (default: now()) |
| `Updated_at` | TIMESTAMPTZ | Data di ultimo aggiornamento (default: now()) |

**Relazioni**:
- Appartiene a una `Product_subcategories`
- Appartiene a un `Product_brand`
- Appartiene a un `Product_model`
- Un prodotto generico può avere molte varianti (`Product_variants`)

**Esempio**:
```
ID: 1
ID_product_subcategory: 1
Name: "iPhone 15 Pro Max"
Description: "Smartphone Apple con chip A17 Pro..."
ID_brand: 1 (Apple)
ID_model: 1 (Pro Max)
Can_be_delivered: true
Can_be_picked_up: true
Is_active: true
```

---

### 4. `Product_brand`

**Scopo**: Gestisce i marchi dei prodotti (es. "Apple", "Samsung", "Nike").

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco del marchio |
| `Name` | TEXT UNIQUE | Nome del marchio |
| `Created_at` | TIMESTAMPTZ | Data di creazione (default: now()) |
| `Updated_at` | TIMESTAMPTZ | Data di ultimo aggiornamento (default: now()) |

**Relazioni**:
- Un marchio può essere associato a molti prodotti generici (`Products`)
- Un marchio può avere molti modelli (`Product_model`)

**Esempio**:
```
ID: 1
Name: "Apple"
```

---

### 5. `Product_model`

**Scopo**: Gestisce i modelli dei prodotti (es. "Pro Max", "Ultra", "Air Max").

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco del modello |
| `Name` | TEXT UNIQUE | Nome del modello |
| `ID_brand` | FK | Chiave esterna che collega al brand del modello (nullable) |
| `Created_at` | TIMESTAMPTZ | Data di creazione (default: now()) |
| `Updated_at` | TIMESTAMPTZ | Data di ultimo aggiornamento (default: now()) |

**Relazioni**:
- Appartiene a un `Product_brand` (opzionale)
- Un modello può essere associato a molti prodotti generici (`Products`)

**Esempio**:
```
ID: 1
Name: "Pro Max"
ID_brand: 1 (Apple)
```

---

## 🏷️ Gestione Attributi

### 6. `Product_attributes`

**Scopo**: Definisce gli attributi possibili per i prodotti (es. "Colore", "Memoria", "Dimensione", "Taglia").

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco dell'attributo |
| `Name` | TEXT | Nome dell'attributo |
| `Unit` | TEXT | Unità di misura dell'attributo, se applicabile (cm, kg, none, ecc.) (nullable) |
| `Created_at` | TIMESTAMPTZ | Data di creazione (default: now()) |
| `Updated_at` | TIMESTAMPTZ | Data di ultimo aggiornamento (default: now()) |

**Relazioni**:
- Un attributo può avere molti valori possibili (`Product_attributes_values`)

**Esempio**:
```
ID: 1
Name: "Colore"
Unit: "none"

ID: 2
Name: "Memoria"
Unit: "GB"

ID: 3
Name: "Peso"
Unit: "kg"
```

---

### 7. `Product_attributes_values`

**Scopo**: Contiene i valori specifici per ogni attributo (es. "Rosso" per l'attributo "Colore", "256GB" per "Memoria").

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco del valore dell'attributo |
| `ID_product_attribute` | FK | Chiave esterna che collega all'attributo padre |
| `Value` | TEXT | Il valore effettivo dell'attributo |
| `Created_at` | TIMESTAMPTZ | Data di creazione (default: now()) |
| `Updated_at` | TIMESTAMPTZ | Data di ultimo aggiornamento (default: now()) |

**Relazioni**:
- Appartiene a un `Product_attributes`
- Un valore di attributo può essere utilizzato in molte combinazioni di attributi per le varianti (`Product_variant_attribute_values`)

**Esempio**:
```
ID: 1
ID_product_attribute: 1 (Colore)
Value: "Rosso"

ID: 2
ID_product_attribute: 1 (Colore)
Value: "Blu"

ID: 3
ID_product_attribute: 2 (Memoria)
Value: "256GB"
```

---

### 8. `Allowed_subcategories_attributes` (Tabella di giunzione)

**Scopo**: Definisce quali attributi sono pertinenti per una specifica sottocategoria. Questo permette di associare attributi diversi a sottocategorie diverse. Il flag `Is_variable` indica se l'attributo deve essere usato per creare varianti di prodotto.

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco |
| `ID_product_subcategory` | FK | Chiave esterna alla sottocategoria |
| `ID_product_attribute` | FK | Chiave esterna all'attributo |
| `(ID_product_subcategory, ID_product_attribute)` | UNIQUE | Assicura che un attributo sia associato a una sottocategoria una sola volta |
| `Is_variable` | BOOLEAN | **IMPORTANTE**: Indica se questo attributo deve essere usato per creare varianti di prodotto (default: false). Es: "Colore" è `Is_variable=true`, "Materiale" potrebbe essere `Is_variable=false` se non crea varianti distinte |
| `Created_at` | TIMESTAMPTZ | Data di creazione (default: now()) |
| `Updated_at` | TIMESTAMPTZ | Data di ultimo aggiornamento (default: now()) |

**Relazioni**:
- Molti-a-molti tra `Product_subcategories` e `Product_attributes`

**Esempio**:
```
ID: 1
ID_product_subcategory: 1 (Smartphone)
ID_product_attribute: 1 (Colore)
Is_variable: true  ← Crea varianti distinte

ID: 2
ID_product_subcategory: 1 (Smartphone)
ID_product_attribute: 2 (Memoria)
Is_variable: true  ← Crea varianti distinte

ID: 3
ID_product_subcategory: 1 (Smartphone)
ID_product_attribute: 3 (Peso)
Is_variable: false  ← Non crea varianti, è solo informativo
```

**Logica `Is_variable`**:
- `Is_variable = true`: L'attributo partecipa alla creazione di varianti. Ogni combinazione unica di valori di attributi variabili crea una variante distinta.
- `Is_variable = false`: L'attributo è solo informativo e non crea varianti separate.

---

## 🔄 Varianti e Unità Fisiche

### 9. `Product_variants`

**Scopo**: Rappresenta una specifica combinazione di attributi per un prodotto generico (es. "iPhone 15 Pro Max, 256GB, Blu").

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco della variante |
| `ID_product` | FK | Chiave esterna che collega al prodotto generico |
| `Price` | NUMERIC | Prezzo di vendita della variante (nullable) |
| `Qty_stock` | INTEGER | Quantità in magazzino di questa variante (default: 0) |
| `Is_active` | BOOLEAN | Indica se la variante è attiva (default: true) |
| `Price_hour` | NUMERIC | Prezzo per noleggio orario (nullable) |
| `Price_daily` | NUMERIC | Prezzo per noleggio giornaliero (nullable) |
| `Price_weekly` | NUMERIC | Prezzo per noleggio settimanale (nullable) |
| `Price_monthly` | NUMERIC | Prezzo per noleggio mensile (nullable) |
| `Deposit` | NUMERIC | Deposito cauzionale (nullable) |
| `Images` | TEXT[] | Array di URL delle immagini della variante (default: '{}') |
| `Created_at` | TIMESTAMPTZ | Data di creazione (default: now()) |
| `Updated_at` | TIMESTAMPTZ | Data di ultimo aggiornamento (default: now()) |

**Relazioni**:
- Appartiene a un `Products`
- Una variante può avere molte unità fisiche (`Product_units`)
- Una variante è definita da una combinazione di valori di attributi (`Product_variant_attribute_values`)

**Esempio**:
```
ID: 1
ID_product: 1 (iPhone 15 Pro Max)
Price: 1299.00
Qty_stock: 10
Price_hour: 5.00
Price_daily: 50.00
Price_weekly: 300.00
Price_monthly: 1000.00
Is_active: true
```

**Nota**: Questa variante rappresenta una specifica combinazione di attributi (es. "256GB, Blu") definita tramite `Product_variant_attribute_values`.

---

### 10. `Product_variant_attribute_values` (Tabella di giunzione)

**Scopo**: Collega una `Product_variants` ai `Product_attributes_values` che la definiscono. Questa tabella forma la "combinazione di attributi con determinati valori" che definisce una variante.

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco |
| `ID_product_attribute_value` | FK | Chiave esterna al valore dell'attributo |
| `ID_product_variant` | FK | Chiave esterna alla variante |
| `Created_at` | TIMESTAMPTZ | Data di creazione (default: now()) |

**Relazioni**:
- Molti-a-molti tra `Product_variants` e `Product_attributes_values`

**Esempio**:
```
Variante 1 (iPhone 15 Pro Max, 256GB, Blu):
- ID: 1, ID_product_variant: 1, ID_product_attribute_value: 3 (256GB)
- ID: 2, ID_product_variant: 1, ID_product_attribute_value: 2 (Blu)

Variante 2 (iPhone 15 Pro Max, 512GB, Rosso):
- ID: 3, ID_product_variant: 2, ID_product_attribute_value: 4 (512GB)
- ID: 4, ID_product_variant: 2, ID_product_attribute_value: 1 (Rosso)
```

---

### 11. `Product_unit_conditions`

**Scopo**: Definisce le condizioni di un prodotto (es. "Nuovo", "Usato", "Ricondizionato", "Ottimo stato").

**Nota**: Nel database questa tabella si chiama `product_unit_conditions`.

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco della condizione |
| `Name` | TEXT UNIQUE | Nome della condizione |

**Relazioni**:
- Una condizione può essere applicata a molte unità fisiche (`Product_units`)

**Esempio**:
```
ID: 1
Name: "Nuovo"

ID: 2
Name: "Usato - Ottimo stato"

ID: 3
Name: "Ricondizionato"
```

---

### 12. `Product_unit_status`

**Scopo**: Definisce lo stato operativo di un prodotto (es. "Attivo", "In manutenzione", "Eliminato", "Noleggiato", "Disponibile").

**Nota**: Nel database questa tabella si chiama `product_unit_status`.

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco dello stato |
| `Name` | TEXT UNIQUE | Nome dello stato |

**Relazioni**:
- Uno stato può essere applicato a molte unità fisiche (`Product_units`)

**Esempio**:
```
ID: 1
Name: "Disponibile"

ID: 2
Name: "Noleggiato"

ID: 3
Name: "In manutenzione"

ID: 4
Name: "Eliminato"
```

---

### 13. `Product_units`

**Scopo**: Rappresenta una singola unità fisica di un prodotto (es. "Il mio iPhone 15 Pro Max blu con seriale ABC123XYZ").

**Campi**:
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `ID` | PK | Identificatore univoco dell'unità fisica |
| `ID_product_variant` | FK | Chiave esterna che collega alla variante specifica |
| `Serial_number` | TEXT UNIQUE | Numero di serie univoco per l'unità fisica |
| `ID_product_status` | FK | Chiave esterna che collega allo stato attuale dell'unità (nullable) |
| `ID_product_condition` | FK | Chiave esterna che collega alla condizione attuale dell'unità (nullable) |
| `Created_at` | TIMESTAMPTZ | Data di creazione (default: now()) |
| `Updated_at` | TIMESTAMPTZ | Data di ultimo aggiornamento (default: now()) |

**Relazioni**:
- Appartiene a una `Product_variants`
- Appartiene a un `Product_unit_status` (tabella `product_unit_status`)
- Appartiene a un `Product_unit_conditions` (tabella `product_unit_conditions`)

**Esempio**:
```
ID: 1
ID_product_variant: 1 (iPhone 15 Pro Max, 256GB, Blu)
Serial_number: "ABC123XYZ789"
ID_product_status: 1 (Disponibile)
ID_product_condition: 1 (Nuovo)
```

---

## 🔗 Relazioni tra Tabelle

### Diagramma delle Relazioni

```
Product_categories (1) ──< (N) Product_subcategories
                                    │
                                    │ (1)
                                    │
                                    ▼
                            (N) Products (1)
                                    │         │
                                    │         │
                        (1)         │         │ (1)
                        │           │         │
                        ▼           ▼         ▼
                    Product_brand   Product_model
                        │               │
                        │ (1:N)         │
                        └───────────────┘
                                    │
                                    │ (1)
                                    │
                                    ▼
                            (N) Product_variants
                                    │
                                    │ (1)
                                    │
                                    ▼
                            (N) Product_units
                                    │
                        ┌───────────┴───────────┐
                        │                       │
                        ▼                       ▼
            Product_unit_status      Product_unit_conditions

Product_subcategories (N) ──< Allowed_subcategories_attributes >── (N) Product_attributes
                                                                          │
                                                                          │ (1)
                                                                          │
                                                                          ▼
                                                              Product_attributes_values
                                                                          │
                                                                          │ (N)
                                                                          │
                                                                          ▼
                                            Product_variant_attribute_values
                                                                          │
                                                                          │ (N)
                                                                          │
                                                                          ▼
                                                                    Product_variants
```

### Relazioni Chiave

1. **Gerarchia Categorie**:
   - `Product_categories` → `Product_subcategories` (1:N)
   - `Product_subcategories` → `Products` (1:N)

2. **Prodotti e Varianti**:
   - `Products` → `Product_variants` (1:N)
   - `Product_variants` → `Product_units` (1:N)

3. **Attributi e Varianti**:
   - `Product_subcategories` ↔ `Product_attributes` (N:M tramite `Allowed_subcategories_attributes`)
   - `Product_attributes` → `Product_attributes_values` (1:N)
   - `Product_variants` ↔ `Product_attributes_values` (N:M tramite `Product_variant_attribute_values`)

4. **Marchi e Modelli**:
   - `Product_brand` → `Products` (1:N)
   - `Product_model` → `Products` (1:N)

5. **Stati e Condizioni**:
   - `Product_unit_status` → `Product_units` (1:N)
   - `Product_unit_conditions` → `Product_units` (1:N)

---

## 💡 Note Implementative

### 1. Creazione di Varianti

Per creare una variante di prodotto:
1. Identificare il prodotto generico (`Products`)
2. Identificare gli attributi variabili per quella sottocategoria (`Allowed_subcategories_attributes` dove `Is_variable = true`)
3. Selezionare i valori specifici per quegli attributi (`Product_attributes_values`)
4. Creare la `Product_variants` con i prezzi e quantità
5. Collegare la variante ai valori degli attributi tramite `Product_variant_attribute_values`

**Esempio pratico**:
```
Prodotto: iPhone 15 Pro Max
Attributi variabili: Colore, Memoria
Valori selezionati: Blu, 256GB
→ Crea variante con questi attributi
```

### 2. Gestione Stock

- Lo stock è gestito a livello di **variante** (`Product_variants.Qty_stock`)
- Le **unità fisiche** (`Product_units`) rappresentano le singole istanze con seriale
- Lo stato dell'unità fisica (`Product_unit_status`) può essere "Disponibile", "Noleggiato", ecc.
- Le immagini sono gestite a livello di **variante** (`Product_variants.Images`)

### 3. Prezzi Multipli

Il sistema supporta:
- **Prezzo di vendita**: `Product_variants.Price`
- **Prezzi di noleggio**: `Price_hour`, `Price_daily`, `Price_weekly`, `Price_monthly`

### 4. Attributi Variabili vs Informativi

- **Attributi variabili** (`Is_variable = true`): Creano varianti distinte
  - Esempio: Colore, Memoria, Taglia
- **Attributi informativi** (`Is_variable = false`): Solo descrittivi, non creano varianti
  - Esempio: Peso, Dimensioni, Materiale (se non influisce sul prezzo/variante)

### 5. Unicità e Vincoli

- **Categorie**: Nome univoco globale
- **Sottocategorie**: Nome univoco all'interno della categoria
- **Prodotti**: Nome univoco all'interno della sottocategoria
- **Unità fisiche**: Serial number univoco globale
- **Attributi per sottocategoria**: Un attributo può essere associato a una sottocategoria una sola volta

### 6. Query Utili

**Ottenere tutte le varianti di un prodotto con i loro attributi**:
```sql
SELECT 
    pv.*,
    pa.Name as attribute_name,
    pav.Value as attribute_value
FROM Product_variants pv
JOIN Product_variant_attribute_values pvav ON pv.ID = pvav.ID_product_variant
JOIN Product_attributes_values pav ON pvav.ID_product_attribute_value = pav.ID
JOIN Product_attributes pa ON pav.ID_product_attribute = pa.ID
WHERE pv.ID_product = ?
```

**Ottenere tutte le unità fisiche disponibili per una variante**:
```sql
SELECT 
    pu.*,
    ps.Name as status_name,
    pc.Name as condition_name
FROM Product_units pu
JOIN Product_unit_status ps ON pu.ID_product_status = ps.ID
JOIN Product_unit_conditions pc ON pu.ID_product_condition = pc.ID
WHERE pu.ID_product_variant = ?
AND ps.Name = 'Disponibile'
```

---

## 📝 Considerazioni Future

Questa struttura è robusta e permette di:
- ✅ Organizzare i prodotti con categorie e sottocategorie
- ✅ Definire prodotti generici con marchi e modelli
- ✅ Gestire attributi flessibili associando attributi specifici a sottocategorie
- ✅ Creare varianti di prodotto basate su combinazioni di attributi
- ✅ Tracciare unità fisiche individuali con numeri di serie, stati e condizioni
- ✅ Supportare modelli di prezzo multipli (vendita e noleggio)

**Possibili estensioni future**:
- Tabelle per gestire prenotazioni/noleggi (`Bookings`, `Rentals`)
- Tabelle per gestire immagini dei prodotti
- Tabelle per gestire recensioni/valutazioni
- Tabelle per gestire inventario e movimentazioni
- Tabelle per gestire fornitori

---

**Ultimo aggiornamento**: Gennaio 2025
**Versione schema**: 1.1

---

## 📌 Note sulla Struttura Reale del Database

### Differenze tra Documentazione e Implementazione

1. **Nomi Tabelle**: 
   - `Product_condition` → `product_unit_conditions` (nel database)
   - `Product_status` → `product_unit_status` (nel database)

2. **Campi Aggiuntivi**:
   - Tutte le tabelle principali hanno `created_at` e `updated_at` per il tracciamento temporale
   - `Product_variants` include `images` (TEXT[]) per le immagini della variante
   - `Products` include `company_id` per collegare prodotti ad aziende

3. **Campi Rimossi**:
   - `Products` non include più `dimensions`, `weight`, `deleted` (rimossi durante la migrazione)
   - `Products` usa `name` invece di `title`

4. **Vincoli**:
   - I nomi dei campi nel database sono in lowercase (es. `id_product` invece di `ID_product`)
   - Le foreign key seguono la convenzione snake_case

