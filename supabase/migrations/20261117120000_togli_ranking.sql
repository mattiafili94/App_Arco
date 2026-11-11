-- Pulizia (Mattia, 11/11/2026): la vecchia tabella `ranking` (solo la riga dei nostri atleti) non serve più.
-- Dalla Fase 5 le classifiche per i Campionati Italiani stanno intere in `classifiche_ranking`, e tutti i
-- telefoni hanno la versione dell'app che non chiede più `ranking`. Si tolgono la tabella (con i suoi trigger)
-- e la funzione che la riempiva, più le tracce delle sue righe eliminate.

drop function public.salva_ranking(text, text, uuid[], jsonb);
drop table public.ranking;
delete from public.eliminazioni where tabella = 'ranking';
