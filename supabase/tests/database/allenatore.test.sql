-- Test del ruolo allenatore (pgTAP): chi segue chi, cosa vede e cosa scrive. Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'amministratore7@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b7', 'allenatore7@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c7', 'atleta7@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d7', 'altro7@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000a7', '900701', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000a7'),
  ('10000000-0000-0000-0000-0000000000b7', '900702', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b7'),
  ('10000000-0000-0000-0000-0000000000c7', '900703', 'Carla', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000c7'),
  ('10000000-0000-0000-0000-0000000000d7', '900704', 'Dario', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000d7');

-- Carla ha già il suo allenamento e una simulazione; anche Dario.
insert into public.allenamento_giorni (atleta_id, giorno, programma, fatto, frecce_libere, nota, modificato_il, programma_modificato_il, programma_modificato_da) values
  ('10000000-0000-0000-0000-0000000000c7', '2027-03-01', 'scritto da Carla', true, 30, 'stanca', '2027-03-01 10:00+00', '2027-03-01 10:00+00', '10000000-0000-0000-0000-0000000000c7'),
  ('10000000-0000-0000-0000-0000000000d7', '2027-03-01', 'di Dario', false, 0, '', '2027-03-01 10:00+00', '2027-03-01 10:00+00', '10000000-0000-0000-0000-0000000000d7');
insert into public.simulazioni (id, atleta_id, giorno, formato, distanza, bersaglio, frecce, creata_il, modificato_il) values
  ('20000000-0000-0000-0000-0000000000c7', '10000000-0000-0000-0000-0000000000c7', '2027-03-01', '18m', null, 'trispot', '["10"]', now(), now());

-- Il ruolo lo dà solo l'amministratore --------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b7", "role": "authenticated"}';
update public.atleti set allenatore = true where id = '10000000-0000-0000-0000-0000000000b7';
reset role;
select is(
  (select allenatore from public.atleti where id = '10000000-0000-0000-0000-0000000000b7'), false,
  'un atleta non si dà da solo il ruolo di allenatore'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b7", "role": "authenticated"}';
select throws_ok(
  $$ select public.segui_atleta('10000000-0000-0000-0000-0000000000c7', true) $$,
  '42501', null, 'senza il ruolo non si può seguire nessuno'
);
select is((select count(*)::int from public.allenamento_giorni), 0, 'e non si vede l''allenamento degli altri');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a7", "role": "authenticated"}';
update public.atleti set allenatore = true where id = '10000000-0000-0000-0000-0000000000b7';
reset role;
select is(
  (select allenatore from public.atleti where id = '10000000-0000-0000-0000-0000000000b7'), true,
  'l''amministratore dà il ruolo di allenatore'
);

-- Bruno, allenatore, sceglie di seguire Carla -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b7", "role": "authenticated"}';
select is(public.segui_atleta('10000000-0000-0000-0000-0000000000c7', true), true, 'l''allenatore segue un atleta');
select is(public.segui_atleta('10000000-0000-0000-0000-0000000000c7', true), true, 'seguirlo due volte non cambia niente');
select is((select count(*)::int from public.allenatori_atleti), 1, 'una riga sola');
select throws_ok(
  $$ select public.segui_atleta('10000000-0000-0000-0000-0000000000b7', true) $$,
  '22023', null, 'non si segue sé stessi'
);
select throws_ok(
  $$ insert into public.allenatori_atleti (allenatore_id, atleta_id)
     values ('10000000-0000-0000-0000-0000000000b7', '10000000-0000-0000-0000-0000000000d7') $$,
  '42501', null, 'niente scritture dirette: si passa da segui_atleta'
);

-- Cosa vede
select is(
  (select array_agg(atleta_id::text order by atleta_id) from public.allenamento_giorni),
  array['10000000-0000-0000-0000-0000000000c7'], 'vede l''allenamento di chi segue, non degli altri'
);
select is((select count(*)::int from public.simulazioni), 1, 'vede le simulazioni di chi segue');

-- Cosa scrive: solo il programma
select is(
  (select programma || '|' || fatto || '|' || frecce_libere || '|' || nota from public.salva_allenamento_giorno(
    '10000000-0000-0000-0000-0000000000c7', '2027-03-01', '60 frecce a 18 m', false, 0, '',
    '2027-03-02 10:00+00', '2027-03-02 10:00+00')),
  '60 frecce a 18 m|true|30|stanca', 'l''allenatore cambia il programma, non "fatto", frecce e nota'
);
select is(
  (select programma_modificato_da from public.allenamento_giorni
   where atleta_id = '10000000-0000-0000-0000-0000000000c7' and giorno = '2027-03-01'),
  '10000000-0000-0000-0000-0000000000b7'::uuid, 'e risulta lui l''autore del programma'
);
select is(
  (select fatto::text || '|' || extract(year from modificato_il)::text from public.salva_allenamento_giorno(
    '10000000-0000-0000-0000-0000000000c7', '2027-03-05', 'giorno nuovo', true, 99, 'x',
    '2027-03-05 10:00+00', '2027-03-05 10:00+00')),
  'false|1970', 'un giorno nuovo creato dall''allenatore ha solo il programma'
);
select throws_ok(
  $$ select public.salva_allenamento_giorno('10000000-0000-0000-0000-0000000000d7', '2027-03-01', 'x', false, 0, '',
       '2027-03-09 10:00+00', '2027-03-09 10:00+00') $$,
  '42501', null, 'non scrive il programma di chi non segue'
);
select throws_ok(
  $$ select public.salva_simulazione('20000000-0000-0000-0000-0000000000c7', '10000000-0000-0000-0000-0000000000c7',
       '2027-03-01', '18m', null, 'trispot', '["10","9"]', false, false, now(), now() + interval '1 day') $$,
  '42501', null, 'le simulazioni dell''atleta non le può cambiare'
);
reset role;

-- L'atleta vede chi lo segue, e ritrova il suo programma ---------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c7", "role": "authenticated"}';
select is(
  (select allenatore_id from public.allenatori_atleti), '10000000-0000-0000-0000-0000000000b7'::uuid,
  'l''atleta vede chi lo segue'
);
-- Un telefono vecchio (senza la data del programma) non cancella il programma dell'allenatore…
select is(
  (select programma || '|' || fatto from public.salva_allenamento_giorno(
    '10000000-0000-0000-0000-0000000000c7', '2027-03-01', 'scritto da Carla', false, 30, 'stanca',
    '2027-03-03 10:00+00')),
  '60 frecce a 18 m|false', 'telefono vecchio: "fatto" cambia, il programma dell''allenatore resta'
);
-- …e nemmeno un telefono nuovo con un programma più vecchio.
select is(
  (select programma from public.salva_allenamento_giorno(
    '10000000-0000-0000-0000-0000000000c7', '2027-03-01', 'vecchio', false, 30, 'stanca',
    '2027-03-04 10:00+00', '2027-03-01 12:00+00')),
  '60 frecce a 18 m', 'un programma modificato prima di quello dell''allenatore non vince'
);
-- Un programma cambiato dopo invece vince, e l'autore torna l'atleta.
select is(
  (select programma || '|' || (programma_modificato_da = atleta_id)::text from public.salva_allenamento_giorno(
    '10000000-0000-0000-0000-0000000000c7', '2027-03-01', 'cambiato da Carla', false, 30, 'stanca',
    '2027-03-04 11:00+00', '2027-03-04 11:00+00')),
  'cambiato da Carla|true', 'l''atleta cambia il programma dopo l''allenatore: vince lui, ed è l''autore'
);
-- Il giorno creato dall'allenatore: l'atleta segna "fatto" con la sua ora e vince (la riga è "del 1970").
select is(
  (select fatto::text || '|' || programma from public.salva_allenamento_giorno(
    '10000000-0000-0000-0000-0000000000c7', '2027-03-05', 'giorno nuovo', true, 60, '', '2027-03-04 09:00+00')),
  'true|giorno nuovo', 'sul giorno scritto dall''allenatore l''atleta segna le sue cose'
);
select throws_ok(
  $$ select public.segui_atleta('10000000-0000-0000-0000-0000000000d7', true) $$,
  '42501', null, 'un atleta senza ruolo non segue nessuno'
);
reset role;

-- Chi non è seguito non vede niente; l'amministratore nemmeno -----------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d7", "role": "authenticated"}';
select is((select count(*)::int from public.allenatori_atleti), 0, 'un altro atleta non vede chi segue chi');
select is(
  (select count(*)::int from public.allenamento_giorni where atleta_id <> '10000000-0000-0000-0000-0000000000d7'),
  0, 'e non vede l''allenamento degli altri'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a7", "role": "authenticated"}';
select is((select count(*)::int from public.allenamento_giorni), 0, 'l''amministratore senza ruolo di allenatore non vede l''allenamento');
reset role;

-- Smettere di seguire, e togliere il ruolo ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b7", "role": "authenticated"}';
select is(public.segui_atleta('10000000-0000-0000-0000-0000000000c7', false), false, 'si smette di seguire');
select is((select count(*)::int from public.allenamento_giorni), 0, 'e non si vede più niente');
select is(public.segui_atleta('10000000-0000-0000-0000-0000000000c7', true), true, 'si torna a seguire');
reset role;

select is(
  (select count(*)::int from public.eliminazioni where tabella = 'allenatori_atleti'), 1,
  'i telefoni sanno che una riga è sparita'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a7", "role": "authenticated"}';
update public.atleti set allenatore = false where id = '10000000-0000-0000-0000-0000000000b7';
reset role;
select is((select count(*)::int from public.allenatori_atleti), 0, 'tolto il ruolo, non segue più nessuno');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b7", "role": "authenticated"}';
select is((select count(*)::int from public.allenamento_giorni), 0, 'e non vede più l''allenamento di nessuno');
reset role;

select * from finish();
rollback;
