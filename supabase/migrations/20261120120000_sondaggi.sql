-- Fase 3.5: il sondaggio "Partecipo / Non partecipo" nella scheda gara (Mattia, 15/11/2026).
--
-- - Quando una gara futura ha l'invito, l'amministratore apre il sondaggio (`apri_sondaggio`) e quando vuole lo
--   chiude (`chiudi_sondaggio`; si può riaprire). Una gara ha al massimo un sondaggio (`sondaggi`).
-- - Ogni atleta risponde solo per sé (`rispondi_sondaggio`): partecipa sì o no, e può cambiare idea finché il
--   sondaggio è aperto e la gara non è passata. Si risponde anche offline: vince la risposta più recente
--   (`modificato_il`, ora del telefono), come per l'allenamento.
-- - TUTTI i membri vedono le risposte di tutti (Mattia: serve a organizzarsi).
-- - Avvisi (`avvisi_sondaggio`, li usa solo il server e li manda al giro del controllo automatico):
--   * sondaggio aperto (la prima volta) → a tutti i telefoni con "Sondaggi delle gare" acceso, tranne chi l'ha aperto;
--   * risposte → agli amministratori con "Risposte ai sondaggi" acceso, raccolte in un avviso solo per gara
--     ("3 nuove risposte"); le risposte degli amministratori non si contano.

-- Il sondaggio -------------------------------------------------------------------------------------------------
create table public.sondaggi (
  gara_codice text primary key references public.gare (codice) on delete cascade,
  aperto boolean not null default true,
  aperto_da uuid references public.atleti (id) on delete set null,
  aperto_il timestamptz not null default now(),
  chiuso_il timestamptz,
  aggiornato_il timestamptz not null default now()
);

comment on table public.sondaggi is 'Sondaggio "Partecipo / Non partecipo" di una gara, aperto dall''amministratore.';

create trigger sondaggi_data_modifica
before update on public.sondaggi
for each row execute function public.aggiorna_data_modifica();

create trigger sondaggi_eliminazione after delete on public.sondaggi
for each row execute function public.registra_eliminazione('gara_codice');

alter table public.sondaggi enable row level security;
revoke all on table public.sondaggi from anon, authenticated;
grant select on table public.sondaggi to authenticated;
grant select, insert, update, delete on table public.sondaggi to service_role;

create policy "I membri vedono i sondaggi" on public.sondaggi
for select to authenticated using (public.e_membro());

-- Le risposte ----------------------------------------------------------------------------------------------------
create table public.risposte_sondaggio (
  gara_codice text not null references public.sondaggi (gara_codice) on delete cascade,
  atleta_id uuid not null references public.atleti (id) on delete cascade,
  partecipa boolean not null,
  -- Ora del telefono quando l'atleta ha risposto: vince la più recente.
  modificato_il timestamptz not null,
  aggiornato_il timestamptz not null default now(),
  primary key (gara_codice, atleta_id)
);

comment on table public.risposte_sondaggio is 'Chi partecipa (o no) a una gara: le risposte ai sondaggi.';

create index risposte_sondaggio_atleta on public.risposte_sondaggio (atleta_id);

create trigger risposte_sondaggio_data_modifica
before update on public.risposte_sondaggio
for each row execute function public.aggiorna_data_modifica();

create trigger risposte_sondaggio_eliminazione after delete on public.risposte_sondaggio
for each row execute function public.registra_eliminazione('gara_codice', 'atleta_id');

alter table public.risposte_sondaggio enable row level security;
revoke all on table public.risposte_sondaggio from anon, authenticated;
grant select on table public.risposte_sondaggio to authenticated;
grant select, insert, update, delete on table public.risposte_sondaggio to service_role;

create policy "I membri vedono le risposte ai sondaggi" on public.risposte_sondaggio
for select to authenticated using (public.e_membro());

-- La coda degli avvisi ---------------------------------------------------------------------------------------------
create table public.avvisi_sondaggio (
  id bigint generated always as identity primary key,
  gara_codice text not null references public.gare (codice) on delete cascade,
  -- "aperto": il sondaggio è stato aperto (a tutti); "risposte": sono arrivate risposte (agli amministratori).
  tipo text not null check (tipo in ('aperto', 'risposte')),
  -- Chi non lo riceve: chi ha aperto il sondaggio.
  escluso_id uuid references public.atleti (id) on delete set null,
  -- Quante risposte nuove raccoglie (solo "risposte").
  risposte integer not null default 0,
  creato_il timestamptz not null default now(),
  -- Vuota finché l'avviso non è stato mandato.
  inviato_il timestamptz
);

-- Un solo avviso in attesa per gara e tipo: le risposte di fila si sommano.
create unique index avvisi_sondaggio_in_attesa
  on public.avvisi_sondaggio (gara_codice, tipo)
  where inviato_il is null;

alter table public.avvisi_sondaggio enable row level security;
revoke all on table public.avvisi_sondaggio from anon, authenticated;
grant select, insert, update, delete on table public.avvisi_sondaggio to service_role;

