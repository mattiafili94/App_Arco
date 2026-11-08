-- Test di `mie_classifiche` (pgTAP): ogni atleta vede solo la propria riga delle classifiche. Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b7', 'atleta7@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d7', 'sconosciuto7@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000b7', '900701', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b7');

insert into public.classifiche_ranking (tipo, divisione, classe, genere, categoria, totale, righe) values
  ('I', 'OL', 'S', 'M', 'Arco Ricurvo - Seniores Maschile', 3,
   '[{"posizione":1,"matricola":"900711","nome":"ROSSI Mario","punti":1100},
     {"posizione":2,"matricola":"900701","nome":"PROVA Bruno","punti":1090},
     {"posizione":3,"matricola":"900712","nome":"VERDI Luca","punti":1080}]'::jsonb),
  ('T', 'OL', 'S', 'M', 'Arco Ricurvo - Seniores Maschile', 1,
   '[{"posizione":7,"matricola":"900701","nome":"PROVA Bruno","punti":1300}]'::jsonb),
  ('I', 'CO', 'S', 'M', 'Arco Compound - Seniores Maschile', 1,
   '[{"posizione":1,"matricola":"900711","nome":"ROSSI Mario","punti":1150}]'::jsonb);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b7", "role": "authenticated"}';

select is(
  (select count(*)::int from public.mie_classifiche('900701')), 2,
  'solo le classifiche in cui compare la matricola'
);
select is(
  (select array_agg(tipo order by tipo) from public.mie_classifiche('900701')), array['I', 'T'],
  'una per ogni tipo, in ordine'
);
select is(
  (select riga ->> 'posizione' from public.mie_classifiche('900701') where tipo = 'I'), '2',
  'la riga è quella dell''atleta'
);
select is(
  (select totale from public.mie_classifiche('900701') where tipo = 'I'), 3,
  'con il totale degli atleti della classifica'
);
select is((select count(*)::int from public.mie_classifiche('999999')), 0, 'matricola assente: niente');
reset role;

-- Chi non è un atleta non vede niente (le regole delle classifiche valgono anche qui) ---------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d7", "role": "authenticated"}';
select is((select count(*)::int from public.mie_classifiche('900701')), 0, 'chi non è un atleta non vede niente');
reset role;

select * from finish();
rollback;
