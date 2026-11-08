import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { dbPredefinito, svuotaDb } from '../sync/db'

afterEach(async () => {
  // La copia dei dati sul telefono non passa da un test all'altro.
  await svuotaDb(dbPredefinito())
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

// jsdom non implementa matchMedia: lo simuliamo con "nessuna preferenza".
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
