-- Lo stato da cui la funzione aggiorna-fitarco decide cosa leggere (motore.ts, `StatoArchivio`).
-- La chiama solo il server.
--
-- - ultimeLetture: per ogni cosa letta (tipo + chiave), il giorno italiano dell'ultima lettura riuscita;
-- - anniStorico: gli anni delle gare negli storici dei nostri atleti;
-- - gare: con "ci sono nostri atleti?" e "la classifica salvata è provvisoria?" (null se non c'è);
-- - atleti: quelli attivi.

create function public.stato_aggiornamento() returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'ultimeLetture', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', u.tipo, 'chiave', u.chiave, 'letto_il', u.letto_il))
      from (
        select distinct on (l.tipo, l.chiave)
          l.tipo, l.chiave, to_char(l.creato_il at time zone 'Europe/Rome', 'YYYY-MM-DD') as letto_il
        from public.letture l
        where l.esito <> 'errore'
        order by l.tipo, l.chiave, l.creato_il desc
      ) u
    ), '[]'::jsonb),
    'anniStorico', coalesce((
      select jsonb_agg(distinct extract(year from g.dal)::integer)
      from public.partecipazioni p
      join public.gare g on g.codice = p.gara_codice
    ), '[]'::jsonb),
    'gare', coalesce((
      select jsonb_agg(jsonb_build_object(
        'codice', g.codice,
        'dal', g.dal,
        'al', g.al,
        'stato', g.stato,
        'in_calendario_umbria', g.in_calendario_umbria,
        'ha_invito', g.ha_invito,
        'url_risultati', g.url_risultati,
        'con_partecipanti', exists (select 1 from public.partecipazioni p where p.gara_codice = g.codice),
        'classifica_provvisoria', (
          select bool_or(c.provvisoria) from public.classifiche c where c.gara_codice = g.codice
        )
      ))
      from public.gare g
    ), '[]'::jsonb),
    'atleti', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id)) from public.atleti a where a.attivo
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.stato_aggiornamento() from public, anon, authenticated;
grant execute on function public.stato_aggiornamento() to service_role;
