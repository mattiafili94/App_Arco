-- Calendari solo dell'anno in corso (Mattia, 8/11/2026): le gare degli anni passati restano nel database
-- solo se un nostro atleta le ha fatte (sono nel suo storico). Questa funzione toglie le altre (con le loro
-- classifiche e inviti); la chiama il server a ogni giro con il primo giorno dell'anno in corso.
-- Inoltre stato_aggiornamento() non restituisce più gli anni degli storici (non servono più).

create function public.pota_gare(p_prima_del date) returns integer
language plpgsql
set search_path = ''
as $$
declare
  tolte integer;
begin
  delete from public.gare g
  where g.dal < p_prima_del
    and not exists (select 1 from public.partecipazioni p where p.gara_codice = g.codice);
  get diagnostics tolte = row_count;
  return tolte;
end;
$$;

revoke all on function public.pota_gare(date) from public, anon, authenticated;
grant execute on function public.pota_gare(date) to service_role;

create or replace function public.stato_aggiornamento() returns jsonb
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


-- (permessi invariati: "create or replace" mantiene quelli già dati)