-- Quali avvisi riceve ogni telefono (come inviti e programma, Fase 7.3): di base tutti accesi ------------------
alter table public.iscrizioni_push
  add column sondaggi boolean not null default true,
  add column risposte boolean not null default true;

-- La versione con tutti gli avvisi. Quella vecchia (inviti e programma) resta per le app non ancora aggiornate:
-- non tocca sondaggi e risposte.
create function public.imposta_avvisi(
  p_endpoint text,
  p_inviti boolean,
  p_programma boolean,
  p_sondaggi boolean,
  p_risposte boolean
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.iscrizioni_push
  set inviti = p_inviti, programma = p_programma, sondaggi = p_sondaggi, risposte = p_risposte
  where endpoint = p_endpoint
    and atleta_id in (select id from public.atleti where utente_id = auth.uid() and attivo);
  return found;
end;
$$;

revoke all on function public.imposta_avvisi(text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.imposta_avvisi(text, boolean, boolean, boolean, boolean) to authenticated;

-- Il giorno di oggi in Italia (le gare hanno date italiane).
create function public.oggi_italia() returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

revoke all on function public.oggi_italia() from public, anon;
grant execute on function public.oggi_italia() to authenticated, service_role;

-- Aprire e chiudere ----------------------------------------------------------------------------------------------
-- Solo l'amministratore, solo per una gara futura (o di oggi), non annullata, con l'invito.
-- Aprirlo la prima volta manda l'avviso a tutti; riaprirlo dopo averlo chiuso no.
create function public.apri_sondaggio(p_gara text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := public.mio_atleta_id();
begin
  if not public.e_amministratore() then
    raise exception 'Solo l''amministratore apre i sondaggi' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.gare
    where codice = p_gara and ha_invito and stato <> 'annullata' and al >= public.oggi_italia()
  ) then
    raise exception 'Il sondaggio si apre solo per una gara futura con l''invito' using errcode = '22023';
  end if;

  if exists (select 1 from public.sondaggi where gara_codice = p_gara) then
    update public.sondaggi set aperto = true, chiuso_il = null
    where gara_codice = p_gara and not aperto;
    return;
  end if;

  insert into public.sondaggi (gara_codice, aperto_da) values (p_gara, io);
  insert into public.avvisi_sondaggio (gara_codice, tipo, escluso_id) values (p_gara, 'aperto', io);
end;
$$;

create function public.chiudi_sondaggio(p_gara text) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_amministratore() then
    raise exception 'Solo l''amministratore chiude i sondaggi' using errcode = '42501';
  end if;
  update public.sondaggi set aperto = false, chiuso_il = now()
  where gara_codice = p_gara and aperto;
end;
$$;

revoke all on function public.apri_sondaggio(text) from public, anon;
revoke all on function public.chiudi_sondaggio(text) from public, anon;
grant execute on function public.apri_sondaggio(text) to authenticated;
grant execute on function public.chiudi_sondaggio(text) to authenticated;

-- Rispondere -------------------------------------------------------------------------------------------------------
-- Ognuno solo per sé. Se il sondaggio è chiuso (o la gara è passata) la risposta non si salva. Restituisce sempre
-- la risposta che vale adesso (vuota se non ce n'è): il telefono la tiene com'è.
create function public.rispondi_sondaggio(
  p_gara text,
  p_partecipa boolean,
  p_modificato_il timestamptz
) returns public.risposte_sondaggio
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := public.mio_atleta_id();
  r public.risposte_sondaggio;
begin
  if io is null then
    raise exception 'Accesso non valido' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.sondaggi s
    join public.gare g on g.codice = s.gara_codice
    where s.gara_codice = p_gara and s.aperto and g.al >= public.oggi_italia()
  ) then
    insert into public.risposte_sondaggio (gara_codice, atleta_id, partecipa, modificato_il)
    values (p_gara, io, p_partecipa, p_modificato_il)
    on conflict (gara_codice, atleta_id) do update
    set partecipa = excluded.partecipa, modificato_il = excluded.modificato_il
    where public.risposte_sondaggio.modificato_il < excluded.modificato_il;
  end if;

  select * into r from public.risposte_sondaggio where gara_codice = p_gara and atleta_id = io;
  return r;
end;
$$;

revoke all on function public.rispondi_sondaggio(text, boolean, timestamptz) from public, anon;
grant execute on function public.rispondi_sondaggio(text, boolean, timestamptz) to authenticated;

-- Ogni risposta nuova (o cambiata) di un atleta si conta nell'avviso agli amministratori.
create function public.accoda_avviso_risposta() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.partecipa is not distinct from old.partecipa then
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

revoke all on function public.accoda_avviso_risposta() from public, anon, authenticated;

create trigger risposte_sondaggio_avviso
after insert or update of partecipa on public.risposte_sondaggio
for each row execute function public.accoda_avviso_risposta();
