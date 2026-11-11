-- Fase 7.1: il ruolo ALLENATORE (Mattia, 11/11/2026).
--
-- - L'allenatore è un atleta con in più il ruolo (`atleti.allenatore`), dato o tolto dall'amministratore.
-- - Sceglie DA SOLO quali atleti seguire (`allenatori_atleti`, con `segui_atleta`). L'atleta vede chi lo segue.
-- - Di chi segue VEDE tutto l'allenamento (settimana, note, frecce, simulazioni) e SCRIVE solo il PROGRAMMA.
-- - Il programma ha una sua data di modifica e un suo autore (`programma_modificato_il`, `programma_modificato_da`):
--   allenatore e atleta lo possono cambiare tutti e due e vince la modifica più recente del programma, senza
--   toccare "fatto", frecce e nota dell'atleta (che hanno la loro data, `modificato_il`).
-- - Tolto il ruolo, l'allenatore smette di seguire tutti (e non vede più niente).
-- Tutto passa da `allenamento_accessibile`, come previsto dalla Fase 6.1.

-- Il ruolo ----------------------------------------------------------------------------------------------------
alter table public.atleti add column allenatore boolean not null default false;
comment on column public.atleti.allenatore is 'Ha il ruolo di allenatore (lo dà o lo toglie l''amministratore).';

-- L'amministratore lo cambia come gli altri campi dell'atleta (stessa regola "L'amministratore modifica gli atleti").
grant update (allenatore) on table public.atleti to authenticated;

-- Chi segue chi ------------------------------------------------------------------------------------------------
create table public.allenatori_atleti (
  allenatore_id uuid not null references public.atleti (id) on delete cascade,
  atleta_id uuid not null references public.atleti (id) on delete cascade,
  aggiornato_il timestamptz not null default now(),
  primary key (allenatore_id, atleta_id),
  check (allenatore_id <> atleta_id)
);

comment on table public.allenatori_atleti is 'Gli atleti che ogni allenatore ha scelto di seguire.';

create index allenatori_atleti_atleta on public.allenatori_atleti (atleta_id);

create trigger allenatori_atleti_data_modifica
before update on public.allenatori_atleti
for each row execute function public.aggiorna_data_modifica();

-- I telefoni sanno anche quando una riga sparisce (smette di seguire).
create trigger allenatori_atleti_eliminazione after delete on public.allenatori_atleti
for each row execute function public.registra_eliminazione('allenatore_id', 'atleta_id');

alter table public.allenatori_atleti enable row level security;
revoke all on table public.allenatori_atleti from anon, authenticated;
grant select on table public.allenatori_atleti to authenticated;
grant select, insert, update, delete on table public.allenatori_atleti to service_role;

-- L'atleta collegato a chi sta usando l'app (null se nessuno).
create function public.mio_atleta_id() returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.atleti where utente_id = auth.uid() and attivo;
$$;

revoke all on function public.mio_atleta_id() from public, anon;
grant execute on function public.mio_atleta_id() to authenticated, service_role;

-- L'allenatore vede chi segue; l'atleta vede chi lo segue.
create policy "Allenatore e atleta vedono chi segue chi" on public.allenatori_atleti
for select to authenticated
using (allenatore_id = public.mio_atleta_id() or atleta_id = public.mio_atleta_id());

-- Seguire o smettere di seguire un atleta: solo un allenatore attivo, solo atleti attivi, mai sé stesso.
create function public.segui_atleta(p_atleta uuid, p_segui boolean) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := public.mio_atleta_id();
begin
  if io is null or not exists (select 1 from public.atleti where id = io and allenatore) then
    raise exception 'Solo un allenatore può seguire gli atleti' using errcode = '42501';
  end if;
  if p_atleta = io or not exists (select 1 from public.atleti where id = p_atleta and attivo) then
    raise exception 'Atleta non valido' using errcode = '22023';
  end if;
  if p_segui then
    insert into public.allenatori_atleti (allenatore_id, atleta_id) values (io, p_atleta)
    on conflict do nothing;
  else
    delete from public.allenatori_atleti where allenatore_id = io and atleta_id = p_atleta;
  end if;
  return p_segui;
