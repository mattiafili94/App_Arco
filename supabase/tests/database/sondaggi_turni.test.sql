-- Test dei turni nel sondaggio (pgTAP): turni validi all'apertura, un turno per chi partecipa, app vecchie.
-- Dati inventati: nessun atleta vero.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a9', 'amministratore9@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b9', 'atleta9@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000a9', '900901', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000a9'),
  ('10000000-0000-0000-0000-0000000000b9', '900902', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b9');
insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato, ha_invito) values
  ('R0000901', '2099-03-10', '2099-03-11', 'Interregionale', 'Gubbio (PG)', '18 m', 'invito', true),
  ('R0000902', '2099-04-10', '2099-04-10', 'Interregionale', 'Perugia (PG)', '18 m', 'invito', true);

-- Aprire con i turni -------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a9", "role": "authenticated"}';
select throws_ok(
  $$ select public.apri_sondaggio('R0000901', array['2099-03-12:mattina']) $$,
  '22023', null, 'un turno fuori dalle date della gara si rifiuta'
);
select throws_ok(
  $$ select public.apri_sondaggio('R0000901', array['2099-03-10:sera']) $$,
  '22023', null, 'solo mattina o pomeriggio'
);
select throws_ok(
  $$ select public.apri_sondaggio('R0000901', array['2099-03-10:mattina', '2099-03-10:mattina']) $$,
  '22023', null, 'niente turni ripetuti'
);
select lives_ok(
  $$ select public.apri_sondaggio('R0000901', array['2099-03-10:mattina', '2099-03-10:pomeriggio', '2099-03-11:mattina']) $$,
  'l''amministratore apre il sondaggio con tre turni'
);
select is(
  (select turni from public.sondaggi where gara_codice = 'R0000901'),
  array['2099-03-10:mattina', '2099-03-10:pomeriggio', '2099-03-11:mattina'],
  'i turni si salvano'
);
select lives_ok($$ select public.apri_sondaggio('R0000902') $$, 'la versione vecchia apre senza turni');
select is(
  (select turni from public.sondaggi where gara_codice = 'R0000902'), '{}'::text[],
  'senza turni: elenco vuoto'
);
select public.chiudi_sondaggio('R0000901');
select lives_ok(
  $$ select public.apri_sondaggio('R0000901', array['2099-03-11:pomeriggio']) $$,
  'riaprire non dà errore'
);
select is(
  cardinality((select turni from public.sondaggi where gara_codice = 'R0000901')), 3,
  'e non cambia i turni'
);

-- Rispondere con il turno --------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b9", "role": "authenticated"}';
select throws_ok(
  $$ select public.rispondi_sondaggio('R0000901', true, '2027-01-01 10:00+00', '2099-03-11:pomeriggio') $$,
  '22023', null, 'un turno che il sondaggio non ha si rifiuta'
);
select is(
  (public.rispondi_sondaggio('R0000901', true, '2027-01-01 10:00+00', '2099-03-10:pomeriggio')).turno,
  '2099-03-10:pomeriggio', 'Bruno partecipa al sabato pomeriggio'
);
select is(
  (public.rispondi_sondaggio('R0000901', true, '2027-01-01 11:00+00')).turno,
  '2099-03-10:pomeriggio', 'un "Partecipo" da un''app vecchia non toglie il turno'
);
select is(
  (public.rispondi_sondaggio('R0000901', false, '2027-01-01 12:00+00', '2099-03-10:mattina')).turno,
  null, 'chi non partecipa non ha turno'
);
select is(
  (public.rispondi_sondaggio('R0000901', true, '2027-01-01 13:00+00', '2099-03-11:mattina')).turno,
  '2099-03-11:mattina', 'cambia idea: partecipa alla domenica mattina'
);
select throws_ok(
  $$ select public.rispondi_sondaggio('R0000902', true, now(), '2099-04-10:mattina') $$,
  '22023', null, 'un sondaggio senza turni non accetta turni'
);
reset role;

-- Ogni risposta e ogni cambio di turno contano nell'avviso all'amministratore (3: sì, no, sì con un altro turno;
-- il "Partecipo" dell'app vecchia non cambia niente).
select is(
  (select risposte from public.avvisi_sondaggio where gara_codice = 'R0000901' and tipo = 'risposte'), 3,
  'l''avviso conta anche il cambio di turno'
);

select * from finish();
rollback;
