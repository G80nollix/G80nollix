# Configurazione Realtime Replication per Bookings

## FASE 1: Abilitare Realtime Replication

Per far funzionare le subscription Realtime sulla tabella `bookings`, devi abilitare la replica Realtime.

### Opzione A: Tramite Dashboard Supabase (Consigliato)

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **Database** → **Replication**
4. Cerca la tabella `bookings` nella lista
5. **Attiva il toggle** per abilitare la replica Realtime
6. Salva

### Opzione B: Tramite SQL

Esegui questa query nel SQL Editor di Supabase:

```sql
-- Abilita replica Realtime per la tabella bookings
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
```

### Verifica

Dopo aver abilitato la replica, puoi verificare che funzioni:

1. Vai su **Database** → **Replication**
2. Verifica che `bookings` sia nella lista delle tabelle replicate
3. Dovresti vedere un indicatore verde o un toggle attivo

## Nota Importante

⚠️ **Senza questa configurazione, le subscription Realtime non funzioneranno!**

Se la replica non è abilitata, la pagina `PaymentProcessing` userà automaticamente il fallback (chiamata a Stripe API dopo 5 secondi).

## Troubleshooting

### La subscription non riceve eventi

1. Verifica che la replica sia abilitata (Dashboard → Database → Replication)
2. Controlla i log della console del browser per errori
3. Verifica che il webhook stia aggiornando effettivamente il database

### Errori di connessione Realtime

- Verifica che il tuo piano Supabase supporti Realtime
- Controlla i limiti di connessioni del tuo piano
- Vedi la documentazione: https://supabase.com/docs/guides/realtime






















