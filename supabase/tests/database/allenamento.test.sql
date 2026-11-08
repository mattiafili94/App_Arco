-- Test dell'allenamento (pgTAP): privato, e vince la modifica più recente. Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a8', 'amministratore8@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b8', 'atleta8@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c8', 'atleta8bis@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d8', 'sconosciuto8@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000a8', '900801', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000a8'),
  ('10000000-0000-0000-0000-0000000000b8', '900802', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b8'),
  ('10000000-0000-0000-0000-0000000000c8', '900803', 'Carla', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000c8');

-- Bruno salva il suo allenamento -----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b8", "role": "authenticated"}';

select is(
  (select programma from public.salva_allenamento_giorno(
    '10000000-0000-0000-0000-0000000000b8', '2027-03-01', '60 frecce a 18 m', false, 0, '', '2027-03-01 10:00+00')),
  '60 frecce a 18 m', 'un atleta salva il suo allenamento'
);
select is((select count(*)::int from public.allenamento_giorni), 1, 'e lo rilegge');

-- Vince la modifica più recente --------------------------------------------------------------------------
select is(
  (select programma from public.salva_allenamento_giorno(
    '10000000-0000-0000-0000-0000000000b8', '2027-03-01', 'vecchia', true, 5, 'x', '2027-03-01 09:00+00')),
  '60 frecce a 18 m', 'una modifica più vecchia non sovrascrive: resta quella del server'
);
select is(
  (select programma from public.salva_allenamento_giorno(
    '10000000-0000-0000-0000-0000000000b8', '2027-03-01', 'stessa ora', true, 5, 'x', '2027-03-01 10:00+00')),
  '60 frecce a 18 m', 'a parità di ora resta quella del server'
);
select is(
  (select (r.programma, r.fatto, r.frecce_libere)::text from public.salva_allenamento_giorno(
    '10000000-0000-0000-0000-0000000000b8', '2027-03-01', '70 frecce', true, 70, 'bene', '2027-03-01 11:00+00') r),
  '("70 frecce",t,70)', 'una modifica più recente vince'
);
reset role;

select cmp_ok(
  (select aggiornato_il from public.allenamento_giorni), '>', '2020-01-01'::timestamptz,
  'ogni salvataggio lascia la data del server per la sincronizzazione'
);

-- Privacy ------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c8", "role": "authenticated"}';
select is((select count(*)::int from public.allenamento_giorni), 0, 'un altro atleta non vede il suo allenamento');
select throws_ok(
  $$ select public.salva_allenamento_giorno('10000000-0000-0000-0000-0000000000b8', '2027-03-01', 'hack', false, 0, '', now()) $$,
  '42501', null, 'e non può scrivere nel suo'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a8", "role": "authenticated"}';
select is((select count(*)::int from public.allenamento_giorni), 0, 'nemmeno l''amministratore lo vede');
select throws_ok(
  $$ select public.salva_allenamento_giorno('10000000-0000-0000-0000-0000000000b8', '2027-03-01', 'hack', false, 0, '', now()) $$,
  '42501', null, 'né lo modifica'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d8", "role": "authenticated"}';
select is((select count(*)::int from public.allenamento_giorni), 0, 'chi non è un atleta non vede niente');
reset role;

-- Nessuna scrittura diretta -------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b8", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.allenamento_giorni (atleta_id, giorno, modificato_il)
     values ('10000000-0000-0000-0000-0000000000b8', '2027-03-02', now()) $$,
  '42501', null, 'nessuna scrittura diretta nella tabella'
);
select throws_ok(
  $$ delete from public.allenamento_giorni $$,
  '42501', null, 'nessuna cancellazione diretta'
);

-- Limiti ----------------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.salva_allenamento_giorno('10000000-0000-0000-0000-0000000000b8', '2027-03-03', '', false, -1, '', now()) $$,
  '23514', null, 'le frecce non sono negative'
);
select throws_ok(
  $$ select public.salva_allenamento_giorno('10000000-0000-0000-0000-0000000000b8', '2027-03-03', '', false, 10000, '', now()) $$,
  '23514', null, 'né troppe'
);
reset role;

set local role anon;
select throws_ok(
  $$ select count(*) from public.allenamento_giorni $$,
  '42501', null, 'senza accesso non si legge niente'
);
reset role;

-- Eliminare l'atleta toglie anche il suo allenamento ---------------------------------------------------------
set local role service_role;
delete from public.atleti where id = '10000000-0000-0000-0000-0000000000b8';
select is((select count(*)::int from public.allenamento_giorni), 0, 'eliminato l''atleta, sparisce il suo allenamento');
reset role;

select * from finish();
rollback;
