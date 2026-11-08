-- Classifiche complete solo per l'anno in corso e i due precedenti (scelta di Mattia, 8/11/2026).
-- Per le gare più vecchie restano solo le righe dei nostri atleti (atleta_id non nullo), con parziali e
-- prove per record e statistiche. La chiama il server a ogni giro: di solito non toglie niente, a inizio
-- anno riduce la stagione uscita dalla finestra. Le gare toccate cambiano `risultati_aggiornati_il`,
-- così i telefoni riscaricano la loro classifica.

create function public.pota_classifiche(p_prima_del date) returns integer
language plpgsql
set search_path = ''
as $$
declare
  tolte integer;
begin
  with potate as (
    delete from public.classifiche c
    using public.gare g
    where g.codice = c.gara_codice and g.dal < p_prima_del and c.atleta_id is null
    returning c.gara_codice
  ), gare_toccate as (
    update public.gare g
    set risultati_aggiornati_il = now()
    where g.codice in (select distinct gara_codice from potate)
    returning 1
  )
  select count(*) into tolte from potate;
  return tolte;
end;
$$;

revoke all on function public.pota_classifiche(date) from public, anon, authenticated;
grant execute on function public.pota_classifiche(date) to service_role;
