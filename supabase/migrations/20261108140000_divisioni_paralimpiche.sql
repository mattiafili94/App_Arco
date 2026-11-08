-- Divisioni del tiro paralimpico nei PDF dei risultati: "Compound W1" → W1, "Visually Impaired 1" → V1.
-- Il codice divisione può avere una cifra come secondo carattere.

alter table public.classifiche drop constraint classifiche_divisione_check;
alter table public.classifiche add constraint classifiche_divisione_check
  check (divisione ~ '^[A-Z][A-Z0-9]$');

alter table public.partecipazioni drop constraint partecipazioni_divisione_check;
alter table public.partecipazioni add constraint partecipazioni_divisione_check
  check (divisione ~ '^[A-Z][A-Z0-9]$');

alter table public.ranking drop constraint ranking_divisione_check;
alter table public.ranking add constraint ranking_divisione_check
  check (divisione ~ '^[A-Z][A-Z0-9]$');
