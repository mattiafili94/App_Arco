import { expect, test } from '@playwright/test'
import { aspettaMotoreOffline } from './aiuti'

test.describe('app installabile e offline', () => {
  test('il manifest descrive l app con nome, icone e pagina iniziale', async ({ request }) => {
    const risposta = await request.get('/manifest.webmanifest')
    expect(risposta.ok()).toBe(true)
    const manifest = await risposta.json()
    expect(manifest.name).toBe('Arcieri Eugubini')
    expect(manifest.start_url).toBe('/gare')
    expect(manifest.display).toBe('standalone')
    const dimensioni = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(dimensioni).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
  })

  test('senza rete l app si apre lo stesso e lo dice', async ({ page, context }) => {
    await page.goto('/gare')
    await aspettaMotoreOffline(page)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Gare' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('Offline')

    // Anche un indirizzo mai aperto prima funziona offline.
    await page.goto('/classifica')
    await expect(page.getByRole('heading', { level: 1, name: 'Classifica' })).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByText(/Offline/)).toHaveCount(0)
  })
})
