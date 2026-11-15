-- Fase 3.5c: i turni nel sondaggio (Mattia, 15/11/2026). Una gara si tira a turni (sabato mattina, sabato
-- pomeriggio, domenica mattina…): chi apre il sondaggio sceglie quali turni ci sono e chi partecipa ne sceglie uno.
--
-- - `sondaggi.turni`: i turni della gara, come 'AAAA-MM-GG:mattina' o 'AAAA-MM-GG:pomeriggio' (un giorno della gara).
--   Vuoto = sondaggio senza turni (come prima). Si scelgono quando si apre il sondaggio la prima volta.
-- - `risposte_sondaggio.turno`: il turno scelto da chi partecipa (uno solo, per ora). Vuoto per chi non partecipa,
--   per i sondaggi senza turni e per chi risponde da un'app vecchia ("turno non indicato").
-- - Le versioni vecchie di `apri_sondaggio` e `rispondi_sondaggio` restano per le app non aggiornate.

alter table public.sondaggi add column turni text[] not null default '{}';
alter table public.risposte_sondaggio add column turno text;

comment on column public.sondaggi.turni is 'Turni della gara (''AAAA-MM-GG:mattina|pomeriggio''); vuoto = senza turni.';
comment on column public.risposte_sondaggio.turno is 'Turno scelto da chi partecipa (uno dei turni del sondaggio).';

-- Aprire con i turni ---------------------------------------------------------------------------------------------
-- Come prima; in più i turni, che devono essere giorni della gara, mattina o pomeriggio, senza doppioni.
-- Riaprire un sondaggio chiuso non cambia i suoi turni.
create function public.apri_sondaggio(p_gara text, p_turni text[]) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := public.mio_atleta_id();
  g public.gare;
  t text;
  turni text[] := coalesce(p_turni, '{}');
begin
  if not public.e_amministratore() then
    raise exception 'Solo l''amministratore apre i sondaggi' using errcode = '42501';
  end if;
  select * into g from public.gare
  where codice = p_gara and ha_invito and stato <> 'annullata' and al >= public.oggi_italia();
  if not found then
    raise exception 'Il sondaggio si apre solo per una gara futura con l''invito' using errcode = '22023';
  end if;

  if (select count(distinct x) from unnest(turni) x) <> cardinality(turni) then
    raise exception 'Turni ripetuti' using errcode = '22023';
  end if;
  foreach t in array turni loop
    if t !~ '^\d{4}-\d{2}-\d{2}:(mattina|pomeriggio)$'
       or split_part(t, ':', 1)::date not between g.dal and g.al then
      raise exception 'Turno non valido: %', t using errcode = '22023';
    end if;
  end loop;

  if exists (select 1 from public.sondaggi where gara_codice = p_gara) then
    update public.sondaggi set aperto = true, chiuso_il = null
    where gara_codice = p_gara and not aperto;
    return;
  end if;

  insert into public.sondaggi (gara_codice, aperto_da, turni) values (p_gara, io, turni);
  insert into public.avvisi_sondaggio (gara_codice, tipo, escluso_id) values (p_gara, 'aperto', io);
end;
$$;

revoke all on function public.apri_sondaggio(text, text[]) from public, anon;
grant execute on function public.apri_sondaggio(text, text[]) to authenticated;

-- La versione vecchia: sondaggio senza turni.
create or replace function public.apri_sondaggio(p_gara text) returns void
language sql
security definer
set search_path = ''
as $$
  select public.apri_sondaggio(p_gara, '{}'::text[]);
$$;

-- Rispondere con il turno ------------------------------------------------------------------------------------------
-- Chi partecipa sceglie uno dei turni del sondaggio (un turno che non c'è viene rifiutato). Chi non partecipa non ha
-- turno. `p_turno` vuoto con "Partecipo" (app vecchia) lascia il turno che c'era.
create function public.rispondi_sondaggio(
  p_gara text,
  p_partecipa boolean,
  p_modificato_il timestamptz,
  p_turno text
) returns public.risposte_sondaggio
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := public.mio_atleta_id();
  s public.sondaggi;
  turno text := case when p_partecipa then p_turno end;
  r public.risposte_sondaggio;
begin
  if io is null then
    raise exception 'Accesso non valido' using errcode = '42501';
  end if;

  select so.* into s from public.sondaggi so
  join public.gare g on g.codice = so.gara_codice
  where so.gara_codice = p_gara and so.aperto and g.al >= public.oggi_italia();

  if found then
    if turno is not null and not (turno = any (s.turni)) then
      raise exception 'Turno non valido: %', turno using errcode = '22023';
    end if;
    insert into public.risposte_sondaggio (gara_codice, atleta_id, partecipa, turno, modificato_il)
    values (p_gara, io, p_partecipa, turno, p_modificato_il)
    on conflict (gara_codice, atleta_id) do update
    set partecipa = excluded.partecipa,
        turno = case
          when not excluded.partecipa then null
          else coalesce(excluded.turno, public.risposte_sondaggio.turno)
        end,
        modificato_il = excluded.modificato_il
    where public.risposte_sondaggio.modificato_il < excluded.modificato_il;
  end if;

  select * into r from public.risposte_sondaggio where gara_codice = p_gara and atleta_id = io;
  return r;
end;
$$;

revoke all on function public.rispondi_sondaggio(text, boolean, timestamptz, text) from public, anon;
grant execute on function public.rispondi_sondaggio(text, boolean, timestamptz, text) to authenticated;

-- La versione vecchia: senza turno.
create or replace function public.rispondi_sondaggio(
  p_gara text,
  p_partecipa boolean,
  p_modificato_il timestamptz
) returns public.risposte_sondaggio
language sql
security definer
set search_path = ''
as $$
  select public.rispondi_sondaggio(p_gara, p_partecipa, p_modificato_il, null::text);
$$;

-- Anche il cambio di turno si conta nell'avviso agli amministratori ---------------------------------------------------
create or replace function public.accoda_avviso_risposta() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.partecipa is not distinct from old.partecipa
     and new.turno is not distinct from old.turno then
    return new;
  end if;
  if exists (select 1 from public.atleti where id = new.atleta_id and ruolo = 'amministratore') then
    return new;
  end if;
  insert into public.avvisi_sondaggio (gara_codice, tipo, risposte)
  values (new.gara_codice, 'risposte', 1)
  on conflict (gara_codice, tipo) where inviato_il is null
  do update set risposte = public.avvisi_sondaggio.risposte + 1;
  return new;
end;
$$;

drop trigger risposte_sondaggio_avviso on public.risposte_sondaggio;
create trigger risposte_sondaggio_avviso
after insert or update of partecipa, turno on public.risposte_sondaggio
for each row execute function public.accoda_avviso_risposta();
