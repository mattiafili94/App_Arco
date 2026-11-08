-- Fase 5.2: "La tua posizione" nel tab Classifica.
--
-- Ogni classifica ha centinaia di atleti (~150 KB): per mostrare a un atleta solo la sua riga non serve
-- scaricarle tutte. Questa funzione restituisce, per le classifiche in cui compare la matricola, il
-- titolo, la data e SOLO la sua riga. Come ogni lettura delle classifiche, la vedono solo i membri
-- (la funzione usa i permessi di chi la chiama).

create function public.mie_classifiche(p_matricola text)
returns table (
  tipo text,
  divisione text,
  classe text,
  genere text,
  categoria text,
  totale integer,
  letta_il timestamptz,
  aggiornato_il timestamptz,
  riga jsonb
)
language sql
stable
set search_path = ''
as $$
  select c.tipo, c.divisione, c.classe, c.genere, c.categoria, c.totale, c.letta_il, c.aggiornato_il,
    mia.riga
  from public.classifiche_ranking c
  cross join lateral (
    select e.riga
    from jsonb_array_elements(c.righe) as e(riga)
    where e.riga ->> 'matricola' = p_matricola
    limit 1
  ) as mia
  order by c.tipo, c.divisione, c.classe, c.genere;
$$;

revoke all on function public.mie_classifiche(text) from public, anon;
grant execute on function public.mie_classifiche(text) to authenticated, service_role;
