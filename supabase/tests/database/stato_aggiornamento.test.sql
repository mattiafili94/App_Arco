-- Test di stato_aggiornamento (pgTAP): cosa vede la funzione del server per decidere cosa leggere.
-- Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b2', 'atleta2@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, attivo, utente_id) values
  ('10000000-0000-0000-0000-0000000000b2', '900202', 'Bruno', 'Prova', true, '00000000-0000-0000-0000-0000000000b2'),
  ('10000000-0000-0000-0000-0000000000c2', '900203', 'Carla', 'Prova', false, null);
insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato, in_calendario_umbria) values
  ('R0000101', '2026-01-10', '2026-01-10', 'Interregionale', 'Gubbio (PG)', '18 m', 'da-omologare', true),
  ('R0000102', '2025-02-10', '2025-02-11', 'Interregionale', 'Roma (RM)', '18 m', 'sconosciuto', false);
insert into public.partecipazioni (atleta_id, gara_codice, divisione, classe, rank) values
  ('10000000-0000-0000-0000-0000000000b2', 'R0000102', 'OL', 'SM', 'SM');
insert into public.letture (tipo, chiave, esito, creato_il) values
  ('calendario', '2026', 'ok', '2026-11-07 23:30:00+00'),
  ('calendario', '2026', 'errore', '2026-11-08 09:00:00+00'),
  ('invito', 'R0000101', 'invariato', '2026-11-01 10:00:00+00');

set local role service_role;
select public.salva_classifica('R0000101', '[{"categoria": "C", "ordine": 1, "divisione": "OL", "classe": "S",
  "esito": "1", "nome_completo": "X", "cognome": "X", "nome": "", "societa_codice": "11003",
  "societa_nome": "S", "totale": 1, "conteggi": [0, 0], "colonne_conteggi": ["10", "9"]}]'::jsonb, 'i', true);

select lives_ok($$ select public.stato_aggiornamento() $$, 'il server può chiedere lo stato');
reset role;

create temporary table stato as select public.stato_aggiornamento() as s;

select is(
  (select s -> 'ultimeLetture' from stato),
  '[{"tipo": "calendario", "chiave": "2026", "letto_il": "2026-11-08"},
    {"tipo": "invito", "chiave": "R0000101", "letto_il": "2026-11-01"}]'::jsonb,
  'ultime letture riuscite, con il giorno italiano (23:30 UTC del 7 = 8 novembre); gli errori non contano'
);
select is((select s -> 'anniStorico' from stato), '[2025]'::jsonb, 'anni degli storici');
select is(
  (select g from stato, jsonb_array_elements(s -> 'gare') g where g ->> 'codice' = 'R0000101'),
  '{"codice": "R0000101", "dal": "2026-01-10", "al": "2026-01-10", "stato": "da-omologare",
    "in_calendario_umbria": true, "ha_invito": false, "url_risultati": null,
    "con_partecipanti": false, "classifica_provvisoria": true}'::jsonb,
  'una gara dell''Umbria con la classifica provvisoria'
);
select is(
  (select g -> 'con_partecipanti' from stato, jsonb_array_elements(s -> 'gare') g where g ->> 'codice' = 'R0000102'),
  'true'::jsonb,
  'una gara fuori regione con un nostro atleta'
);
select is(
  (select g -> 'classifica_provvisoria' from stato, jsonb_array_elements(s -> 'gare') g where g ->> 'codice' = 'R0000102'),
  'null'::jsonb,
  'senza classifica salvata: null'
);
select is(
  (select s -> 'atleti' from stato), '[{"id": "10000000-0000-0000-0000-0000000000b2"}]'::jsonb,
  'solo gli atleti attivi'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select throws_ok(
  $$ select public.stato_aggiornamento() $$, '42501', null, 'un atleta non può chiedere lo stato del server'
);
reset role;

set local role anon;
select throws_ok(
  $$ select public.stato_aggiornamento() $$, '42501', null, 'senza accesso nemmeno'
);
reset role;

select * from finish();
rollback;
