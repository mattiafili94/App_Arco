-- Fase 6.3a-2: note facoltative per volée nelle simulazioni.
--
-- `note` è un oggetto { "3": "vento forte" }: la chiave è il numero della volée contato da zero su tutta la
-- simulazione. Valgono le stesse regole del resto della riga (privata, vince la modifica più recente).
--
-- `salva_simulazione` prende un parametro in più, `p_note`, che se manca (o è null) lascia le note com'erano:
-- le versioni vecchie dell'app, che non le conoscono, non le cancellano.

alter table public.simulazioni
  add column note jsonb not null default '{}'::jsonb,
  add constraint simulazioni_note check (
    jsonb_typeof(note) = 'object' and octet_length(note::text) <= 20000
  );

comment on column public.simulazioni.note is 'Note per volée: { "indice della volée (da 0)": "testo" }.';

drop function public.salva_simulazione(
  uuid, uuid, date, text, integer, text, jsonb, boolean, boolean, timestamptz, timestamptz
);

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
  p_modificato_il timestamptz,
  p_note jsonb default null
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
    (id, atleta_id, giorno, formato, distanza, bersaglio, frecce, note, conclusa, eliminata, creata_il,
     modificato_il)
  values
    (p_id, p_atleta, p_giorno, p_formato, p_distanza, p_bersaglio, p_frecce, coalesce(p_note, '{}'::jsonb),
     p_conclusa, p_eliminata, p_creata_il, p_modificato_il)
  on conflict (id) do update
  set giorno = excluded.giorno,
      formato = excluded.formato,
      distanza = excluded.distanza,
      bersaglio = excluded.bersaglio,
      frecce = excluded.frecce,
      note = case when p_note is null then public.simulazioni.note else p_note end,
      conclusa = excluded.conclusa,
      eliminata = excluded.eliminata,
      modificato_il = excluded.modificato_il
  where public.simulazioni.modificato_il < excluded.modificato_il;

  select * into r from public.simulazioni where id = p_id;
  return r;
end;
$$;

revoke all on function public.salva_simulazione(
  uuid, uuid, date, text, integer, text, jsonb, boolean, boolean, timestamptz, timestamptz, jsonb
) from public, anon;
grant execute on function public.salva_simulazione(
  uuid, uuid, date, text, integer, text, jsonb, boolean, boolean, timestamptz, timestamptz, jsonb
) to authenticated;