end;
$$;

revoke all on function public.segui_atleta(uuid, boolean) from public, anon;
grant execute on function public.segui_atleta(uuid, boolean) to authenticated;

-- Tolto il ruolo (o disattivato l'atleta), l'allenatore smette di seguire tutti.
create function public.allenatore_tolto() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.allenatore and not new.allenatore) or (old.attivo and not new.attivo) then
    delete from public.allenatori_atleti where allenatore_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.allenatore_tolto() from public, anon, authenticated;

create trigger atleti_allenatore_tolto after update of allenatore, attivo on public.atleti
for each row execute function public.allenatore_tolto();

-- Chi vede l'allenamento ---------------------------------------------------------------------------------------
-- L'atleta stesso, oppure un allenatore (con il ruolo) che lo segue.
create or replace function public.allenamento_accessibile(p_atleta uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.atleti
    where id = p_atleta and utente_id = auth.uid() and attivo
  ) or exists (
    select 1
    from public.allenatori_atleti s
    join public.atleti a on a.id = s.allenatore_id
    where s.atleta_id = p_atleta and a.utente_id = auth.uid() and a.attivo and a.allenatore
  );
$$;

-- L'allenamento è proprio (solo l'atleta, non l'allenatore): serve per ciò che solo l'atleta scrive.
create function public.allenamento_proprio(p_atleta uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.atleti
    where id = p_atleta and utente_id = auth.uid() and attivo
  );
$$;

revoke all on function public.allenamento_proprio(uuid) from public, anon;
grant execute on function public.allenamento_proprio(uuid) to authenticated, service_role;

-- Il programma con la sua data e il suo autore ----------------------------------------------------------------
alter table public.allenamento_giorni
  add column programma_modificato_il timestamptz,
  add column programma_modificato_da uuid references public.atleti (id) on delete set null;

-- Le righe che ci sono già: il programma l'ha scritto l'atleta, quando ha modificato la riga.
update public.allenamento_giorni
set programma_modificato_il = modificato_il, programma_modificato_da = atleta_id;

alter table public.allenamento_giorni alter column programma_modificato_il set not null;

comment on column public.allenamento_giorni.programma_modificato_il is
  'Quando è stato cambiato il programma (ora del telefono): vince la modifica più recente del programma.';
comment on column public.allenamento_giorni.programma_modificato_da is
  'Chi ha cambiato il programma per ultimo: l''atleta o un suo allenatore.';

-- Salvare un giorno, ora anche dall'allenatore.
-- - L'atleta: "fatto", frecce e nota con la regola di sempre (`modificato_il`); il programma con la sua data.
-- - L'allenatore: SOLO il programma (il resto non lo tocca, anche se lo manda).
-- - Programma: vince la modifica più recente del programma (`p_programma_modificato_il`). Le versioni vecchie
--   dell'app non mandano questa data: allora il programma si cambia solo se l'ultimo a scriverlo è stato
--   l'atleta stesso (o nessuno), così un telefono vecchio non cancella mai il programma dell'allenatore.
-- - Una riga creata dall'allenatore ha `modificato_il` al 1970: qualsiasi modifica dell'atleta la supera.
drop function public.salva_allenamento_giorno(uuid, date, text, boolean, integer, text, timestamptz);

create function public.salva_allenamento_giorno(
  p_atleta uuid,
  p_giorno date,
  p_programma text,
  p_fatto boolean,
  p_frecce_libere integer,
  p_nota text,
  p_modificato_il timestamptz,
  p_programma_modificato_il timestamptz default null
) returns public.allenamento_giorni
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := public.mio_atleta_id();
  proprio boolean := public.allenamento_proprio(p_atleta);
  quando_programma timestamptz := coalesce(p_programma_modificato_il, p_modificato_il);
  r public.allenamento_giorni;
