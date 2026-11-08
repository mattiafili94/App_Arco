-- Registro delle eliminazioni (Fase 3.1, sincronizzazione offline).
--
-- I telefoni scaricano solo le righe cambiate dall'ultima volta (colonna `aggiornato_il`), ma una riga
-- eliminata non c'è più da scaricare: ogni eliminazione su queste tabelle lascia qui una traccia, così il
-- telefono sa cosa togliere dalla sua copia. Le tracce si tengono 60 giorni; un telefono che non si
-- sincronizza da più di 45 giorni riparte da zero.

create table public.eliminazioni (
  id bigint generated always as identity primary key,
  tabella text not null,
  -- Valori della chiave primaria della riga eliminata, per nome di colonna: {"codice": "R2611039"}.
  chiave jsonb not null,
  eliminato_il timestamptz not null default now()
);

create index eliminazioni_data on public.eliminazioni (eliminato_il);

alter table public.eliminazioni enable row level security;
revoke all on table public.eliminazioni from anon, authenticated;
grant select on table public.eliminazioni to authenticated;
grant select, insert, update, delete on table public.eliminazioni to service_role;

create policy "I membri vedono le eliminazioni" on public.eliminazioni
for select to authenticated using (public.e_membro());

-- Il trigger registra la chiave primaria della riga eliminata. "security definer": chi elimina (anche
-- l'amministratore dall'app) non ha il permesso di scrivere nel registro, il trigger sì.
create function public.registra_eliminazione() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.eliminazioni (tabella, chiave)
  select tg_table_name, jsonb_object_agg(k, to_jsonb(old) -> k)
  from unnest(tg_argv) as k;
  return old;
end;
$$;

revoke all on function public.registra_eliminazione() from public, anon, authenticated;

-- Un trigger per tabella, con le colonne della chiave primaria come argomenti.
create trigger atleti_eliminazione after delete on public.atleti
for each row execute function public.registra_eliminazione('id');
create trigger gare_eliminazione after delete on public.gare
for each row execute function public.registra_eliminazione('codice');
create trigger inviti_eliminazione after delete on public.inviti
for each row execute function public.registra_eliminazione('gara_codice');
create trigger partecipazioni_eliminazione after delete on public.partecipazioni
for each row execute function public.registra_eliminazione('atleta_id', 'gara_codice', 'divisione');
create trigger classifiche_eliminazione after delete on public.classifiche
for each row execute function public.registra_eliminazione('gara_codice', 'categoria', 'ordine');
create trigger ranking_eliminazione after delete on public.ranking
for each row execute function public.registra_eliminazione('atleta_id', 'tipo', 'divisione');

-- La potatura delle classifiche (chiamata a ogni giro del server) toglie anche le tracce vecchie.
create or replace function public.pota_classifiche(p_prima_del date) returns integer
language plpgsql
set search_path = ''
as $$
declare
  tolte integer;
begin
  delete from public.eliminazioni where eliminato_il < now() - interval '60 days';

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
