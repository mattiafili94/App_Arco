-- Fase 7.3: l'avviso all'atleta quando un suo allenatore cambia il programma (Mattia, 11/11/2026).
--
-- - Ogni telefono registrato sceglie quali avvisi ricevere: "Nuovi inviti" e/o "Programma dell'allenatore"
--   (`iscrizioni_push.inviti`, `iscrizioni_push.programma`, con `imposta_avvisi`). I telefoni già registrati
--   ricevono tutti e due, come se li avessero accesi.
-- - Quando l'allenatore cambia il programma di un giorno, si mette in coda UN avviso per atleta, allenatore e
--   settimana (`avvisi_programma`): tante modifiche di fila diventano un avviso solo. Il server lo manda al giro
--   del controllo automatico, quando l'allenatore ha finito di scrivere da almeno 10 minuti, SOLO ai telefoni di
--   quell'atleta.
-- - Le tabelle le usa solo il server, come le notifiche degli inviti.

-- Quali avvisi riceve ogni telefono ------------------------------------------------------------------------------
alter table public.iscrizioni_push
  add column inviti boolean not null default true,
  add column programma boolean not null default true;

-- Il telefono di chi è collegato sceglie i suoi avvisi (solo il proprio).
create function public.imposta_avvisi(p_endpoint text, p_inviti boolean, p_programma boolean) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.iscrizioni_push
  set inviti = p_inviti, programma = p_programma
  where endpoint = p_endpoint
    and atleta_id in (select id from public.atleti where utente_id = auth.uid() and attivo);
  return found;
end;
$$;

revoke all on function public.imposta_avvisi(text, boolean, boolean) from public, anon;
grant execute on function public.imposta_avvisi(text, boolean, boolean) to authenticated;

-- La coda degli avvisi del programma -----------------------------------------------------------------------------
create table public.avvisi_programma (
  id bigint generated always as identity primary key,
  atleta_id uuid not null references public.atleti (id) on delete cascade,
  allenatore_id uuid not null references public.atleti (id) on delete cascade,
  -- Il lunedì della settimana del giorno cambiato.
  settimana date not null,
  creato_il timestamptz not null default now(),
  -- L'ultima modifica dell'allenatore (l'avviso parte quando ha finito di scrivere).
  ultima_modifica_il timestamptz not null default now(),
  -- Vuota finché l'avviso non è stato mandato.
  inviato_il timestamptz
);

-- Un solo avviso in attesa per atleta, allenatore e settimana.
create unique index avvisi_programma_in_attesa
  on public.avvisi_programma (atleta_id, allenatore_id, settimana)
  where inviato_il is null;

alter table public.avvisi_programma enable row level security;
revoke all on table public.avvisi_programma from anon, authenticated;
grant select, insert, update, delete on table public.avvisi_programma to service_role;

-- Quando il programma cambia ed è stato un allenatore (non l'atleta), si mette in coda l'avviso.
create function public.accoda_avviso_programma() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.programma_modificato_da is null or new.programma_modificato_da = new.atleta_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.programma is not distinct from old.programma then
    return new;
  end if;
  if new.programma = '' and tg_op = 'INSERT' then
    return new;
  end if;
  insert into public.avvisi_programma (atleta_id, allenatore_id, settimana)
  values (
    new.atleta_id,
    new.programma_modificato_da,
    (new.giorno - (extract(isodow from new.giorno)::int - 1))
  )
  on conflict (atleta_id, allenatore_id, settimana) where inviato_il is null
  do update set ultima_modifica_il = now();
  return new;
end;
$$;

revoke all on function public.accoda_avviso_programma() from public, anon, authenticated;

create trigger allenamento_giorni_avviso_programma
after insert or update of programma on public.allenamento_giorni
for each row execute function public.accoda_avviso_programma();
