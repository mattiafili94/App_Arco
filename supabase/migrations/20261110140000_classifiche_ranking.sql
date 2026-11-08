-- Fase 5: classifiche (ranking) complete, per il tab Classifica.
--
-- Fitarco pubblica, per ogni tipo di gara (indoor, outdoor, campagna, 3D), arco, classe e genere, la
-- classifica nazionale degli atleti con i punti totali e le due gare che contano. Il server la scarica
-- intera (una richiesta per classifica) e la salva qui. Cercare con i filtri, nell'app, legge solo
-- questa tabella: a Fitarco si chiede solo il lunedì alle 10 e con il pulsante "Aggiorna"
-- (almeno 6 ore tra due letture della stessa classifica).
--
-- Regole:
-- - i membri LEGGONO le classifiche (ognuna è una riga: l'app ne scarica una alla volta);
-- - le scrive solo il server (funzione `salva_classifica_ranking`, con la chiave di servizio);
-- - la tabella `ranking` fatta in precedenza (solo i nostri atleti, mai riempita) non serve più: la
--   posizione dei nostri atleti si ricava dalla classifica completa. NON si elimina ora: i telefoni con
--   la versione vecchia dell'app la chiedono ancora a ogni sincronizzazione e si romperebbero. Si toglie
--   (con la sua funzione `salva_ranking`) in una migrazione successiva, quando tutti hanno aggiornato.

create table public.classifiche_ranking (
  -- I indoor, T targa (outdoor), C campagna, 3 3D.
  tipo text not null check (tipo in ('I', 'T', 'C', '3')),
  divisione text not null check (divisione ~ '^[A-Z][A-Z0-9]$'),
  classe text not null check (classe in ('M', 'S', 'J', 'A', 'R')),
  genere text not null check (genere in ('M', 'F')),
  -- "Arco Ricurvo - Seniores Maschile", come la scrive Fitarco.
  categoria text not null,
  -- Quanti atleti dichiara Fitarco ("Numero totale").
  totale integer not null check (totale >= 0),
  -- [{ "posizione": 1, "matricola": "…", "nome": "ROSSI Mario", "societa_codice": "11003",
  --    "societa_nome": "…", "punti": 1100, "gare": [{ "codice", "punti", "localita", "dal", "al" }] }]
  righe jsonb not null default '[]'::jsonb,
  -- Ultima lettura riuscita da Fitarco: serve al limite delle 6 ore del pulsante "Aggiorna".
  letta_il timestamptz not null default now(),
  -- Ultima volta che il contenuto è cambiato.
  aggiornato_il timestamptz not null default now(),
  primary key (tipo, divisione, classe, genere)
);

comment on table public.classifiche_ranking is
  'Classifiche nazionali complete (ranking Fitarco) per tipo, arco, classe e genere.';

alter table public.classifiche_ranking enable row level security;

revoke all on table public.classifiche_ranking from anon, authenticated;
grant select on table public.classifiche_ranking to authenticated;
grant select, insert, update, delete on table public.classifiche_ranking to service_role;

create policy "I membri vedono le classifiche ranking" on public.classifiche_ranking
for select to authenticated using (public.e_membro());

-- Salva una classifica letta da Fitarco. La data di lettura si aggiorna sempre; quella di modifica solo
-- se il contenuto è cambiato.
create function public.salva_classifica_ranking(
  p_tipo text,
  p_divisione text,
  p_classe text,
  p_genere text,
  p_categoria text,
  p_totale integer,
  p_righe jsonb
) returns void
language sql
set search_path = ''
as $$
  insert into public.classifiche_ranking (tipo, divisione, classe, genere, categoria, totale, righe)
  values (p_tipo, p_divisione, p_classe, p_genere, p_categoria, p_totale, p_righe)
  on conflict (tipo, divisione, classe, genere) do update
  set categoria = excluded.categoria,
      totale = excluded.totale,
      aggiornato_il = case
        when public.classifiche_ranking.righe is distinct from excluded.righe
          or public.classifiche_ranking.totale is distinct from excluded.totale
        then now() else public.classifiche_ranking.aggiornato_il end,
      righe = excluded.righe,
      letta_il = now();
$$;

revoke all on function public.salva_classifica_ranking(text, text, text, text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.salva_classifica_ranking(text, text, text, text, text, integer, jsonb)
  to service_role;

