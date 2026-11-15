-- Il ruolo TECNICO REGIONALE (Mattia, 15/11/2026): come l'allenatore, lo dà o lo toglie l'amministratore.
--
-- Chi ce l'ha vede nel tab Classifica la sezione "Coppa delle Regioni": le classifiche nazionali (ranking) delle
-- categorie della Coppa Italia delle Regioni, filtrate sugli atleti umbri. Sono dati pubblici: il ruolo decide solo
-- cosa mostra l'app. Finché c'è almeno un tecnico regionale attivo, il server tiene aggiornate quelle classifiche
-- (le scarica se mancano e le rilegge ogni lunedì, come quelle dei nostri atleti).

alter table public.atleti add column tecnico_regionale boolean not null default false;
comment on column public.atleti.tecnico_regionale is
  'Ha il ruolo di tecnico regionale (lo dà o lo toglie l''amministratore).';

-- L'amministratore lo cambia come gli altri campi dell'atleta (regola "L'amministratore modifica gli atleti").
grant update (tecnico_regionale) on table public.atleti to authenticated;
