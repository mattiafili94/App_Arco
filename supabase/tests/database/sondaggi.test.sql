-- Test dei sondaggi "Partecipo / Non partecipo" (pgTAP): chi apre, chi risponde, chi vede, gli avvisi.
-- Dati inventati: nessun atleta vero.

begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a8', 'amministratore8@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b8', 'atleta8@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c8', 'atleta8c@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d8', 'sconosciuto8@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000a8', '900801', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000a8'),
  ('10000000-0000-0000-0000-0000000000b8', '900802', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b8'),
  ('10000000-0000-0000-0000-0000000000c8', '900803', 'Carla', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000c8');
insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato, ha_invito) values
  ('R0000801', '2099-03-10', '2099-03-10', 'Interregionale', 'Gubbio (PG)', '18 m', 'invito', true),
  ('R0000802', '2099-04-10', '2099-04-10', 'Interregionale', 'Perugia (PG)', '18 m', 'in-calendario', false),
  ('R0000803', '2020-03-10', '2020-03-10', 'Interregionale', 'Terni (TR)', '18 m', 'omologata', true),
  ('R0000804', '2099-05-10', '2099-05-10', 'Interregionale', 'Foligno (PG)', '18 m', 'annullata', true);
insert into public.iscrizioni_push (endpoint, atleta_id, p256dh, auth) values
  ('https://push.prova.invalid/bruno', '10000000-0000-0000-0000-0000000000b8', 'k', 'a');

-- Aprire: solo l'amministratore, solo gare future con l'invito ------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b8", "role": "authenticated"}';
select throws_ok($$ select public.apri_sondaggio('R0000801') $$, '42501', null, 'un atleta non apre i sondaggi');
select throws_ok($$ select public.chiudi_sondaggio('R0000801') $$, '42501', null, 'né li chiude');
select throws_ok(
  $$ insert into public.sondaggi (gara_codice) values ('R0000801') $$,
  '42501', null, 'e non scrive direttamente la tabella'
);
select is(
  (public.rispondi_sondaggio('R0000801', true, now())).gara_codice, null,
  'senza sondaggio la risposta non si salva'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a8", "role": "authenticated"}';
select throws_ok($$ select public.apri_sondaggio('R0000802') $$, '22023', null, 'niente sondaggio senza invito');
select throws_ok($$ select public.apri_sondaggio('R0000803') $$, '22023', null, 'niente sondaggio per una gara passata');
select throws_ok($$ select public.apri_sondaggio('R0000804') $$, '22023', null, 'niente sondaggio per una gara annullata');
select lives_ok($$ select public.apri_sondaggio('R0000801') $$, 'l''amministratore apre il sondaggio');
select lives_ok($$ select public.apri_sondaggio('R0000801') $$, 'aprirlo di nuovo non dà errore');
select is((select count(*)::int from public.sondaggi), 1, 'una gara ha un sondaggio solo');
select is((select aperto from public.sondaggi where gara_codice = 'R0000801'), true, 'il sondaggio è aperto');
select throws_ok(
  $$ select count(*) from public.avvisi_sondaggio $$,
  '42501', null, 'la coda degli avvisi la vede solo il server'
);
reset role;

select is(
  (select string_agg(tipo || ':' || coalesce(escluso_id::text, '-'), ',') from public.avvisi_sondaggio),
  'aperto:10000000-0000-0000-0000-0000000000a8',
  'un avviso "aperto" per tutti, tranne chi l''ha aperto'
);

-- Rispondere: ognuno per sé, vince la risposta più recente ---------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b8", "role": "authenticated"}';
select is(
  (public.rispondi_sondaggio('R0000801', true, '2027-01-01 10:00+00')).partecipa, true,
  'Bruno risponde "partecipo"'
);
select is(
  (public.rispondi_sondaggio('R0000801', false, '2027-01-01 09:00+00')).partecipa, true,
  'una risposta più vecchia (dal telefono offline) non vince'
);
select is(
  (public.rispondi_sondaggio('R0000801', false, '2027-01-01 11:00+00')).partecipa, false,
  'una più recente sì: Bruno cambia idea'
);
select throws_ok(
  $$ insert into public.risposte_sondaggio (gara_codice, atleta_id, partecipa, modificato_il)
     values ('R0000801', '10000000-0000-0000-0000-0000000000c8', true, now()) $$,
  '42501', null, 'nessuno scrive le risposte direttamente (nemmeno per un altro)'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c8", "role": "authenticated"}';
select is(
  (public.rispondi_sondaggio('R0000801', true, '2027-01-01 10:00+00')).atleta_id,
  '10000000-0000-0000-0000-0000000000c8'::uuid, 'Carla risponde solo per sé'
);
select is((select count(*)::int from public.risposte_sondaggio), 2, 'tutti i membri vedono tutte le risposte');
select is((select count(*)::int from public.sondaggi), 1, 'e i sondaggi');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a8", "role": "authenticated"}';
select lives_ok($$ select public.rispondi_sondaggio('R0000801', true, now()) $$, 'anche l''amministratore risponde');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d8", "role": "authenticated"}';
select throws_ok(
  $$ select public.rispondi_sondaggio('R0000801', true, now()) $$,
  '42501', null, 'chi non è membro non risponde'
);
select is((select count(*)::int from public.risposte_sondaggio), 0, 'e non vede le risposte');
reset role;

select is(
  (select risposte from public.avvisi_sondaggio where tipo = 'risposte' and inviato_il is null), 3,
  'un avviso solo per le risposte: 2 di Bruno (una cambiata) e 1 di Carla, non quella dell''amministratore'
);

-- Chiuso il sondaggio, le risposte non cambiano più -------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a8", "role": "authenticated"}';
select lives_ok($$ select public.chiudi_sondaggio('R0000801') $$, 'l''amministratore chiude il sondaggio');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b8", "role": "authenticated"}';
select is(
  (public.rispondi_sondaggio('R0000801', true, '2027-01-02 10:00+00')).partecipa, false,
  'a sondaggio chiuso resta la risposta di prima'
);
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a8", "role": "authenticated"}';
select lives_ok($$ select public.apri_sondaggio('R0000801') $$, 'e lo può riaprire');
reset role;
select is(
  (select count(*)::int from public.avvisi_sondaggio where tipo = 'aperto'), 1,
  'riaprirlo non manda di nuovo l''avviso a tutti'
);

-- Ogni telefono sceglie i suoi avvisi ------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b8", "role": "authenticated"}';
select is(
  public.imposta_avvisi('https://push.prova.invalid/bruno', true, true, false, true), true,
  'Bruno spegne gli avvisi dei sondaggi'
);
reset role;
select is(
  (select sondaggi::text || '/' || inviti::text from public.iscrizioni_push where endpoint = 'https://push.prova.invalid/bruno'),
  'false/true', 'solo quello'
);

select * from finish();
rollback;
