-- Test dei permessi sui dati Fitarco (pgTAP). Girano su un Supabase di prova (su GitHub a ogni PR).
-- Dati inventati: nessun atleta vero.

begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- Utenti e atleti di prova -------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'amministratore@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b1', 'atleta@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d1', 'sconosciuto@test.invalid');

insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000a1', '900101', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-0000000000b1', '900102', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b1');

-- Dati Fitarco di prova (scritti come farebbe il server).
insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato, in_calendario_umbria) values
  ('R0000001', '2027-01-10', '2027-01-10', 'Interregionale', 'Gubbio (PG)', '18 m', 'omologata', true),
  ('R0000002', '2027-02-10', '2027-02-11', 'Interregionale', 'Terni (TR)', '25+18 m', 'invito', true);
insert into public.inviti (gara_codice, testo) values ('R0000002', 'Iscrizioni dal 1 al 31 gennaio');
insert into public.partecipazioni (atleta_id, gara_codice, divisione, classe, rank, posizione, totale) values
  ('10000000-0000-0000-0000-0000000000b1', 'R0000001', 'OL', 'SM', 'SM', 4, 534);
insert into public.ranking (atleta_id, tipo, divisione, classe, genere, categoria, posizione, punti) values
  ('10000000-0000-0000-0000-0000000000b1', 'I', 'OL', 'S', 'M', 'Arco Ricurvo - Seniores Maschile', 133, 1060);
insert into public.letture (tipo, chiave, esito) values ('calendario', '2027', 'ok');
insert into public.coda_letture (tipo, chiave) values ('scheda-atleta', '900102');

-- Vincoli --------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato)
     values ('X1', '2027-01-01', '2027-01-01', 'I', 'L', '18 m', 'omologata') $$,
  '23514', null, 'il codice gara ha il formato Fitarco'
);
select throws_ok(
  $$ insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato)
     values ('R0000009', '2027-01-01', '2027-01-01', 'I', 'L', '18 m', 'boh') $$,
  '23514', null, 'lo stato della gara è uno di quelli previsti'
);
select throws_ok(
  $$ insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato)
     values ('R0000009', '2027-01-02', '2027-01-01', 'I', 'L', '18 m', 'omologata') $$,
  '23514', null, 'la gara non finisce prima di iniziare'
);

-- Chi non ha fatto l'accesso ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.gare $$, '42501', null, 'senza accesso non si leggono le gare');
select throws_ok($$ select * from public.classifiche $$, '42501', null, 'senza accesso non si leggono le classifiche');
reset role;

-- Utente collegato ma non atleta della compagnia ----------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}';
select is((select count(*)::int from public.gare), 0, 'chi non è atleta non vede le gare');
select is((select count(*)::int from public.ranking), 0, 'chi non è atleta non vede il ranking');

-- Atleta -------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select is((select count(*)::int from public.gare), 2, 'un atleta vede le gare');
select is((select count(*)::int from public.inviti), 1, 'un atleta vede gli inviti');
select is((select count(*)::int from public.partecipazioni), 1, 'un atleta vede gli storici');
select is((select count(*)::int from public.ranking), 1, 'un atleta vede il ranking');
select is((select count(*)::int from public.letture), 0, 'un atleta non vede il diario delle letture');
select throws_ok($$ select * from public.coda_letture $$, '42501', null, 'un atleta non vede la lista di lavoro');
select throws_ok(
  $$ insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato)
     values ('R0000003', '2027-03-01', '2027-03-01', 'I', 'L', '18 m', 'omologata') $$,
  '42501', null, 'un atleta non può aggiungere gare'
);
select throws_ok(
  $$ update public.partecipazioni set totale = 600 $$,
  '42501', null, 'un atleta non può cambiare il proprio storico'
);
select throws_ok(
  $$ select public.salva_classifica('R0000001', '[]'::jsonb, 'x', false) $$,
  '42501', null, 'un atleta non può salvare classifiche'
);

-- Amministratore -------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is((select count(*)::int from public.letture), 1, 'l''amministratore vede il diario delle letture');
select throws_ok(
  $$ delete from public.gare where codice = 'R0000001' $$,
  '42501', null, 'nemmeno l''amministratore modifica i dati Fitarco dall''app'
);
select throws_ok(
  $$ update public.atleti set classe = 'MM' where matricola = '900102' $$,
  '42501', null, 'la classe dell''atleta la scrive solo il server'
);
reset role;

