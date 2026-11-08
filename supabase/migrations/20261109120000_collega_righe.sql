-- Atleti che entrano nell'app dopo (9/11/2026):
-- 1. la potatura delle gare vecchie tiene anche le righe della società 11003 non ancora collegate
--    (Eugubini non ancora nell'app): quando entreranno avranno i dettagli delle loro gare;
-- 2. collega_righe collega a un atleta le sue righe nelle classifiche già salvate (la chiama il server
--    dopo aver letto la scheda dell'atleta). Le gare toccate cambiano `risultati_aggiornati_il`, così i
--    telefoni riscaricano la loro classifica.

create or replace function public.pota_classifiche(p_prima_del date) returns integer
language plpgsql
set search_path = ''
as $$
declare
  tolte integer;
begin
  with potate as (
    delete from public.classifiche c
    using public.gare g
    where g.codice = c.gara_codice
      and g.dal < p_prima_del
      and c.atleta_id is null
      and c.societa_codice <> '11003'
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

-- `p_righe`: [{ "gara_codice": …, "categoria": …, "ordine": …, "atleta_id": … }]
create function public.collega_righe(p_righe jsonb) returns integer
language plpgsql
set search_path = ''
as $$
declare
  collegate integer;
begin
  with dati as (
    select * from jsonb_to_recordset(p_righe)
      as r(gara_codice text, categoria text, ordine integer, atleta_id uuid)
  ), aggiornate as (
    update public.classifiche c
    set atleta_id = d.atleta_id
    from dati d
    where c.gara_codice = d.gara_codice and c.categoria = d.categoria and c.ordine = d.ordine
    returning c.gara_codice
  ), gare_toccate as (
    update public.gare g
    set risultati_aggiornati_il = now()
    where g.codice in (select distinct gara_codice from aggiornate)
    returning 1
  )
  select count(*) into collegate from aggiornate;
  return collegate;
end;
$$;

revoke all on function public.collega_righe(jsonb) from public, anon, authenticated;
grant execute on function public.collega_righe(jsonb) to service_role;
