-- Test delle classifiche (ranking) complete (pgTAP). Dati inventati: nessun atleta vero.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b6', 'atleta6@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d6', 'sconosciuto6@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000b6', '900601', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b6');

-- Il server salva una classifica -------------------------------------------------------------------
set local role service_role;
select lives_ok(
  $$ select public.salva_classifica_ranking('I', 'OL', 'S', 'M', 'Arco Ricurvo - Seniores Maschile', 2,
       '[{"posizione":1,"matricola":"900611","nome":"ROSSI Mario","societa_codice":"11003","societa_nome":"Prova","punti":1100,"gare":[]},
         {"posizione":2,"matricola":"900612","nome":"VERDI Luca","societa_codice":"11004","societa_nome":"Altra","punti":1090,"gare":[]}]'::jsonb) $$,
  'il server salva una classifica'
);
reset role;

select is(
  (select jsonb_array_length(righe) from public.classifiche_ranking where tipo = 'I' and divisione = 'OL'), 2,
  'la classifica è salvata con le sue righe'
);

-- Rileggerla uguale aggiorna la data di lettura ma non quella di modifica --------------------------
update public.classifiche_ranking set letta_il = '2020-01-01', aggiornato_il = '2020-01-01';
set local role service_role;
select public.salva_classifica_ranking('I', 'OL', 'S', 'M', 'Arco Ricurvo - Seniores Maschile', 2,
  (select righe from public.classifiche_ranking where tipo = 'I'));
reset role;
select cmp_ok(
  (select letta_il from public.classifiche_ranking where tipo = 'I'), '>', '2020-01-01'::timestamptz,
  'rileggere la classifica aggiorna la data di lettura'
);
select is(
  (select aggiornato_il from public.classifiche_ranking where tipo = 'I'), '2020-01-01'::timestamptz,
  'ma se non è cambiata la data di modifica resta'
);

-- Se cambia, si aggiorna anche quella di modifica ---------------------------------------------------
set local role service_role;
select public.salva_classifica_ranking('I', 'OL', 'S', 'M', 'Arco Ricurvo - Seniores Maschile', 1, '[]'::jsonb);
reset role;
select cmp_ok(
  (select aggiornato_il from public.classifiche_ranking where tipo = 'I'), '>', '2020-01-01'::timestamptz,
  'se la classifica cambia, cambia la data di modifica'
);

-- Vincoli ---------------------------------------------------------------------------------------------
set local role service_role;
select throws_ok(
  $$ select public.salva_classifica_ranking('X', 'OL', 'S', 'M', 'x', 0, '[]'::jsonb) $$,
  '23514', null, 'il tipo di ranking è uno di quelli previsti'
);
select throws_ok(
  $$ select public.salva_classifica_ranking('I', 'OL', 'G', 'M', 'x', 0, '[]'::jsonb) $$,
  '23514', null, 'la classe è una di quelle con la ranking'
);
reset role;

-- Chi legge ---------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b6", "role": "authenticated"}';
select is((select count(*)::int from public.classifiche_ranking), 1, 'un atleta legge le classifiche');
select throws_ok(
  $$ insert into public.classifiche_ranking (tipo, divisione, classe, genere, categoria, totale)
     values ('T', 'OL', 'S', 'M', 'x', 0) $$,
  '42501', null, 'un atleta non scrive le classifiche'
);
select throws_ok(
  $$ select public.salva_classifica_ranking('T', 'OL', 'S', 'M', 'x', 0, '[]'::jsonb) $$,
  '42501', null, 'un atleta non può usare la funzione che le salva'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d6", "role": "authenticated"}';
select is((select count(*)::int from public.classifiche_ranking), 0, 'chi non è un atleta non le vede');
reset role;

set local role anon;
select throws_ok(
  $$ select count(*) from public.classifiche_ranking $$,
  '42501', null, 'senza accesso non si legge niente'
);
reset role;

select * from finish();
rollback;
