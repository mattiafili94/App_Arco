-- Notifiche push "nuovo invito" (Fase 3.4, piano in CLAUDE.md).
--
-- Quando il server trova l'invito NUOVO di una gara futura, mette in coda una notifica (`notifiche`) e
-- la manda a tutti i telefoni registrati (`iscrizioni_push`). Un telefono si registra dall'interruttore
-- nelle Impostazioni.
--
-- Regole:
-- - le due tabelle le usa solo il server (nessun permesso diretto a chi usa l'app);
-- - un membro registra o toglie SOLO il proprio telefono, con le due funzioni qui sotto (il telefono
--   è identificato dal suo indirizzo `endpoint`, che è anche la chiave: se su un telefono accede un'altra
--   persona, la registrazione passa a lei);
-- - una gara ha al massimo una notifica "nuovo invito": niente doppioni.

create table public.iscrizioni_push (
  -- Indirizzo del servizio push del telefono (Android, Apple…): unico per telefono e browser.
  endpoint text primary key check (endpoint ~ '^https://'),
  atleta_id uuid not null references public.atleti (id) on delete cascade,
  -- Chiavi di cifratura del telefono (Web Push).
  p256dh text not null,
  auth text not null,
  creato_il timestamptz not null default now()
);

create index iscrizioni_push_atleta on public.iscrizioni_push (atleta_id);

create table public.notifiche (
  id bigint generated always as identity primary key,
  gara_codice text not null unique references public.gare (codice) on delete cascade,
  titolo text not null,
  testo text not null,
  creata_il timestamptz not null default now(),
  -- Vuota finché la notifica non è stata mandata.
  inviata_il timestamptz
);

create index notifiche_da_inviare on public.notifiche (id) where inviata_il is null;

alter table public.iscrizioni_push enable row level security;
alter table public.notifiche enable row level security;

revoke all on table public.iscrizioni_push, public.notifiche from anon, authenticated;
grant select, insert, update, delete on table public.iscrizioni_push, public.notifiche to service_role;
-- Nessuna regola (policy): i membri non leggono né scrivono le tabelle, solo il server.

-- Registra (o aggiorna) il telefono di chi è collegato.
create function public.registra_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atleta uuid;
begin
  select id into v_atleta from public.atleti where utente_id = auth.uid() and attivo;
  if v_atleta is null then
    raise exception 'Accesso non valido' using errcode = '42501';
  end if;
  insert into public.iscrizioni_push (endpoint, atleta_id, p256dh, auth)
  values (p_endpoint, v_atleta, p_p256dh, p_auth)
  on conflict (endpoint) do update
  set atleta_id = excluded.atleta_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

-- Toglie il telefono, ma solo se è registrato a chi è collegato.
create function public.rimuovi_push(p_endpoint text) returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.iscrizioni_push
  where endpoint = p_endpoint
    and atleta_id in (select id from public.atleti where utente_id = auth.uid());
$$;

revoke all on function public.registra_push(text, text, text) from public, anon;
revoke all on function public.rimuovi_push(text) from public, anon;
grant execute on function public.registra_push(text, text, text) to authenticated;
grant execute on function public.rimuovi_push(text) to authenticated;
