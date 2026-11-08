-- Fase 6.3b: le simulazioni di campagna (12+12 e 24+24) e di 3D.
--
-- Si tira per piazzola, 3 frecce a piazzola, e non c'è una distanza sola (`distanza` resta null):
-- - campagna: bersaglio `campagna`, valori 6…1 e M; 12+12 = 24 piazzole = 72 frecce; 24+24 = 48 piazzole = 144 frecce;
-- - 3D: bersaglio `3d`, valori 11, 10, 8, 5 e M (zero); 24 piazzole = 72 frecce.
-- Le regole sono le stesse di packages/shared/src/segnapunti.ts.
--
-- Cambiano solo i vincoli della tabella: le colonne, `salva_simulazione` e i permessi restano come sono, quindi
-- le versioni vecchie dell'app continuano a funzionare (semplicemente non conoscono i formati nuovi).

alter table public.simulazioni
  drop constraint simulazioni_formato_check,
  drop constraint simulazioni_bersaglio_check,
  drop constraint simulazioni_bersaglio_formato,
  drop constraint simulazioni_frecce;

alter table public.simulazioni
  add constraint simulazioni_formato_check check (
    formato in ('18m', '25m', '25+18m', '70m', 'doppio70m', '12+12', '24+24', '3d')
  ),
  add constraint simulazioni_bersaglio_check check (
    bersaglio in ('singolo', 'trispot', '122', '80', 'campagna', '3d')
  ),
  -- Indoor: singolo o trispot, senza distanza; outdoor: 122 o 80 cm, con la distanza; campagna e 3D: il loro
  -- bersaglio, senza distanza.
  add constraint simulazioni_bersaglio_formato check (
    (formato in ('18m', '25m', '25+18m') and bersaglio in ('singolo', 'trispot') and distanza is null)
    or (formato in ('70m', 'doppio70m') and bersaglio in ('122', '80') and distanza is not null)
    or (formato in ('12+12', '24+24') and bersaglio = 'campagna' and distanza is null)
    or (formato = '3d' and bersaglio = '3d' and distanza is null)
  ),
  -- Mai più frecce di quelle previste dal formato, e solo i valori che esistono su QUEL bersaglio.
  add constraint simulazioni_frecce check (
    jsonb_typeof(frecce) = 'array'
    and jsonb_array_length(frecce) <= case formato
      when '25+18m' then 120
      when '70m' then 72
      when 'doppio70m' then 144
      when '12+12' then 72
      when '24+24' then 144
      when '3d' then 72
      else 60
    end
    and not jsonb_path_exists(
      frecce,
      case bersaglio
        when 'singolo' then 'strict $[*] ? (!(@ == "10" || @ == "9" || @ == "8" || @ == "7" || @ == "6" || @ == "5" || @ == "4" || @ == "3" || @ == "2" || @ == "1" || @ == "M"))'::jsonpath
        when 'trispot' then 'strict $[*] ? (!(@ == "10" || @ == "9" || @ == "8" || @ == "7" || @ == "6" || @ == "M"))'::jsonpath
        when '122' then 'strict $[*] ? (!(@ == "X" || @ == "10" || @ == "9" || @ == "8" || @ == "7" || @ == "6" || @ == "5" || @ == "4" || @ == "3" || @ == "2" || @ == "1" || @ == "M"))'::jsonpath
        when '80' then 'strict $[*] ? (!(@ == "X" || @ == "10" || @ == "9" || @ == "8" || @ == "7" || @ == "6" || @ == "5" || @ == "M"))'::jsonpath
        when 'campagna' then 'strict $[*] ? (!(@ == "6" || @ == "5" || @ == "4" || @ == "3" || @ == "2" || @ == "1" || @ == "M"))'::jsonpath
        else 'strict $[*] ? (!(@ == "11" || @ == "10" || @ == "8" || @ == "5" || @ == "M"))'::jsonpath
      end
    )
  );
