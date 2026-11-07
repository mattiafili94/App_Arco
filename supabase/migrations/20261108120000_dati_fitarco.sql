-- Dati letti dal sito Fitarco (Fase 2.4, piano in CLAUDE.md).
--
-- Regole:
-- - ogni membro attivo LEGGE gare, inviti, storico, classifiche e ranking (dati condivisi);
-- - li SCRIVE solo il server (funzione aggiorna-fitarco con la chiave di servizio): nessun permesso di
--   scrittura a chi usa l'app, nemmeno all'amministratore;
-- - il diario delle letture lo legge solo l'amministratore; la lista di lavoro solo il server;
-- - ogni riga ha `aggiornato_il`: i telefoni scaricano solo le novità.

-- --- Atleti: dati presi dalla scheda Fitarco (li scrive solo il server) ---------------------------
alter table public.atleti
  add column classe text check (classe ~ '^[A-Z]{2,3}$'),
  add column genere text check (genere in ('M', 'F')),
  add column classi_ranking jsonb not null default '{}'::jsonb,
  add column scheda_letta_il timestamptz;

comment on column public.atleti.classe is 'Classe anagrafica Fitarco (es. SM = Seniores Maschile).';
comment on column public.atleti.classi_ranking is 'Classe di ranking per tipo: {"Indoor": "SM", "3D": "SM", …}.';

