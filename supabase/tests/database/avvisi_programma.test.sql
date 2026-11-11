-- Test degli avvisi del programma (pgTAP): la coda e la scelta degli avvisi del telefono. Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b6', 'allenatore6@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c6', 'atleta6@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id, allenatore) values
  ('10000000-0000-0000-0000-0000000000b6', '900602', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b6', true),
  ('10000000-0000-0000-0000-0000000000c6', '900603', 'Carla', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000c6', false);
insert into public.allenatori_atleti (allenatore_id, atleta_id) values
  ('10000000-0000-0000-0000-0000000000b6', '10000000-0000-0000-0000-0000000000c6');
insert into public.iscrizioni_push (endpoint, atleta_id, p256dh, auth) values
  ('https://push.example/carla', '10000000-0000-0000-0000-0000000000c6', 'k', 'a'),
  ('https://push.example/bruno', '10000000-0000-0000-0000-0000000000b6', 'k', 'a');

-- I telefoni già registrati ricevono tutti e due gli avvisi ----------------------------------------------------
select is(
  (select inviti and programma from public.iscrizioni_push where endpoint = 'https://push.example/carla'), true,
  'un telefono registrato riceve inviti e avvisi del programma'
);

-- L'allenatore cambia il programma: un avviso in coda --------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b6", "role": "authenticated"}';
select lives_ok(
  $$ select public.salva_allenamento_giorno('10000000-0000-0000-0000-0000000000c6', '2027-03-03', '60 frecce',
       false, 0, '', '2027-03-01 10:00+00', '2027-03-01 10:00+00') $$,
  'l''allenatore scrive il programma di mercoledì'
);
select lives_ok(
  $$ select public.salva_allenamento_giorno('10000000-0000-0000-0000-0000000000c6', '2027-03-04', '90 frecce',
       false, 0, '', '2027-03-01 10:01+00', '2027-03-01 10:01+00') $$,
  'e di giovedì, nella stessa settimana'
);
select lives_ok(
  $$ select public.salva_allenamento_giorno('10000000-0000-0000-0000-0000000000c6', '2027-03-08', 'riposo',
       false, 0, '', '2027-03-01 10:02+00', '2027-03-01 10:02+00') $$,
  'e del lunedì dopo'
);
reset role;

select is((select count(*)::int from public.avvisi_programma), 2, 'un avviso per settimana, non uno per giorno');
select is(
  (select array_agg(settimana::text order by settimana) from public.avvisi_programma),
  array['2027-03-01', '2027-03-08'], 'la settimana è quella del lunedì'
);
select is(
  (select bool_and(atleta_id = '10000000-0000-0000-0000-0000000000c6'
                   and allenatore_id = '10000000-0000-0000-0000-0000000000b6') from public.avvisi_programma),
  true, 'per l''atleta, dall''allenatore'
);

-- Quando lo cambia l'atleta: niente avviso ----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c6", "role": "authenticated"}';
select lives_ok(
  $$ select public.salva_allenamento_giorno('10000000-0000-0000-0000-0000000000c6', '2027-03-15', 'mio',
       false, 0, '', '2027-03-01 11:00+00', '2027-03-01 11:00+00') $$,
  'l''atleta scrive il suo programma'
);
select throws_ok(
  $$ select count(*) from public.avvisi_programma $$,
  '42501', null, 'la coda degli avvisi la vede solo il server'
);

-- Ogni telefono sceglie i suoi avvisi ------------------------------------------------------------------------------
select is(public.imposta_avvisi('https://push.example/carla', true, false), true, 'l''atleta spegne gli avvisi del programma');
select is(public.imposta_avvisi('https://push.example/bruno', false, false), false, 'ma non tocca il telefono di un altro');
reset role;
select is(
  (select string_agg(endpoint || ':' || inviti || '/' || programma, ',' order by endpoint) from public.iscrizioni_push),
  'https://push.example/bruno:true/true,https://push.example/carla:true/false', 'solo il suo telefono è cambiato'
);

select is((select count(*)::int from public.avvisi_programma), 2, 'e quando il programma lo cambia l''atleta non parte nessun avviso');

select * from finish();
rollback;
