// Le regole dell'accesso stanno in supabase/functions/_shared, perché le usa anche la funzione
// del server (Deno). L'app le prende da qui.
export * from '../../../supabase/functions/_shared/accesso.ts'
