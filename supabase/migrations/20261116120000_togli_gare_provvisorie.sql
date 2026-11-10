-- Il calendario dell'anno prossimo si mostra solo quando Fitarco lo rende definitivo (Mattia, 10/11/2026).
-- Fino ad oggi dal calendario provvisorio 2027 si salvavano le gare con il codice già definitivo (3 gare a
-- luglio): si tolgono. Torneranno quando il calendario 2027 sarà definitivo (il server lo controlla ogni
-- settimana di dicembre) o, al più tardi, a gennaio, quando sarà il calendario dell'anno in corso.
-- Nessun nostro atleta può averle già fatte; il controllo c'è lo stesso. Inviti e notifiche se ne vanno con
-- la gara (on delete cascade) e i telefoni lo sanno dal registro delle eliminazioni.
delete from public.gare g
where g.dal >= '2027-01-01'
  and not exists (select 1 from public.partecipazioni p where p.gara_codice = g.codice);
