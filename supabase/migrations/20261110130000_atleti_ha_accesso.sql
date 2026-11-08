-- Fase 4: il tab Atleti mostra chi ha l'accesso (il link personale), anche se non è ancora entrato.
--
-- `utente_id` non viene mai copiato sui telefoni (è il collegamento con l'accesso tecnico), quindi qui
-- c'è solo un "sì/no" calcolato dal database: sempre aggiornato, nessun doppione da tenere allineato.
-- Generare o revocare il link cambia `utente_id`, quindi (con il trigger già esistente) cambia
-- `aggiornato_il` e i telefoni scaricano la novità.

alter table public.atleti
  add column ha_accesso boolean generated always as (utente_id is not null) stored;

comment on column public.atleti.ha_accesso is
  'Vero se l''atleta ha un link di accesso valido. Calcolato da utente_id, che non esce dal server.';

-- Le righe esistenti: i telefoni devono riscaricarle per conoscere il nuovo campo.
update public.atleti set aggiornato_il = now();
