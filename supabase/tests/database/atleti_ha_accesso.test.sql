-- Test di `atleti.ha_accesso` (pgTAP): il tab Atleti sa chi ha il link senza vedere `utente_id`. Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a5', 'amministratore5@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b5', 'atleta5@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000a5', '900501', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000a5'),
  ('10000000-0000-0000-0000-0000000000b5', '900502', 'Bruno', 'Prova', 'atleta', null);

select is(
  (select ha_accesso from public.atleti where matricola = '900501'), true,
  'chi ha un utente collegato ha l''accesso'
);
select is(
  (select ha_accesso from public.atleti where matricola = '900502'), false,
  'chi non ha un utente collegato non ha l''accesso'
);

-- Generare il link collega un utente: `ha_accesso` cambia e i telefoni scaricano la novità.
update public.atleti set aggiornato_il = '2020-01-01' where matricola = '900502';
update public.atleti set utente_id = '00000000-0000-0000-0000-0000000000b5' where matricola = '900502';
select is(
  (select ha_accesso from public.atleti where matricola = '900502'), true,
  'dopo aver generato il link ha l''accesso'
);
select cmp_ok(
  (select aggiornato_il from public.atleti where matricola = '900502'), '>', '2020-01-01'::timestamptz,
  'la modifica aggiorna aggiornato_il (i telefoni la scaricano)'
);

-- Il campo è calcolato: nessuno lo scrive a mano.
set local role service_role;
select throws_ok(
  $$ update public.atleti set ha_accesso = false where matricola = '900501' $$,
  '428C9', null, 'ha_accesso non si scrive a mano'
);
reset role;

select * from finish();
rollback;
