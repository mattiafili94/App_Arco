import type { GiornoAllenamento } from '@arco/shared'

/**
 * Chi ha scritto il programma, quando non è chi guarda: "dall'atleta" per l'allenatore, il nome dell'allenatore
 * per l'atleta (Mattia, 11/11/2026). `null` se l'ha scritto chi guarda (o non si sa).
 */
export function autoreDelProgramma(
  g: Pick<GiornoAllenamento, 'atleta_id' | 'programma' | 'programma_modificato_da'> | undefined,
  io: string,
  nomi: ReadonlyMap<string, string> | undefined,
): string | null {
  const da = g?.programma_modificato_da
  if (!g || g.programma.trim() === '' || !da || da === io) return null
  if (da === g.atleta_id) return 'scritto dall’atleta'
  return `scritto da ${nomi?.get(da) ?? 'un allenatore'}`
}