begin
  if not public.allenamento_accessibile(p_atleta) then
    raise exception 'Accesso non valido' using errcode = '42501';
  end if;

  insert into public.allenamento_giorni
    (atleta_id, giorno, programma, fatto, frecce_libere, nota, modificato_il, programma_modificato_il,
     programma_modificato_da)
  values (
    p_atleta, p_giorno, p_programma,
    case when proprio then p_fatto else false end,
    case when proprio then p_frecce_libere else 0 end,
    case when proprio then p_nota else '' end,
    case when proprio then p_modificato_il else 'epoch'::timestamptz end,
    quando_programma, io
  )
  on conflict (atleta_id, giorno) do nothing;

  if not found then
    -- La riga c'era già. Prima i campi dell'atleta (solo lui li scrive)…
    if proprio then
      update public.allenamento_giorni
      set fatto = p_fatto,
          frecce_libere = p_frecce_libere,
          nota = p_nota,
          modificato_il = p_modificato_il
      where atleta_id = p_atleta and giorno = p_giorno and modificato_il < p_modificato_il;
    end if;
    -- …poi il programma, con la sua data.
    update public.allenamento_giorni
    set programma = p_programma,
        programma_modificato_il = quando_programma,
        programma_modificato_da = io
    where atleta_id = p_atleta and giorno = p_giorno
      and programma_modificato_il < quando_programma
      and programma is distinct from p_programma
      and (p_programma_modificato_il is not null
           or programma_modificato_da is null
           or programma_modificato_da = io);
  end if;

  select * into r from public.allenamento_giorni
  where atleta_id = p_atleta and giorno = p_giorno;
  return r;
end;
$$;

revoke all on function public.salva_allenamento_giorno(
  uuid, date, text, boolean, integer, text, timestamptz, timestamptz
) from public, anon;
grant execute on function public.salva_allenamento_giorno(
  uuid, date, text, boolean, integer, text, timestamptz, timestamptz
) to authenticated;

-- Le simulazioni le scrive solo l'atleta: l'allenatore le vede (regola di lettura con `allenamento_accessibile`)
-- ma non le può cambiare. Stessa funzione di prima, con il controllo `allenamento_proprio`.
create or replace function public.salva_simulazione(
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
  p_modificato_il timestamptz,
  p_note jsonb default null,
  p_posizioni jsonb default null,
  p_compound boolean default null
) returns public.simulazioni
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.simulazioni;
begin
  if not public.allenamento_proprio(p_atleta) then
    raise exception 'Accesso non valido' using errcode = '42501';
  end if;
  if exists (select 1 from public.simulazioni where id = p_id and atleta_id <> p_atleta) then
    raise exception 'Accesso non valido' using errcode = '42501';
  end if;

  insert into public.simulazioni
    (id, atleta_id, giorno, formato, distanza, bersaglio, frecce, note, posizioni, compound, conclusa,
     eliminata, creata_il, modificato_il)
  values
    (p_id, p_atleta, p_giorno, p_formato, p_distanza, p_bersaglio, p_frecce, coalesce(p_note, '{}'::jsonb),
     coalesce(p_posizioni, '[]'::jsonb), coalesce(p_compound, false), p_conclusa, p_eliminata, p_creata_il,
     p_modificato_il)
  on conflict (id) do update
  set giorno = excluded.giorno,
      formato = excluded.formato,
      distanza = excluded.distanza,
      bersaglio = excluded.bersaglio,
      frecce = excluded.frecce,
      note = case when p_note is null then public.simulazioni.note else p_note end,
      posizioni = case when p_posizioni is null then public.simulazioni.posizioni else p_posizioni end,
      compound = case when p_compound is null then public.simulazioni.compound else p_compound end,
      conclusa = excluded.conclusa,
      eliminata = excluded.eliminata,
      modificato_il = excluded.modificato_il
  where public.simulazioni.modificato_il < excluded.modificato_il;

  select * into r from public.simulazioni where id = p_id;
  return r;
end;
$$;
