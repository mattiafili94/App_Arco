import { describe, expect, it } from 'vitest'
import { descriviUltima } from './formato'

describe('quando è stata l’ultima sincronizzazione', () => {
  const adesso = new Date(2026, 10, 9, 15, 0).getTime()

  it('mai', () => {
    expect(descriviUltima(null, adesso)).toBe('Mai')
  })

  it('oggi, ieri e prima', () => {
    expect(descriviUltima(new Date(2026, 10, 9, 10, 5).getTime(), adesso)).toBe('Oggi alle 10:05')
    expect(descriviUltima(new Date(2026, 10, 8, 23, 59).getTime(), adesso)).toBe('Ieri alle 23:59')
    expect(descriviUltima(new Date(2026, 9, 24, 7, 0).getTime(), adesso)).toBe('24/10 alle 07:00')
  })

  it('usa l’ora di adesso se non si indica', () => {
    expect(descriviUltima(Date.now())).toMatch(/^Oggi alle \d\d:\d\d$/)
  })
})
