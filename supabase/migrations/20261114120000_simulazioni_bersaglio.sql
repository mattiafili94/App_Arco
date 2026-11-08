-- Fase 6.3a-2b: il tocco sul bersaglio. Si salva anche DOVE è arrivata ogni freccia, e se l'arco è compound.
--
-- `posizioni`: una per freccia, nello stesso ordine di `frecce`. È `null` se la freccia è stata segnata con il
-- tastierino, altrimenti [x, y] normalizzati: (0, 0) è il centro, 1 il bordo esterno della faccia, x verso
-- destra e y verso il basso. Il valore della freccia resta quello in `frecce` (si può sempre correggere).
-- `compound`: solo indoor, il 10 vale solo l'anello piccolo al centro (conta quando si tocca il bersaglio).
--
-- `salva_simulazione` prende due parametri in più: se mancano (o sono null) lasciano questi dati com'erano,
-- così le versioni vecchie dell'app non li cancellano.

alter table public.simulazioni
  add column compound boolean not null default false,
  add column posizioni jsonb not null default '[]'::jsonb,
  add constraint simulazioni_posizioni check (
    jsonb_typeof(posizioni) = 'array'
    and jsonb_array_length(posizioni) <= 144
    and not jsonb_path_exists(
      posizioni,
      'strict $[*] ? (@ != null && !(@.type() == "array" && @.size() == 2 && @[0].type() == "number" && @[1].type() == "number" && @[0] >= -2 && @[0] <= 2 && @[1] >= -2 && @[1] <= 2))'
    )
  ),
  add constraint simulazioni_compound_indoor check (not compound or formato in ('18m', '25m', '25+18m'));

comment on column public.simulazioni.posizioni is
  'Dove è arrivata ogni freccia: [x, y] normalizzati (centro 0,0; bordo 1) o null se segnata col tastierino.';

drop function public.salva_simulazione(
  uuid, uuid, date, text, integer, text, jsonb, boolean, boolean, timestamptz, timestamptz, jsonb
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
  if not public.allenamento_accessibile(p_atleta) then
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

revoke all on function public.salva_simulazione(
  uuid, uuid, date, text, integer, text, jsonb, boolean, boolean, timestamptz, timestamptz, jsonb, jsonb,
  boolean
) from public, anon;
grant execute on function public.salva_simulazione(
  uuid, uuid, date, text, integer, text, jsonb, boolean, boolean, timestamptz, timestamptz, jsonb, jsonb,
  boolean
) to authenticated;
