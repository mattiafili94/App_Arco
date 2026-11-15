-- Test del ruolo tecnico regionale (pgTAP): lo dà solo l'amministratore. Dati inventati.

begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a9', 'amministratore9@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b9', 'atleta9@test.invalid');
insert into public.atleti (id, matricola, nome, cognome, ruolo, utente_id) values
  ('10000000-0000-0000-0000-0000000000a9', '900901', 'Anna', 'Prova', 'amministratore', '00000000-0000-0000-0000-0000000000a9'),
  ('10000000-0000-0000-0000-0000000000b9', '900902', 'Bruno', 'Prova', 'atleta', '00000000-0000-0000-0000-0000000000b9');

select is(
  (select tecnico_regionale from public.atleti where id = '10000000-0000-0000-0000-0000000000b9'), false,
  'di base nessuno è tecnico regionale'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b9", "role": "authenticated"}';
update public.atleti set tecnico_regionale = true where id = '10000000-0000-0000-0000-0000000000b9';
reset role;
select is(
  (select tecnico_regionale from public.atleti where id = '10000000-0000-0000-0000-0000000000b9'), false,
  'un atleta non si dà da solo il ruolo'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a9", "role": "authenticated"}';
update public.atleti set tecnico_regionale = true where id = '10000000-0000-0000-0000-0000000000b9';
select is(
  (select tecnico_regionale from public.atleti where id = '10000000-0000-0000-0000-0000000000b9'), true,
  'l''amministratore dà il ruolo'
);
update public.atleti set tecnico_regionale = false where id = '10000000-0000-0000-0000-0000000000b9';
select is(
  (select tecnico_regionale from public.atleti where id = '10000000-0000-0000-0000-0000000000b9'), false,
  'e lo toglie'
);
reset role;

select * from finish();
rollback;
