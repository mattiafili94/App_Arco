-- Test delle simulazioni di campagna e 3D (pgTAP): formati, bersagli, valori e numero di frecce. Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b8', 'atleta8@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000b8', '900801', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b8');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b8", "role": "authenticated"}';

-- Campagna ------------------------------------------------------------------------------------------------
select is(
  (select jsonb_array_length(frecce) from public.salva_simulazione(
    '20000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-0000000000b8', '2027-03-01',
    '12+12', null, 'campagna', '["6","5","4","3","2","1","M"]', false, false, now(), now())),
  7, 'campagna 12+12: valori da 6 a 1 e M'
);
select lives_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000082', '10000000-0000-0000-0000-0000000000b8', '2027-03-01',
       '24+24', null, 'campagna', (select jsonb_agg('6'::text) from generate_series(1, 144)), true, false, now(), now()) $$,
  'campagna 24+24: fino a 144 frecce'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000083', '10000000-0000-0000-0000-0000000000b8', '2027-03-01',
       '24+24', null, 'campagna', (select jsonb_agg('6'::text) from generate_series(1, 145)), false, false, now(), now()) $$,
  '23514', null, 'campagna 24+24: non più di 144 frecce'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000084', '10000000-0000-0000-0000-0000000000b8', '2027-03-01',
       '12+12', null, 'campagna', (select jsonb_agg('6'::text) from generate_series(1, 73)), false, false, now(), now()) $$,
  '23514', null, 'campagna 12+12: non più di 72 frecce'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000085', '10000000-0000-0000-0000-0000000000b8', '2027-03-01',
       '12+12', null, 'campagna', '["10"]', false, false, now(), now()) $$,
  '23514', null, 'campagna: il 10 non esiste'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000086', '10000000-0000-0000-0000-0000000000b8', '2027-03-01',
       '12+12', null, 'campagna', '["X"]', false, false, now(), now()) $$,
  '23514', null, 'campagna: la X non esiste'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000087', '10000000-0000-0000-0000-0000000000b8', '2027-03-01',
       '12+12', null, 'campagna', '["11"]', false, false, now(), now()) $$,
  '23514', null, 'campagna: l''11 non esiste'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000088', '10000000-0000-0000-0000-0000000000b8', '2027-03-01',
       '12+12', 70, 'campagna', '[]', false, false, now(), now()) $$,
  '23514', null, 'campagna: niente distanza'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000089', '10000000-0000-0000-0000-0000000000b8', '2027-03-01',
       '12+12', null, 'trispot', '[]', false, false, now(), now()) $$,
  '23514', null, 'campagna con un bersaglio indoor: no'
);

-- 3D ------------------------------------------------------------------------------------------------------
select is(
  (select jsonb_array_length(frecce) from public.salva_simulazione(
    '20000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-0000000000b8', '2027-03-02',
    '3d', null, '3d', '["11","10","8","5","M"]', false, false, now(), now())),
  5, '3D: valori 11, 10, 8, 5 e M'
);
select lives_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000092', '10000000-0000-0000-0000-0000000000b8', '2027-03-02',
       '3d', null, '3d', (select jsonb_agg('11'::text) from generate_series(1, 72)), true, false, now(), now()) $$,
  '3D: fino a 72 frecce'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000093', '10000000-0000-0000-0000-0000000000b8', '2027-03-02',
       '3d', null, '3d', (select jsonb_agg('11'::text) from generate_series(1, 73)), false, false, now(), now()) $$,
  '23514', null, '3D: non più di 72 frecce'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000094', '10000000-0000-0000-0000-0000000000b8', '2027-03-02',
       '3d', null, '3d', '["9"]', false, false, now(), now()) $$,
  '23514', null, '3D: il 9 non esiste'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000095', '10000000-0000-0000-0000-0000000000b8', '2027-03-02',
       '3d', null, '3d', '["6"]', false, false, now(), now()) $$,
  '23514', null, '3D: il 6 non esiste'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000096', '10000000-0000-0000-0000-0000000000b8', '2027-03-02',
       '3d', null, 'campagna', '[]', false, false, now(), now()) $$,
  '23514', null, '3D con il bersaglio della campagna: no'
);

-- Gli altri formati non cambiano ----------------------------------------------------------------------------
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000097', '10000000-0000-0000-0000-0000000000b8', '2027-03-02',
       '18m', null, 'singolo', '["11"]', false, false, now(), now()) $$,
  '23514', null, 'indoor: l''11 continua a non esistere'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000098', '10000000-0000-0000-0000-0000000000b8', '2027-03-02',
       '18m', null, '3d', '[]', false, false, now(), now()) $$,
  '23514', null, 'indoor con il bersaglio del 3D: no'
);
select lives_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-0000000000b8', '2027-03-02',
       '70m', 60, '122', '["X","10","M"]', false, false, now(), now()) $$,
  'outdoor: continua a funzionare'
);

select * from finish();
rollback;
