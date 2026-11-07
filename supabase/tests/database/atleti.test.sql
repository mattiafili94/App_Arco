-- Test dei permessi sulla tabella atleti (pgTAP). Girano su un Supabase di prova:
--   npx supabase test db     (in locale serve Docker; su GitHub girano a ogni PR)
-- Dati inventati: nessun atleta vero.

begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- Permessi espliciti (il progetto non espone in automatico le tabelle nuove) ------------------
select ok(
  has_table_privilege('authenticated', 'public.atleti', 'SELECT')
  and has_column_privilege('authenticated', 'public.atleti', 'nome', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.atleti', 'utente_id', 'UPDATE'),
  'chi ha fatto l''accesso ha i permessi previsti, ma non sul collegamento con l''accesso'
);
select ok(
  not has_table_privilege('anon', 'public.atleti', 'SELECT')
  and has_table_privilege('service_role', 'public.atleti', 'UPDATE'),
  'nessun permesso senza accesso; la funzione del server può collegare gli accessi'
);

-- Utenti di prova (accessi tecnici) e atleti di prova.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'amministratore@test.invalid'),
  ('00000000-0000-0000-0000-00000000000b', 'atleta@test.invalid'),
  ('00000000-0000-0000-0000-00000000000c', 'inattivo@test.invalid'),
  ('00000000-0000-0000-0000-00000000000d', 'sconosciuto@test.invalid');

insert into public.atleti (id, matricola, nome, cognome, ruolo, attivo, utente_id) values
  ('10000000-0000-0000-0000-00000000000a', '900001', 'Anna', 'Prova', 'amministratore', true, '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-00000000000b', '900002', 'Bruno', 'Prova', 'atleta', true, '00000000-0000-0000-0000-00000000000b'),
  ('10000000-0000-0000-0000-00000000000c', '900003', 'Carla', 'Prova', 'atleta', false, '00000000-0000-0000-0000-00000000000c');

-- Vincoli dei dati ----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.atleti (matricola, nome, cognome) values ('12a', 'X', 'Y') $$,
  '23514', null, 'la matricola accetta solo cifre'
);
select throws_ok(
  $$ insert into public.atleti (matricola, nome, cognome) values ('900001', 'X', 'Y') $$,
  '23505', null, 'la matricola è unica'
);
select throws_ok(
  $$ insert into public.atleti (matricola, nome, cognome) values ('900009', '  ', 'Y') $$,
  '23514', null, 'il nome non può essere vuoto'
);

-- Chi non ha fatto l'accesso -------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select * from public.atleti $$,
  '42501', null, 'chi non ha fatto l''accesso non può leggere gli atleti'
);
reset role;

-- Utente collegato ma che non è un atleta della compagnia ----------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';
select is((select count(*)::int from public.atleti), 0, 'un utente che non è atleta non vede nessuno');
select is(public.e_membro(), false, 'e_membro è falso per chi non è atleta');

-- Atleta inattivo ------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select is((select count(*)::int from public.atleti), 0, 'un atleta disattivato non vede più nessuno');

-- Atleta ---------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is((select count(*)::int from public.atleti), 3, 'un atleta vede tutti gli atleti della compagnia');
select is(public.e_membro(), true, 'e_membro è vero per un atleta attivo');
select is(public.e_amministratore(), false, 'un atleta non è amministratore');
select throws_ok(
  $$ insert into public.atleti (matricola, nome, cognome) values ('900010', 'Nuovo', 'Prova') $$,
  '42501', null, 'un atleta non può aggiungere atleti'
);
update public.atleti set nome = 'Cambiato' where matricola = '900001';
select is(
  (select nome from public.atleti where matricola = '900001'), 'Anna',
  'un atleta non può modificare gli altri'
);
update public.atleti set ruolo = 'amministratore' where matricola = '900002';
select is(
  (select ruolo::text from public.atleti where matricola = '900002'), 'atleta',
  'un atleta non può farsi amministratore da solo'
);
delete from public.atleti where matricola = '900003';
select is((select count(*)::int from public.atleti), 3, 'un atleta non può eliminare atleti');

-- Amministratore -------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(public.e_amministratore(), true, 'e_amministratore è vero per l''amministratore');
select lives_ok(
  $$ insert into public.atleti (matricola, nome, cognome) values ('900010', 'Nuovo', 'Prova') $$,
  'l''amministratore aggiunge un atleta'
);
select is(
  (select ruolo::text from public.atleti where matricola = '900010'), 'atleta',
  'un atleta nuovo ha ruolo "atleta" se non indicato'
);
update public.atleti set nome = 'Bruna' where matricola = '900002';
select is(
  (select nome from public.atleti where matricola = '900002'), 'Bruna',
  'l''amministratore modifica un atleta'
);
select throws_ok(
  $$ update public.atleti set utente_id = '00000000-0000-0000-0000-00000000000a' where matricola = '900002' $$,
  '42501', null, 'nemmeno l''amministratore può cambiare a mano il collegamento con l''accesso'
);
select throws_ok(
  $$ insert into public.atleti (matricola, nome, cognome, utente_id) values ('900011', 'X', 'Y', '00000000-0000-0000-0000-00000000000d') $$,
  '42501', null, 'non si può creare un atleta già collegato a un accesso'
);
delete from public.atleti where matricola = '900010';
select is(
  (select count(*)::int from public.atleti where matricola = '900010'), 0,
  'l''amministratore elimina un atleta'
);
reset role;

-- Revoca: eliminando l'accesso tecnico, l'atleta resta ma senza accesso ------------------------
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select is(
  (select utente_id from public.atleti where matricola = '900002'), null,
  'eliminando l''accesso, l''atleta resta senza accesso'
);

select * from finish();
rollback;
