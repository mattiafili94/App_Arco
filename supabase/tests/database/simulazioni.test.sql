-- Test delle simulazioni di gara (pgTAP): private, vince la modifica più recente, valori ammessi. Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a9', 'amministratore9@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b9', 'atleta9@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c9', 'atleta9bis@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000a9', '900901', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000a9'),
  ('10000000-0000-0000-0000-0000000000b9', '900902', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b9'),
  ('10000000-0000-0000-0000-0000000000c9', '900903', 'Carla', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000c9');

-- Bruno salva una simulazione ----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b9", "role": "authenticated"}';

select is(
  (select jsonb_array_length(frecce) from public.salva_simulazione(
    '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b9', '2027-03-01',
    '18m', null, 'trispot', '["10","9","M"]', false, false, '2027-03-01 10:00+00', '2027-03-01 10:00+00')),
  3, 'un atleta salva la sua simulazione'
);
select is((select count(*)::int from public.simulazioni), 1, 'e la rilegge');

-- Vince la modifica più recente ----------------------------------------------------------------------------
select is(
  (select jsonb_array_length(frecce) from public.salva_simulazione(
    '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b9', '2027-03-01',
    '18m', null, 'trispot', '["10"]', false, false, '2027-03-01 10:00+00', '2027-03-01 09:00+00')),
  3, 'una modifica più vecchia non sovrascrive'
);
select is(
  (select jsonb_array_length(frecce) from public.salva_simulazione(
    '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b9', '2027-03-01',
    '18m', null, 'trispot', '["10","9","M","8"]', false, false, '2027-03-01 10:00+00', '2027-03-01 10:00+00')),
  3, 'a parità di ora resta quella del server'
);
select is(
  (select jsonb_array_length(frecce) from public.salva_simulazione(
    '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b9', '2027-03-01',
    '18m', null, 'trispot', '["10","9","M","8"]', true, false, '2027-03-01 10:00+00', '2027-03-01 11:00+00')),
  4, 'una modifica più recente vince'
);
select is(
  (select eliminata from public.salva_simulazione(
    '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b9', '2027-03-01',
    '18m', null, 'trispot', '["10","9","M","8"]', true, true, '2027-03-01 10:00+00', '2027-03-01 12:00+00')),
  true, 'cancellare è un segno, la riga resta'
);

-- Formati e valori ammessi ----------------------------------------------------------------------------------
select lives_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000b9', '2027-03-02',
       '70m', 60, '122', '["X","10","9","M"]', false, false, now(), now()) $$,
  'outdoor: bersaglio da 122 cm con X e la distanza'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000b9', '2027-03-02',
       '18m', null, 'singolo', '["X"]', false, false, now(), now()) $$,
  '23514', null, 'indoor: la X non esiste'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-0000000000b9', '2027-03-02',
       '18m', null, '122', '[]', false, false, now(), now()) $$,
  '23514', null, 'indoor con un bersaglio da outdoor: no'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-0000000000b9', '2027-03-02',
       '70m', null, '122', '[]', false, false, now(), now()) $$,
  '23514', null, 'outdoor senza distanza: no'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-0000000000b9', '2027-03-02',
       '18m', null, 'singolo', '["11"]', false, false, now(), now()) $$,
  '23514', null, 'un valore che non esiste'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-0000000000b9', '2027-03-02',
       '18m', null, 'singolo', (select jsonb_agg('9') from generate_series(1, 61)), false, false, now(), now()) $$,
  '23514', null, 'mai più frecce di quelle del formato'
);

-- Privacy ------------------------------------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c9", "role": "authenticated"}';
select is((select count(*)::int from public.simulazioni), 0, 'un altro atleta non vede le sue simulazioni');
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b9', '2027-03-01',
       '18m', null, 'trispot', '[]', false, false, now(), now() + interval '1 day') $$,
  '42501', null, 'e non può scrivere nelle sue'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000c9', '2027-03-01',
       '18m', null, 'trispot', '[]', false, false, now(), now() + interval '1 day') $$,
  '42501', null, 'né portarsele via usando il loro numero'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a9", "role": "authenticated"}';
select is((select count(*)::int from public.simulazioni), 0, 'nemmeno l''amministratore le vede');
select throws_ok(
  $$ delete from public.simulazioni $$, '42501', null, 'e nessuno cancella direttamente'
);
reset role;

set local role anon;
select throws_ok(
  $$ select count(*) from public.simulazioni $$, '42501', null, 'senza accesso non si legge niente'
);
reset role;

-- Eliminare l'atleta toglie anche le sue simulazioni ----------------------------------------------------------
set local role service_role;
delete from public.atleti where id = '10000000-0000-0000-0000-0000000000b9';
select is((select count(*)::int from public.simulazioni), 0, 'eliminato l''atleta, spariscono le sue simulazioni');
reset role;

select * from finish();
rollback;
