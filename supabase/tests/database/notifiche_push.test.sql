-- Test dei permessi sulle notifiche push (pgTAP). Dati inventati: nessun atleta vero.

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a4', 'amministratore4@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b4', 'atleta4@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d4', 'sconosciuto4@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000a4', '900401', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000a4'),
  ('10000000-0000-0000-0000-0000000000b4', '900402', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b4');
insert into public.gare (codice, dal, al, calendario, localita, tipologia, stato) values
  ('R0000401', '2027-03-10', '2027-03-10', 'Interregionale', 'Gubbio (PG)', '18 m', 'invito');

-- Il server mette in coda la notifica (una sola per gara) ----------------------------------------
set local role service_role;
insert into public.notifiche (gara_codice, titolo, testo) values ('R0000401', 'Nuovo invito', 'Prova');
select throws_ok(
  $$ insert into public.notifiche (gara_codice, titolo, testo) values ('R0000401', 'Nuovo invito', 'Di nuovo') $$,
  '23505', null, 'una gara ha al massimo una notifica'
);
reset role;

-- Registrare un telefono ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b4", "role": "authenticated"}';
select lives_ok(
  $$ select public.registra_push('https://push.prova.invalid/telefono-1', 'chiave', 'segreto') $$,
  'un atleta registra il suo telefono'
);
select lives_ok(
  $$ select public.registra_push('https://push.prova.invalid/telefono-1', 'chiave2', 'segreto2') $$,
  'registrarlo di nuovo lo aggiorna senza errori'
);
select throws_ok(
  $$ select public.registra_push('http://push.prova.invalid/telefono-2', 'k', 'a') $$,
  '23514', null, 'l''indirizzo del telefono deve essere https'
);
select throws_ok(
  $$ select count(*) from public.iscrizioni_push $$,
  '42501', null, 'un atleta non legge direttamente le registrazioni'
);
select throws_ok(
  $$ select count(*) from public.notifiche $$,
  '42501', null, 'un atleta non legge la coda delle notifiche'
);
select throws_ok(
  $$ insert into public.iscrizioni_push (endpoint, atleta_id, p256dh, auth)
     values ('https://push.prova.invalid/x', '10000000-0000-0000-0000-0000000000b4', 'k', 'a') $$,
  '42501', null, 'nessuna scrittura diretta nelle registrazioni'
);
reset role;

select is(
  (select p256dh from public.iscrizioni_push where endpoint = 'https://push.prova.invalid/telefono-1'),
  'chiave2', 'la registrazione ripetuta ha aggiornato le chiavi'
);

-- Un altro atleta non può togliere il telefono di Bruno ---------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select public.rimuovi_push('https://push.prova.invalid/telefono-1');
reset role;
select is(
  (select count(*)::int from public.iscrizioni_push), 1,
  'un altro atleta non toglie il telefono di Bruno'
);

-- Se sul telefono entra un'altra persona, la registrazione passa a lei -------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select public.registra_push('https://push.prova.invalid/telefono-1', 'k3', 'a3');
reset role;
select is(
  (select atleta_id from public.iscrizioni_push where endpoint = 'https://push.prova.invalid/telefono-1'),
  '10000000-0000-0000-0000-0000000000a4'::uuid, 'il telefono passa a chi ha fatto l''accesso'
);

-- ...e solo lei può toglierlo ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select public.rimuovi_push('https://push.prova.invalid/telefono-1');
reset role;
select is((select count(*)::int from public.iscrizioni_push), 0, 'chi ha registrato il telefono lo toglie');

-- Chi non è un atleta attivo non registra niente --------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d4", "role": "authenticated"}';
select throws_ok(
  $$ select public.registra_push('https://push.prova.invalid/telefono-9', 'k', 'a') $$,
  '42501', null, 'un utente che non è un atleta non registra telefoni'
);
reset role;

set local role anon;
select throws_ok(
  $$ select public.registra_push('https://push.prova.invalid/telefono-9', 'k', 'a') $$,
  '42501', null, 'senza accesso non si registra nulla'
);
reset role;

-- Eliminare l'atleta toglie anche i suoi telefoni -------------------------------------------------------
set local role service_role;
insert into public.iscrizioni_push (endpoint, atleta_id, p256dh, auth)
values ('https://push.prova.invalid/telefono-5', '10000000-0000-0000-0000-0000000000b4', 'k', 'a');
delete from public.atleti where id = '10000000-0000-0000-0000-0000000000b4';
select is((select count(*)::int from public.iscrizioni_push), 0, 'eliminato l''atleta, spariscono i suoi telefoni');
reset role;

select * from finish();
rollback;
