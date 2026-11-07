import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Calendar, Users } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { ListGroup, ListRow } from './List'
import { NavigationBar } from './NavigationBar'
import { Notice } from './Notice'
import { PageHeader } from './PageHeader'
import { StatusLine } from './StatusLine'
import { renderConRouter } from '../test/render'

describe('Icon', () => {
  it('è decorativa (nascosta ai lettori di schermo) se non ha un nome', () => {
    const { container } = render(<Icon icon={Calendar} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('ha un nome accessibile quando porta un significato', () => {
    render(<Icon icon={Calendar} label="Data della gara" />)
    expect(screen.getByRole('img', { name: 'Data della gara' })).toBeInTheDocument()
  })
})

describe('Button', () => {
  it('è un vero pulsante di tipo "button" che esegue l azione', async () => {
    const azione = vi.fn()
    render(<Button onClick={azione}>Salva risultato</Button>)
    const pulsante = screen.getByRole('button', { name: 'Salva risultato' })
    expect(pulsante).toHaveAttribute('type', 'button')
    await userEvent.click(pulsante)
    expect(azione).toHaveBeenCalledTimes(1)
  })

  it('in corso mostra l avanzamento, tiene l etichetta e non ripete l azione', async () => {
    const azione = vi.fn()
    render(
      <Button loading onClick={azione}>
        Crea promemoria
      </Button>,
    )
    const pulsante = screen.getByRole('button')
    expect(pulsante).toHaveAttribute('aria-busy', 'true')
    expect(pulsante).toHaveTextContent('Crea promemoria')
    expect(pulsante).toHaveTextContent('In corso')
    await userEvent.click(pulsante)
    expect(azione).not.toHaveBeenCalled()
  })

  it('applica la variante richiesta', () => {
    render(<Button variant="destructive">Elimina</Button>)
    expect(screen.getByRole('button')).toHaveClass('destructive')
  })
})

describe('PageHeader', () => {
  it('mostra titolo, link per tornare indietro, descrizione e azione', () => {
    renderConRouter(
      <PageHeader
        title="Gubbio 18 m"
        back={{ label: 'Gare', href: '/gare' }}
        description="24-25 ottobre 2026"
        action={<Button>Vedi invito</Button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Gubbio 18 m' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gare' })).toHaveAttribute('href', '/gare')
    expect(screen.getByText('24-25 ottobre 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vedi invito' })).toBeInTheDocument()
  })

  it('senza pagina genitore non mostra il link indietro', () => {
    renderConRouter(<PageHeader title="Gare" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('NavigationBar', () => {
  const destinazioni = [
    { id: 'gare', label: 'Gare', icon: Calendar, href: '/gare' },
    { id: 'atleti', label: 'Atleti', icon: Users, href: '/atleti' },
  ]

  it('mostra una destinazione per voce e segna quella attuale', () => {
    renderConRouter(<NavigationBar destinations={destinazioni} current="atleti" />)
    const nav = screen.getByRole('navigation', { name: 'Navigazione principale' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Atleti' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Gare' })).not.toHaveAttribute('aria-current')
  })

  it('posiziona l unico indicatore sulla destinazione attuale', () => {
    const { container } = renderConRouter(
      <NavigationBar destinations={destinazioni} current="atleti" />,
    )
    const lista = container.querySelector('ul')!
    expect(lista.style.getPropertyValue('--indice')).toBe('1')
    expect(lista.style.getPropertyValue('--numero')).toBe('2')
  })

  it('fuori dai tab (es. Impostazioni) non mostra l indicatore e nessun tab è attivo', () => {
    const { container } = renderConRouter(<NavigationBar destinations={destinazioni} />)
    expect(container.querySelector('[aria-hidden="true"] > span')).not.toBeInTheDocument()
    expect(container.querySelector('[aria-current]')).not.toBeInTheDocument()
  })
})

describe('StatusLine', () => {
  it('è una riga di stato con icona, testo e azione facoltativa', () => {
    render(
      <StatusLine icon={Calendar} action={<Button variant="text">Ricarica</Button>}>
        Nuova versione pronta.
      </StatusLine>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Nuova versione pronta.')
    expect(screen.getByRole('button', { name: 'Ricarica' })).toBeInTheDocument()
  })
})

describe('ListGroup e ListRow', () => {
  it('una riga destinazione è un link con la freccia', () => {
    renderConRouter(
      <ListGroup title="Compagnia">
        <ListRow label="Atleti" href="/atleti" />
      </ListGroup>,
    )
    expect(screen.getByRole('region', { name: 'Compagnia' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Atleti' })).toHaveAttribute('href', '/atleti')
  })

  it('una riga nome-valore mostra il valore e non è interattiva', () => {
    render(<ListRow label="Divisione" value="Arco ricurvo" />)
    expect(screen.getByText('Arco ricurvo')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('le righe di scelta formano un gruppo di opzioni con la scelta attuale', async () => {
    const scegli = vi.fn()
    render(
      <ListGroup title="Tema" role="radiogroup">
        <ListRow label="Chiaro" selected={false} onSelect={scegli} />
        <ListRow label="Scuro" selected onSelect={() => {}} />
      </ListGroup>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Scuro' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'Chiaro' }))
    expect(scegli).toHaveBeenCalledTimes(1)
  })
})

describe('EmptyState', () => {
  it('dice cosa è vuoto, perché e cosa fare', () => {
    render(
      <EmptyState
        title="Nessuna gara salvata"
        description="Il calendario non è ancora stato importato."
        icon={Calendar}
        action={<Button>Importa calendario</Button>}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Nessuna gara salvata' })).toBeInTheDocument()
    expect(screen.getByText('Il calendario non è ancora stato importato.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importa calendario' })).toBeInTheDocument()
  })
})

describe('Notice', () => {
  it('un errore è un avviso che si fa notare subito', () => {
    render(<Notice status="error">Impossibile salvare. Controlla la connessione e riprova.</Notice>)
    expect(screen.getByRole('alert')).toHaveTextContent('Impossibile salvare')
  })

  it('gli altri stati sono messaggi di stato con la loro icona', () => {
    const { container } = render(<Notice status="success">Promemoria creato</Notice>)
    expect(screen.getByRole('status')).toHaveClass('success')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
