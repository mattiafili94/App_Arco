-- Test delle note per volée nelle simulazioni (pgTAP). Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b0', 'atleta10@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c0', 'atleta10bis@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000b0', '901002', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b0'),
  ('10000000-0000-0000-0000-0000000000c0', '901003', 'Carla', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000c0');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b0", "role": "authenticated"}';

select is(
  (select note ->> '2' from public.salva_simulazione(
    '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b0', '2027-03-01',
    '18m', null, 'trispot', '["10","9","M"]', false, false, '2027-03-01 10:00+00', '2027-03-01 10:00+00',
    '{"2": "vento forte"}')),
  'vento forte', 'le note si salvano con la simulazione'
);

-- Una versione vecchia dell'app non manda le note: restano com'erano.
select is(
  (select note ->> '2' from public.salva_simulazione(
    '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b0', '2027-03-01',
    '18m', null, 'trispot', '["10","9","M","8"]', false, false, '2027-03-01 10:00+00', '2027-03-01 11:00+00')),
  'vento forte', 'senza p_note le note restano'
);
select is(
  (select jsonb_array_length(frecce) from public.simulazioni where id = '30000000-0000-0000-0000-000000000001'),
  4, 'e le frecce nuove si salvano lo stesso'
);

-- Con p_note si sostituiscono (anche con un oggetto vuoto: tolte tutte).
select is(
  (select note::text from public.salva_simulazione(
    '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b0', '2027-03-01',
    '18m', null, 'trispot', '["10","9","M","8"]', false, false, '2027-03-01 10:00+00', '2027-03-01 12:00+00',
    '{}')),
  '{}', 'un oggetto vuoto toglie le note'
);

-- Vince la modifica più recente anche per le note.
select is(
  (select note::text from public.salva_simulazione(
    '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b0', '2027-03-01',
    '18m', null, 'trispot', '["10","9","M","8"]', false, false, '2027-03-01 10:00+00', '2027-03-01 09:00+00',
    '{"0": "vecchia"}')),
  '{}', 'una modifica più vecchia non cambia le note'
);

-- Limiti.
select throws_ok(
  $$ select public.salva_simulazione('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000b0', '2027-03-02',
       '18m', null, 'trispot', '[]', false, false, now(), now(), '["non un oggetto"]') $$,
  '23514', null, 'le note sono un oggetto'
);
select throws_ok(
  $$ select public.salva_simulazione('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000b0', '2027-03-02',
       '18m', null, 'trispot', '[]', false, false, now(), now(),
       jsonb_build_object('0', repeat('a', 21000))) $$,
  '23514', null, 'né troppo grandi'
);
reset role;

-- Privacy: un altro atleta non scrive le note di Bruno.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c0", "role": "authenticated"}';
select throws_ok(
  $$ select public.salva_simulazione('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b0', '2027-03-01',
       '18m', null, 'trispot', '[]', false, false, now(), now() + interval '1 day', '{"0": "hack"}') $$,
  '42501', null, 'un altro atleta non scrive le note altrui'
);
reset role;

select * from finish();
rollback;
