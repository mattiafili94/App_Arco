-- Fase 6.3a: simulazioni di gara a bersaglio (segnapunti), private come l'allenamento.
--
-- Una riga per simulazione: formato, bersaglio e TUTTE le frecce segnate, nell'ordine ('X', '10'…'1', 'M').
-- Volée, prove, parziali e totali si ricalcolano dalle frecce (regole in packages/shared/src/segnapunti.ts).
--
-- Regole (le stesse di `allenamento_giorni`, migrazione 20261111120000):
-- - privata: la legge solo l'atleta, nemmeno l'amministratore (`allenamento_accessibile`);
-- - nessuna scrittura diretta: si salva con `salva_simulazione`, che fa vincere la modifica più recente;
-- - "cancellata" è un segno (`eliminata`), non una riga tolta: così la cancellazione arriva a tutti i telefoni.

create table public.simulazioni (
  -- Generato sul telefono: la stessa simulazione ha lo stesso id su tutti i telefoni.
  id uuid primary key,
  atleta_id uuid not null references public.atleti (id) on delete cascade,
  giorno date not null,
  formato text not null check (formato in ('18m', '25m', '25+18m', '70m', 'doppio70m')),
  -- Solo outdoor: la distanza vera (70, 60 o 50 m).
  distanza integer check (distanza in (70, 60, 50)),
  bersaglio text not null check (bersaglio in ('singolo', 'trispot', '122', '80')),
  frecce jsonb not null default '[]'::jsonb,
  conclusa boolean not null default false,
  eliminata boolean not null default false,
  creata_il timestamptz not null,
  -- Quando l'atleta ha fatto la modifica (ora del suo telefono): vince la più recente.
  modificato_il timestamptz not null,
  aggiornato_il timestamptz not null default now(),
  -- Indoor: bersaglio singolo o trispot, nessuna distanza; outdoor: 122 o 80 cm, con la distanza.
  constraint simulazioni_bersaglio_formato check (
    (formato in ('18m', '25m', '25+18m') and bersaglio in ('singolo', 'trispot') and distanza is null)
    or (formato in ('70m', 'doppio70m') and bersaglio in ('122', '80') and distanza is not null)
  ),
  -- Un elenco di valori ammessi, mai più delle frecce previste dal formato.
  constraint simulazioni_frecce check (
    jsonb_typeof(frecce) = 'array'
    and jsonb_array_length(frecce) <= case formato
      when '25+18m' then 120
      when '70m' then 72
      when 'doppio70m' then 144
      else 60
    end
    and not jsonb_path_exists(
      frecce,
      'strict $[*] ? (!(@ == "X" || @ == "10" || @ == "9" || @ == "8" || @ == "7" || @ == "6" || @ == "5" || @ == "4" || @ == "3" || @ == "2" || @ == "1" || @ == "M"))'
    )
  )
);

comment on table public.simulazioni is 'Simulazioni di gara a bersaglio di un atleta, con tutte le frecce. Privata.';

create index simulazioni_atleta on public.simulazioni (atleta_id, aggiornato_il);
create index simulazioni_giorno on public.simulazioni (atleta_id, giorno);

create trigger simulazioni_data_modifica
before update on public.simulazioni
for each row execute function public.aggiorna_data_modifica();

alter table public.simulazioni enable row level security;

revoke all on table public.simulazioni from anon, authenticated;
grant select on table public.simulazioni to authenticated;
grant select, insert, update, delete on table public.simulazioni to service_role;

create policy "Ognuno vede le proprie simulazioni" on public.simulazioni
for select to authenticated using (public.allenamento_accessibile(atleta_id));

-- Salva una simulazione. Se sul server c'è già una modifica più recente, resta quella (a parità, resta quella
-- del server). Una simulazione non passa mai da un atleta a un altro. Restituisce la riga che vale adesso.
create function public.salva_simulazione(
  p_id uuid,
  p_atleta uuid,
  p_giorno date,
  p_formato text,
  p_distanza integer,
  p_bersaglio text,
  p_frecce jsonb,
  p_conclusa boolean,
  p_eliminata boolean,
  p_creata_il timestamptz,
  p_modificato_il timestamptz
) returns public.simulazioni
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.simulazioni;
begin
  if not public.allenamento_accessibile(p_atleta) then
    raise exception 'Accesso non valido' using errcode = '42501';
  end if;
  if exists (select 1 from public.simulazioni where id = p_id and atleta_id <> p_atleta) then
    raise exception 'Accesso non valido' using errcode = '42501';
  end if;

  insert into public.simulazioni
    (id, atleta_id, giorno, formato, distanza, bersaglio, frecce, conclusa, eliminata, creata_il, modificato_il)
  values
    (p_id, p_atleta, p_giorno, p_formato, p_distanza, p_bersaglio, p_frecce, p_conclusa, p_eliminata,
     p_creata_il, p_modificato_il)
  on conflict (id) do update
  set giorno = excluded.giorno,
      formato = excluded.formato,
      distanza = excluded.distanza,
      bersaglio = excluded.bersaglio,
      frecce = excluded.frecce,
      conclusa = excluded.conclusa,
      eliminata = excluded.eliminata,
      modificato_il = excluded.modificato_il
  where public.simulazioni.modificato_il < excluded.modificato_il;

  select * into r from public.simulazioni where id = p_id;
  return r;
end;
$$;

revoke all on function public.salva_simulazione(
  uuid, uuid, date, text, integer, text, jsonb, boolean, boolean, timestamptz, timestamptz
) from public, anon;
grant execute on function public.salva_simulazione(
  uuid, uuid, date, text, integer, text, jsonb, boolean, boolean, timestamptz, timestamptz
) to authenticated;
