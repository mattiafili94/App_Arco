-- Test delle posizioni delle frecce e del flag compound nelle simulazioni (pgTAP). Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'atleta11@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000b1', '901102', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b1');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';

select is(
  (select posizioni -> 1 ->> 0 from public.salva_simulazione(
    '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b1', '2027-03-01',
    '18m', null, 'trispot', '["10","9"]', false, false, '2027-03-01 10:00+00', '2027-03-01 10:00+00',
    null, '[null, [0.25, -0.1]]', true)),
  '0.25', 'le posizioni si salvano (null = tastierino)'
);
select is(
  (select compound from public.simulazioni where id = '40000000-0000-0000-0000-000000000001'), true,
  'e anche se l''arco è compound'
);

-- Una versione vecchia dell'app non le manda: restano.
select is(
  (select jsonb_array_length(posizioni) from public.salva_simulazione(
    '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b1', '2027-03-01',
    '18m', null, 'trispot', '["10","9","8"]', false, false, '2027-03-01 10:00+00', '2027-03-01 11:00+00')),
  2, 'senza posizioni restano quelle che c''erano'
);
select is(
  (select compound from public.simulazioni where id = '40000000-0000-0000-0000-000000000001'), true,
  'e compound resta com''era'
);

-- Con valori nuovi si sostituiscono.
select is(
  (select jsonb_array_length(posizioni) from public.salva_simulazione(
    '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b1', '2027-03-01',
    '18m', null, 'trispot', '["10","9","8"]', false, false, '2027-03-01 10:00+00', '2027-03-01 12:00+00',
    null, '[null, [0.25, -0.1], [0, 0]]', false)),
  3, 'con posizioni nuove si sostituiscono'
);
select is(
  (select compound from public.simulazioni where id = '40000000-0000-0000-0000-000000000001'), false,
  'e compound si può togliere'
);

-- Limiti.
select throws_ok(
  $$ select public.salva_simulazione('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000b1', '2027-03-02',
       '18m', null, 'trispot', '[]', false, false, now(), now(), null, '[[0.1]]') $$,
  '23514', null, 'una posizione ha due numeri'
);
select throws_ok(
  $$ select public.salva_simulazione('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000b1', '2027-03-02',
       '18m', null, 'trispot', '[]', false, false, now(), now(), null, '[[5, 0]]') $$,
  '23514', null, 'e non può stare lontanissimo dal bersaglio'
);
select throws_ok(
  $$ select public.salva_simulazione('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-0000000000b1', '2027-03-02',
       '18m', null, 'trispot', '[]', false, false, now(), now(), null, '[["a", "b"]]') $$,
  '23514', null, 'i numeri sono numeri'
);
select throws_ok(
  $$ select public.salva_simulazione('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-0000000000b1', '2027-03-02',
       '70m', 70, '122', '[]', false, false, now(), now(), null, null, true) $$,
  '23514', null, 'compound vale solo all''indoor'
);
reset role;

select * from finish();
rollback;