-- --- Gare -------------------------------------------------------------------------------------------
create table public.gare (
  codice text primary key check (codice ~ '^[A-Z][0-9]{7}$'),
  dal date not null,
  al date not null check (al >= dal),
  calendario text not null,
  regione text,
  localita text not null,
  -- Come la scrive Fitarco: "18 m", "25+18 m", "Doppio 70/60mt Round - …".
  tipologia text not null,
  dettaglio text,
  -- Le gare trovate solo nello storico di un atleta non hanno (ancora) la società organizzatrice.
  societa_codice text check (societa_codice ~ '^[0-9]{5}$'),
  societa_nome text,
  stato text not null check (stato in (
    'omologata', 'da-omologare', 'non-trasferita', 'in-elaborazione', 'annullata', 'invito',
    'in-calendario', 'sconosciuto'
  )),
  -- Presente nel calendario dell'Umbria (le altre arrivano dagli storici degli atleti).
  in_calendario_umbria boolean not null default false,
  ha_invito boolean not null default false,
  url_risultati text check (url_risultati ~ '^https://'),
  -- Impronta del PDF letto: se non cambia, non si riscrive la classifica.
  impronta_risultati text,
  risultati_aggiornati_il timestamptz,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

comment on table public.gare is 'Gare dal calendario Fitarco dell''Umbria e dagli storici degli atleti.';

create index gare_dal on public.gare (dal);
create index gare_aggiornato_il on public.gare (aggiornato_il);

-- --- Inviti -----------------------------------------------------------------------------------------
create table public.inviti (
  gara_codice text primary key references public.gare (codice) on delete cascade,
  -- Testo libero dell'invito (programma, iscrizioni, contributo…), con gli a capo.
  testo text not null,
  luogo text,
  riferimento text,
  email text,
  web text,
  verificato boolean not null default false,
  trovato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create index inviti_aggiornato_il on public.inviti (aggiornato_il);

-- --- Storico degli atleti (dalla scheda Fitarco) ----------------------------------------------------
create table public.partecipazioni (
  atleta_id uuid not null references public.atleti (id) on delete cascade,
  gara_codice text not null references public.gare (codice) on delete cascade,
  divisione text not null check (divisione ~ '^[A-Z]{2}$'),
  classe text not null,
  rank text not null,
  posizione integer check (posizione > 0),
  totale integer check (totale >= 0),
  aggiornato_il timestamptz not null default now(),
  primary key (atleta_id, gara_codice, divisione)
);

create index partecipazioni_gara on public.partecipazioni (gara_codice);
create index partecipazioni_aggiornato_il on public.partecipazioni (aggiornato_il);

-- --- Classifiche complete (dai PDF dei risultati) ---------------------------------------------------
create table public.classifiche (
  gara_codice text not null references public.gare (codice) on delete cascade,
  -- "Arco Ricurvo - Senior Maschile".
  categoria text not null,
  -- Ordine della riga nella categoria, come nel PDF.
  ordine integer not null check (ordine > 0),
  divisione text not null check (divisione ~ '^[A-Z]{2}$'),
  classe text not null,
  posizione integer check (posizione > 0),
  esito text not null,
  turno text,
  nome_completo text not null,
  cognome text not null,
  nome text not null,
  classe_atleta text,
  categoria_eta text,
  societa_codice text not null check (societa_codice ~ '^[0-9]{5}$'),
  societa_nome text not null,
  -- [{ "colonna": "18m-1", "punti": 280, "posizione": 1 }, …]
  parziali jsonb not null default '[]'::jsonb,
  -- Gare composte: [{ "parziali": […], "totale": 272 }, { … }]
  prove jsonb not null default '[]'::jsonb,
  totale integer not null check (totale >= 0),
  conteggi integer[] not null check (cardinality(conteggi) = 2),
  colonne_conteggi text[] not null check (cardinality(colonne_conteggi) = 2),
  -- L'atleta della compagnia, se è un Eugubino riconosciuto.
  atleta_id uuid references public.atleti (id) on delete set null,
  provvisoria boolean not null,
  aggiornato_il timestamptz not null default now(),
  primary key (gara_codice, categoria, ordine)
);

create index classifiche_atleta on public.classifiche (atleta_id);
create index classifiche_aggiornato_il on public.classifiche (aggiornato_il);

-- --- Ranking nazionale dei nostri atleti -------------------------------------------------------------
create table public.ranking (
  atleta_id uuid not null references public.atleti (id) on delete cascade,
  -- I indoor, T targa (outdoor), C campagna, 3 3D.
  tipo text not null check (tipo in ('I', 'T', 'C', '3')),
  divisione text not null check (divisione ~ '^[A-Z]{2}$'),
  classe text not null check (classe in ('M', 'S', 'J', 'A', 'R')),
  genere text not null check (genere in ('M', 'F')),
  categoria text not null,
  posizione integer not null check (posizione > 0),
  punti integer not null check (punti >= 0),
  -- Le gare che contano: [{ "codice": …, "punti": …, "localita": …, "dal": …, "al": … }]
  gare jsonb not null default '[]'::jsonb,
  aggiornato_il timestamptz not null default now(),
  primary key (atleta_id, tipo, divisione)
);

create index ranking_aggiornato_il on public.ranking (aggiornato_il);

-- --- Diario delle letture (sentinella) --------------------------------------------------------------
create table public.letture (
  id bigint generated always as identity primary key,
  -- 'calendario', 'scheda-gara', 'invito', 'scheda-atleta', 'risultati', 'ranking'
  tipo text not null,
  chiave text not null,
  -- ok: dati salvati; invariato: niente di nuovo; errore: lettura fallita, niente salvato;
  -- anomalia: dati strani, la sentinella avvisa.
  esito text not null check (esito in ('ok', 'invariato', 'errore', 'anomalia')),
  messaggio text,
  richieste integer not null default 0 check (richieste >= 0),
  creato_il timestamptz not null default now()
);

create index letture_creato_il on public.letture (creato_il desc);
-- "Quando è stata letta l'ultima volta questa cosa?" (lo chiede la pianificazione delle letture).
create index letture_ultima on public.letture (tipo, chiave, creato_il desc);

-- --- Lista di lavoro del server ---------------------------------------------------------------------
create table public.coda_letture (
  tipo text not null,
  chiave text not null,
  priorita integer not null default 0,
  da_fare_dal timestamptz not null default now(),
  tentativi integer not null default 0 check (tentativi >= 0),
  ultimo_errore text,
  creato_il timestamptz not null default now(),
  primary key (tipo, chiave)
);

create index coda_letture_prossime on public.coda_letture (da_fare_dal, priorita desc);

-- --- Date di modifica automatiche --------------------------------------------------------------------
create trigger gare_data_modifica before update on public.gare
for each row execute function public.aggiorna_data_modifica();
create trigger inviti_data_modifica before update on public.inviti
for each row execute function public.aggiorna_data_modifica();
create trigger partecipazioni_data_modifica before update on public.partecipazioni
for each row execute function public.aggiorna_data_modifica();
create trigger classifiche_data_modifica before update on public.classifiche
for each row execute function public.aggiorna_data_modifica();
create trigger ranking_data_modifica before update on public.ranking
for each row execute function public.aggiorna_data_modifica();

-- --- Regole di accesso -------------------------------------------------------------------------------
alter table public.gare enable row level security;
alter table public.inviti enable row level security;
alter table public.partecipazioni enable row level security;
alter table public.classifiche enable row level security;
alter table public.ranking enable row level security;
alter table public.letture enable row level security;
alter table public.coda_letture enable row level security;

-- Permessi espliciti (il progetto non espone in automatico le tabelle nuove).
revoke all on table public.gare, public.inviti, public.partecipazioni, public.classifiche,
  public.ranking, public.letture, public.coda_letture from anon, authenticated;
grant select on table public.gare, public.inviti, public.partecipazioni, public.classifiche,
  public.ranking, public.letture to authenticated;
grant select, insert, update, delete on table public.gare, public.inviti, public.partecipazioni,
  public.classifiche, public.ranking, public.letture, public.coda_letture to service_role;

create policy "I membri vedono le gare" on public.gare
for select to authenticated using (public.e_membro());
create policy "I membri vedono gli inviti" on public.inviti
for select to authenticated using (public.e_membro());
create policy "I membri vedono gli storici" on public.partecipazioni
for select to authenticated using (public.e_membro());
create policy "I membri vedono le classifiche" on public.classifiche
for select to authenticated using (public.e_membro());
create policy "I membri vedono il ranking" on public.ranking
for select to authenticated using (public.e_membro());
create policy "L'amministratore vede il diario delle letture" on public.letture
for select to authenticated using (public.e_amministratore());
-- coda_letture: nessuna regola per chi usa l'app (la usa solo il server).

-- --- Salvataggi "tutto insieme" (li chiama solo il server) -------------------------------------------
-- Ognuno sostituisce un blocco di dati in una sola operazione: o tutto o niente.

-- Classifica completa di una gara (dal PDF). `righe` = array di oggetti con le colonne di `classifiche`.
create function public.salva_classifica(
  p_gara text, p_righe jsonb, p_impronta text, p_provvisoria boolean
) returns integer
language plpgsql
set search_path = ''
as $$
declare
  salvate integer;
begin
  if not exists (select 1 from public.gare where codice = p_gara) then
    raise exception 'Gara % sconosciuta', p_gara;
  end if;
  delete from public.classifiche where gara_codice = p_gara;
  insert into public.classifiche (
    gara_codice, categoria, ordine, divisione, classe, posizione, esito, turno, nome_completo,
    cognome, nome, classe_atleta, categoria_eta, societa_codice, societa_nome, parziali, prove,
    totale, conteggi, colonne_conteggi, atleta_id, provvisoria
  )
  select p_gara, r.categoria, r.ordine, r.divisione, r.classe, r.posizione, r.esito, r.turno,
    r.nome_completo, r.cognome, r.nome, r.classe_atleta, r.categoria_eta, r.societa_codice,
    r.societa_nome, coalesce(r.parziali, '[]'::jsonb), coalesce(r.prove, '[]'::jsonb), r.totale,
    r.conteggi, r.colonne_conteggi, r.atleta_id, p_provvisoria
  from jsonb_to_recordset(p_righe) as r(
    categoria text, ordine integer, divisione text, classe text, posizione integer, esito text,
    turno text, nome_completo text, cognome text, nome text, classe_atleta text,
    categoria_eta text, societa_codice text, societa_nome text, parziali jsonb, prove jsonb,
    totale integer, conteggi integer[], colonne_conteggi text[], atleta_id uuid
  );
  get diagnostics salvate = row_count;
  update public.gare
  set impronta_risultati = p_impronta, risultati_aggiornati_il = now()
  where codice = p_gara;
  return salvate;
end;
$$;

-- Storico completo di un atleta (dalla scheda). Le gare devono già esistere in `gare`.
create function public.salva_storico(p_atleta uuid, p_righe jsonb) returns integer
language plpgsql
set search_path = ''
as $$
declare
  salvate integer;
begin
  delete from public.partecipazioni where atleta_id = p_atleta;
  insert into public.partecipazioni (atleta_id, gara_codice, divisione, classe, rank, posizione, totale)
  select p_atleta, r.gara_codice, r.divisione, r.classe, r.rank, r.posizione, r.totale
  from jsonb_to_recordset(p_righe) as r(
    gara_codice text, divisione text, classe text, rank text, posizione integer, totale integer
  );
  get diagnostics salvate = row_count;
  return salvate;
end;
$$;

-- Ranking di una combinazione (tipo × divisione): sostituisce le righe degli atleti indicati
-- (`p_atleti`: tutti quelli che rientrano nella combinazione, anche se non sono in classifica).
create function public.salva_ranking(
  p_tipo text, p_divisione text, p_atleti uuid[], p_righe jsonb
) returns integer
language plpgsql
set search_path = ''
as $$
declare
  salvate integer;
begin
  delete from public.ranking
  where tipo = p_tipo and divisione = p_divisione and atleta_id = any (p_atleti);
  insert into public.ranking (atleta_id, tipo, divisione, classe, genere, categoria, posizione, punti, gare)
  select r.atleta_id, p_tipo, p_divisione, r.classe, r.genere, r.categoria, r.posizione, r.punti,
    coalesce(r.gare, '[]'::jsonb)
  from jsonb_to_recordset(p_righe) as r(
    atleta_id uuid, classe text, genere text, categoria text, posizione integer, punti integer, gare jsonb
  );
  get diagnostics salvate = row_count;
  return salvate;
end;
$$;

revoke all on function public.salva_classifica(text, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.salva_storico(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.salva_ranking(text, text, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.salva_classifica(text, jsonb, text, boolean) to service_role;
grant execute on function public.salva_storico(uuid, jsonb) to service_role;
grant execute on function public.salva_ranking(text, text, uuid[], jsonb) to service_role;
