import { expect, test } from '@playwright/test'

test.describe('navigazione', () => {
  test('l indirizzo iniziale apre le Gare', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/gare$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Gare' })).toBeVisible()
  })

  test('i tab cambiano pagina e il tasto indietro torna alla precedente', async ({ page }) => {
    await page.goto('/gare')
    const barra = page.getByRole('navigation', { name: 'Navigazione principale' })

    await barra.getByRole('link', { name: 'Classifica' }).click()
    await expect(page).toHaveURL(/\/classifica$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Classifica' })).toBeVisible()
    await expect(barra.getByRole('link', { name: 'Classifica' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await barra.getByRole('link', { name: 'Allenamento' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Allenamento' })).toBeVisible()

    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'Classifica' })).toBeVisible()
  })

  test('un indirizzo aperto direttamente o ricaricato mostra la sua pagina', async ({ page }) => {
    await page.goto('/atleti')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Atleti' })).toBeVisible()
    await expect(page).toHaveTitle('Atleti · Arcieri Eugubini')
  })

  test('le Impostazioni si aprono dall icona e riportano al tab di partenza', async ({ page }) => {
    await page.goto('/allenamento')
    await page.getByRole('link', { name: 'Impostazioni' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Impostazioni' })).toBeVisible()
    // Il link per tornare indietro sta nel contenuto principale (l'altro "Allenamento" è il tab).
    await page.getByRole('main').getByRole('link', { name: 'Allenamento' }).click()
    await expect(page).toHaveURL(/\/allenamento$/)
  })
})

test.describe('tema', () => {
  test('il tema scelto resta dopo aver ricaricato la pagina', async ({ page }) => {
    await page.goto('/impostazioni')
    await page.getByRole('radio', { name: 'Scuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('radio', { name: 'Scuro' })).toHaveAttribute('aria-checked', 'true')
  })

  test('"Come il telefono" segue il tema scuro del sistema', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/gare')
    const sfondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(sfondo).toBe('rgb(19, 20, 22)')
  })
})
