// Le regole dell'aggiornamento dei dati Fitarco stanno in supabase/functions/_shared, perché le usa
// la funzione del server. Da qui le prendono i test.
export * from '../../../supabase/functions/_shared/aggiornamento/index.ts'
