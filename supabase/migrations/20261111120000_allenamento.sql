-- Fase 6.1: allenamento settimanale (privato).
--
-- Per ogni atleta e ogni giorno: cosa deve fare (testo libero), se l'ha fatto, quante frecce ha tirato
-- liberamente e una nota. Le simulazioni di gara arriveranno con il segnapunti (Fase 6.3).
--
-- Regole:
-- - i dati sono PRIVATI: li legge solo l'atleta a cui appartengono (nemmeno l'amministratore). In futuro
--   l'allenatore, un ruolo a parte, potrà modificarli: basterà aggiungere il suo caso a
--   `allenamento_accessibile`, senza toccare tabelle, regole o app;
-- - nessuna scrittura diretta: si salva con `salva_allenamento_giorno`, che fa vincere la modifica
--   PIÙ RECENTE (ora del telefono di chi ha modificato, `modificato_il`): il telefono scrive anche
--   offline e invia quando torna la rete, da più telefoni la sequenza non conta;
-- - ogni riga ha `aggiornato_il` (ora del server): i telefoni scaricano solo le novità.

-- Chi può vedere e modificare l'allenamento di un atleta. Oggi solo l'atleta stesso (attivo).
create function public.allenamento_accessibile(p_atleta uuid) returns boolean
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

revoke all on function public.allenamento_accessibile(uuid) from public, anon;
grant execute on function public.allenamento_accessibile(uuid) to authenticated, service_role;

create table public.allenamento_giorni (
  atleta_id uuid not null references public.atleti (id) on delete cascade,
  giorno date not null,
  -- Cosa deve fare in quel giorno (testo libero).
  programma text not null default '' check (char_length(programma) <= 2000),
  fatto boolean not null default false,
  -- Frecce tirate liberamente (le simulazioni di gara si contano a parte).
  frecce_libere integer not null default 0 check (frecce_libere between 0 and 9999),
  nota text not null default '' check (char_length(nota) <= 4000),
  -- Quando l'atleta ha fatto la modifica (ora del suo telefono): vince la più recente.
  modificato_il timestamptz not null,
  aggiornato_il timestamptz not null default now(),
  primary key (atleta_id, giorno)
);

comment on table public.allenamento_giorni is 'Allenamento di un atleta, un giorno per riga. Privato.';

create index allenamento_giorni_aggiornato_il on public.allenamento_giorni (atleta_id, aggiornato_il);

create trigger allenamento_giorni_data_modifica
before update on public.allenamento_giorni
for each row execute function public.aggiorna_data_modifica();

alter table public.allenamento_giorni enable row level security;

revoke all on table public.allenamento_giorni from anon, authenticated;
grant select on table public.allenamento_giorni to authenticated;
grant select, insert, update, delete on table public.allenamento_giorni to service_role;

create policy "Ognuno vede il proprio allenamento" on public.allenamento_giorni
for select to authenticated using (public.allenamento_accessibile(atleta_id));

-- Salva un giorno. Se sul server c'è già una modifica più recente, resta quella (a parità, resta quella del
-- server). Restituisce sempre la riga che vale adesso: il telefono la tiene com'è.
create function public.salva_allenamento_giorno(
  p_atleta uuid,
  p_giorno date,
  p_programma text,
  p_fatto boolean,
  p_frecce_libere integer,
  p_nota text,
  p_modificato_il timestamptz
) returns public.allenamento_giorni
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.allenamento_giorni;
begin
  if not public.allenamento_accessibile(p_atleta) then
    raise exception 'Accesso non valido' using errcode = '42501';
  end if;

  insert into public.allenamento_giorni
    (atleta_id, giorno, programma, fatto, frecce_libere, nota, modificato_il)
  values
    (p_atleta, p_giorno, p_programma, p_fatto, p_frecce_libere, p_nota, p_modificato_il)
  on conflict (atleta_id, giorno) do update
  set programma = excluded.programma,
      fatto = excluded.fatto,
      frecce_libere = excluded.frecce_libere,
      nota = excluded.nota,
      modificato_il = excluded.modificato_il
  where public.allenamento_giorni.modificato_il < excluded.modificato_il;

  select * into r from public.allenamento_giorni
  where atleta_id = p_atleta and giorno = p_giorno;
  return r;
end;
$$;

revoke all on function public.salva_allenamento_giorno(uuid, date, text, boolean, integer, text, timestamptz)
  from public, anon;
grant execute on function public.salva_allenamento_giorno(uuid, date, text, boolean, integer, text, timestamptz)
  to authenticated;
