-- Test del registro delle eliminazioni (pgTAP): i telefoni sanno cosa togliere. Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a3', 'amministratore3@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b3', 'atleta3@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000a3', '900301', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000a3'),
  ('10000000-0000-0000-0000-0000000000b3', '900302', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b3'),
  ('10000000-0000-0000-0000-0000000000c3', '900303', 'Carla', 'Prova', 'atleta', null);
insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato) values
  ('R0000301', '2026-01-10', '2026-01-10', 'Interregionale', 'Gubbio (PG)', '18 m', 'omologata');
insert into public.inviti (gara_codice, testo) values ('R0000301', 'Iscrizioni aperte');
insert into public.partecipazioni (atleta_id, gara_codice, divisione, classe, rank) values
  ('10000000-0000-0000-0000-0000000000b3', 'R0000301', 'OL', 'SM', 'SM');

-- Eliminare una gara toglie anche invito e storico (a cascata): ognuno lascia la sua traccia.
set local role service_role;
delete from public.gare where codice = 'R0000301';
reset role;

select is(
  (select chiave from public.eliminazioni where tabella = 'gare'), '{"codice": "R0000301"}'::jsonb,
  'una gara eliminata lascia la sua chiave'
);
select is(
  (select chiave from public.eliminazioni where tabella = 'inviti'), '{"gara_codice": "R0000301"}'::jsonb,
  'l''invito eliminato a cascata lascia la sua chiave'
);
select is(
  (select chiave from public.eliminazioni where tabella = 'partecipazioni'),
  '{"atleta_id": "10000000-0000-0000-0000-0000000000b3", "gara_codice": "R0000301", "divisione": "OL"}'::jsonb,
  'una riga di storico lascia la chiave composta'
);

-- Un amministratore che elimina un atleta dall'app: la traccia si scrive lo stesso.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
delete from public.atleti where id = '10000000-0000-0000-0000-0000000000c3';
select is(
  (select count(*)::int from public.eliminazioni where tabella = 'atleti'), 1,
  'l''eliminazione di un atleta dall''app lascia la traccia'
);
select throws_ok(
  $$ insert into public.eliminazioni (tabella, chiave) values ('gare', '{}') $$,
  '42501', null, 'nessuno scrive nel registro a mano'
);
reset role;

-- Chi legge ----------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b3", "role": "authenticated"}';
select cmp_ok((select count(*)::int from public.eliminazioni), '>=', 4, 'un atleta vede il registro');
reset role;

set local role anon;
select throws_ok($$ select * from public.eliminazioni $$, '42501', null, 'senza accesso non si legge');
reset role;

-- Le tracce vecchie (più di 60 giorni) le toglie la potatura ----------------------------------------------
update public.eliminazioni set eliminato_il = now() - interval '61 days' where tabella = 'inviti';
set local role service_role;
select public.pota_classifiche('2000-01-01');
reset role;
select is(
  (select count(*)::int from public.eliminazioni where tabella = 'inviti'), 0,
  'le tracce di più di 60 giorni si tolgono'
);
select is(
  (select count(*)::int from public.eliminazioni where tabella = 'gare'), 1,
  'quelle recenti restano'
);

select * from finish();
rollback;
