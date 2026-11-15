-- Fase 3.5d: l'amministratore cambia i turni di un sondaggio già aperto (Mattia, 15/11/2026: i sondaggi aperti
-- prima dei turni, o un turno dimenticato). Stessi controlli dell'apertura. Chi aveva scelto un turno tolto resta
-- "Partecipo" senza turno: nell'app vede la gara gialla "Scegli il turno". Nessuna notifica.

-- I controlli dei turni, comuni ad apertura e modifica.
create function public.controlla_turni(g public.gare, turni text[]) returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  t text;
begin
  if (select count(distinct x) from unnest(turni) x) <> cardinality(turni) then
    raise exception 'Turni ripetuti' using errcode = '22023';
  end if;
  foreach t in array turni loop
    if t !~ '^\d{4}-\d{2}-\d{2}:(mattina|pomeriggio)$'
       or split_part(t, ':', 1)::date not between g.dal and g.al then
      raise exception 'Turno non valido: %', t using errcode = '22023';
    end if;
  end loop;
end;
$$;

revoke all on function public.controlla_turni(public.gare, text[]) from public, anon, authenticated;

create function public.modifica_turni_sondaggio(p_gara text, p_turni text[]) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.gare;
  nuovi text[] := coalesce(p_turni, '{}');
begin
  if not public.e_amministratore() then
    raise exception 'Solo l''amministratore cambia i turni' using errcode = '42501';
  end if;
  select ga.* into g from public.gare ga
  join public.sondaggi s on s.gara_codice = ga.codice
  where ga.codice = p_gara and ga.al >= public.oggi_italia();
  if not found then
    raise exception 'Il sondaggio non c''è o la gara è passata' using errcode = '22023';
  end if;
  perform public.controlla_turni(g, nuovi);

  update public.sondaggi set turni = nuovi where gara_codice = p_gara;
  -- Chi aveva un turno che non c'è più lo deve scegliere di nuovo.
  update public.risposte_sondaggio set turno = null
  where gara_codice = p_gara and turno is not null and not (turno = any (nuovi));
end;
$$;

revoke all on function public.modifica_turni_sondaggio(text, text[]) from public, anon;
grant execute on function public.modifica_turni_sondaggio(text, text[]) to authenticated;

-- Un turno tolto dall'amministratore non è una risposta nuova: niente avviso "nuove risposte". (Un atleta non può
-- togliersi il turno restando "Partecipo": l'app manda sempre il turno, le app vecchie lasciano quello che c'era.)
create or replace function public.accoda_avviso_risposta() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.partecipa is not distinct from old.partecipa
     and (new.turno is not distinct from old.turno or new.turno is null) then
    return new;
  end if;
  if exists (select 1 from public.atleti where id = new.atleta_id and ruolo = 'amministratore') then
    return new;
  end if;
  insert into public.avvisi_sondaggio (gara_codice, tipo, risposte)
  values (new.gara_codice, 'risposte', 1)
  on conflict (gara_codice, tipo) where inviato_il is null
  do update set risposte = public.avvisi_sondaggio.risposte + 1;
  return new;
end;
$$;