-- Il server (chiave di servizio) ---------------------------------------------------------------------------
set local role service_role;

select is(
  public.salva_classifica('R0000001', $$[
    {"categoria": "Arco Ricurvo - Senior Maschile", "ordine": 1, "divisione": "OL", "classe": "Senior Maschile",
     "posizione": 1, "esito": "1", "turno": "1-1A", "nome_completo": "ROSSI Mario", "cognome": "ROSSI", "nome": "Mario",
     "societa_codice": "11004", "societa_nome": "Arcieri di Prova", "parziali": [{"colonna": "18m-1", "punti": 280, "posizione": 1}],
     "totale": 552, "conteggi": [21, 26], "colonne_conteggi": ["10", "9"]},
    {"categoria": "Arco Ricurvo - Senior Maschile", "ordine": 2, "divisione": "OL", "classe": "Senior Maschile",
     "posizione": 2, "esito": "2", "turno": "1-1B", "nome_completo": "PROVA Bruno", "cognome": "PROVA", "nome": "Bruno",
     "societa_codice": "11003", "societa_nome": "Arcieri Eugubini", "totale": 534, "conteggi": [17, 25],
     "colonne_conteggi": ["10", "9"], "atleta_id": "10000000-0000-0000-0000-0000000000b1"}
  ]$$::jsonb, 'impronta-1', true),
  2, 'il server salva una classifica completa'
);
select is(
  (select impronta_risultati from public.gare where codice = 'R0000001'), 'impronta-1',
  'la gara ricorda l''impronta del PDF letto'
);
select is(
  public.salva_classifica('R0000001', $$[
    {"categoria": "Arco Ricurvo - Senior Maschile", "ordine": 1, "divisione": "OL", "classe": "Senior Maschile",
     "posizione": 1, "esito": "1", "nome_completo": "PROVA Bruno", "cognome": "PROVA", "nome": "Bruno",
     "societa_codice": "11003", "societa_nome": "Arcieri Eugubini", "totale": 560, "conteggi": [20, 25],
     "colonne_conteggi": ["10", "9"], "atleta_id": "10000000-0000-0000-0000-0000000000b1"}
  ]$$::jsonb, 'impronta-2', false),
  1, 'una nuova lettura sostituisce tutta la classifica'
);
select is(
  (select count(*)::int from public.classifiche where gara_codice = 'R0000001' and not provvisoria), 1,
  'la classifica sostituita è quella definitiva'
);
select throws_ok(
  $$ select public.salva_classifica('R0000099', '[]'::jsonb, 'x', false) $$,
  'P0001', 'Gara R0000099 sconosciuta', 'non si salva la classifica di una gara sconosciuta'
);
select lives_ok(
  $$ select public.salva_classifica('R0000002', '[{"categoria": "C", "ordine": 1, "divisione": "OL", "classe": "S",
       "esito": "1", "nome_completo": "X", "cognome": "X", "nome": "", "societa_codice": "11003",
       "societa_nome": "S", "totale": 1, "conteggi": [0, 0], "colonne_conteggi": ["10", "9"]}]'::jsonb, 'i', false) $$,
  'una classifica minima si salva'
);
select is(
  public.salva_storico('10000000-0000-0000-0000-0000000000b1', $$[
    {"gara_codice": "R0000001", "divisione": "OL", "classe": "SM", "rank": "SM", "posizione": 1, "totale": 560},
    {"gara_codice": "R0000002", "divisione": "OL", "classe": "SM", "rank": "SM", "posizione": null, "totale": null}
  ]$$::jsonb),
  2, 'il server sostituisce lo storico di un atleta'
);
select is(
  public.salva_ranking('I', 'OL', array['10000000-0000-0000-0000-0000000000b1'::uuid], '[]'::jsonb), 0,
  'un atleta uscito dalla ranking non ha più la sua riga'
);
select is((select count(*)::int from public.ranking), 0, 'la riga del ranking è stata tolta');
reset role;

-- Eliminare un atleta: via storico e ranking, le classifiche restano senza collegamento ------------------
delete from public.atleti where id = '10000000-0000-0000-0000-0000000000b1';
select is((select count(*)::int from public.partecipazioni), 0, 'eliminando l''atleta si elimina il suo storico');
select is(
  (select count(*)::int from public.classifiche where atleta_id is null and nome_completo = 'PROVA Bruno'), 1,
  'eliminando l''atleta la sua riga di classifica resta, senza collegamento'
);

select * from finish();
rollback;
