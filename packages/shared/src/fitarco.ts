// Le richieste a Fitarco stanno in supabase/functions/_shared, perché le usano le funzioni del
// server (Deno). Da qui le prendono i test e, in futuro, l'app.
export * from '../../../supabase/functions/_shared/fitarco/index.ts'
