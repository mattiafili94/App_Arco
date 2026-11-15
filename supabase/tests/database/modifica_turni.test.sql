-- Test della modifica dei turni di un sondaggio già aperto (pgTAP). Dati inventati: nessun atleta vero.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'amministratore10@test.invalid'),
  ('00000000-0000-0000-0000-0000000000ba', 'atleta10@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000aa', '901001', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000aa'),
  ('10000000-0000-0000-0000-0000000000ba', '901002', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000ba');
insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato, ha_invito) values
  ('R0001001', '2099-03-10', '2099-03-11', 'Interregionale', 'Gubbio (PG)', '18 m', 'invito', true);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated"}';
select throws_ok(
  $$ select public.modifica_turni_sondaggio('R0001001', array['2099-03-10:mattina']) $$,
  '22023', null, 'senza sondaggio non si cambiano i turni'
);
select public.apri_sondaggio('R0001001');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000ba", "role": "authenticated"}';
select throws_ok(
  $$ select public.modifica_turni_sondaggio('R0001001', array['2099-03-10:mattina']) $$,
  '42501', null, 'un atleta non cambia i turni'
);
select public.rispondi_sondaggio('R0001001', true, '2027-01-01 10:00+00');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated"}';
select throws_ok(
  $$ select public.modifica_turni_sondaggio('R0001001', array['2099-03-12:mattina']) $$,
  '22023', null, 'un turno fuori dalle date della gara si rifiuta'
);
select lives_ok(
  $$ select public.modifica_turni_sondaggio('R0001001', array['2099-03-10:pomeriggio', '2099-03-11:mattina']) $$,
  'l''amministratore aggiunge i turni a un sondaggio aperto senza turni'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000ba", "role": "authenticated"}';
select is(
  (select turni from public.sondaggi where gara_codice = 'R0001001'),
  array['2099-03-10:pomeriggio', '2099-03-11:mattina'], 'i turni nuovi si vedono'
);
select is(
  (public.rispondi_sondaggio('R0001001', true, '2027-01-01 11:00+00', '2099-03-10:pomeriggio')).turno,
  '2099-03-10:pomeriggio', 'Bruno ora sceglie il suo turno'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated"}';
select public.modifica_turni_sondaggio('R0001001', array['2099-03-11:mattina']);
reset role;
select is(
  (select turno from public.risposte_sondaggio where gara_codice = 'R0001001'), null,
  'togliere il turno scelto lascia Bruno "Partecipo" senza turno'
);
select is(
  (select partecipa from public.risposte_sondaggio where gara_codice = 'R0001001'), true,
  'e la sua risposta resta "Partecipo"'
);
-- Le risposte di Bruno: "Partecipo" e la scelta del turno (2); il turno tolto dall'amministratore non conta.
select is(
  (select risposte from public.avvisi_sondaggio where gara_codice = 'R0001001' and tipo = 'risposte'), 2,
  'togliere un turno non fa partire un avviso di nuove risposte'
);

select * from finish();
rollback;
