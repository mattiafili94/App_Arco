// Parte del "motore offline" (service worker) che gestisce le notifiche push (Fase 3.4).
// Il file viene caricato dal service worker dell'app (vite.config.ts, `importScripts`).
// Messaggio dal server: { titolo, testo, url } (supabase/functions/_shared/aggiornamento/notifiche.ts).

self.addEventListener('push', (evento) => {
  let dati = {}
  try {
    dati = evento.data ? evento.data.json() : {}
  } catch {
    // Messaggio non valido: si mostra comunque un avviso generico.
  }
  const url = typeof dati.url === 'string' && dati.url.startsWith('/') ? dati.url : '/gare'
  evento.waitUntil(
    self.registration.showNotification(dati.titolo || 'Arcieri Eugubini', {
      body: dati.testo || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      // Stessa gara = stessa notifica (non se ne accumulano due).
      tag: url,
      data: { url },
    }),
  )
})

// Al tocco: se l'app è già aperta si porta in primo piano sulla pagina giusta, altrimenti si apre.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const indirizzo = new URL(evento.notification.data?.url || '/gare', self.location.origin).href
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (finestre) => {
      const finestra = finestre.find((f) => f.url.startsWith(self.location.origin))
      if (finestra) {
        await finestra.focus()
        if ('navigate' in finestra) return finestra.navigate(indirizzo)
        return undefined
      }
      return self.clients.openWindow(indirizzo)
    }),
  )
})
