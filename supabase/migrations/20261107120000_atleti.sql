-- Atleti della compagnia e loro accesso all'app.
--
-- Regole (CLAUDE.md, "Utenti e accesso"):
-- - chi non ha fatto l'accesso non vede niente;
-- - ogni membro attivo vede l'elenco degli atleti (dati condivisi della compagnia);
-- - solo l'amministratore aggiunge, modifica ed elimina atleti;
-- - gli accessi (utenti tecnici di Supabase Auth) li crea e revoca solo la funzione del server
--   `crea-accesso`, che usa la chiave di servizio e quindi non passa da queste regole.

create type public.ruolo as enum ('atleta', 'amministratore');

create table public.atleti (
  id uuid primary key default gen_random_uuid(),
  matricola text not null unique check (matricola ~ '^[0-9]{1,8}$'),
  nome text not null check (length(btrim(nome)) > 0),
  cognome text not null check (length(btrim(cognome)) > 0),
  ruolo public.ruolo not null default 'atleta',
  attivo boolean not null default true,
  -- Accesso attuale dell'atleta: si azzera da solo se l'accesso viene eliminato (revoca).
  utente_id uuid unique references auth.users (id) on delete set null,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

comment on table public.atleti is 'Atleti della A.S.D. Compagnia Arcieri Eugubini che usano l''app.';

create function public.aggiorna_data_modifica() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;

create trigger atleti_data_modifica
before update on public.atleti
for each row execute function public.aggiorna_data_modifica();

-- Chi è l'utente collegato? Funzioni usate dalle regole di accesso.
-- "security definer": leggono la tabella senza passare dalle regole (eviterebbe un giro infinito).

create function public.e_membro() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.atleti
    where utente_id = auth.uid() and attivo
  );
$$;

create function public.e_amministratore() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.atleti
    where utente_id = auth.uid() and attivo and ruolo = 'amministratore'
  );
$$;

revoke all on function public.e_membro() from public, anon;
revoke all on function public.e_amministratore() from public, anon;
grant execute on function public.e_membro() to authenticated;
grant execute on function public.e_amministratore() to authenticated;

-- Regole di accesso alla tabella.
alter table public.atleti enable row level security;

revoke all on table public.atleti from anon;

create policy "I membri vedono gli atleti"
on public.atleti for select
to authenticated
using (public.e_membro());

create policy "L'amministratore aggiunge atleti"
on public.atleti for insert
to authenticated
with check (public.e_amministratore());

create policy "L'amministratore modifica gli atleti"
on public.atleti for update
to authenticated
using (public.e_amministratore())
with check (public.e_amministratore());

create policy "L'amministratore elimina gli atleti"
on public.atleti for delete
to authenticated
using (public.e_amministratore());

-- Il collegamento con l'accesso (utente_id) lo gestisce solo il server: nemmeno l'amministratore
-- può cambiarlo dall'app (eviterebbe di "prendere" l'accesso di un altro).
-- In Postgres togliere un permesso su una sola colonna non basta se resta quello sulla tabella:
-- si toglie tutto e si ridanno solo le colonne ammesse.
revoke insert, update on table public.atleti from authenticated;
grant insert (matricola, nome, cognome, ruolo, attivo) on table public.atleti to authenticated;
grant update (matricola, nome, cognome, ruolo, attivo) on table public.atleti to authenticated;
