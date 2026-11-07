import type { ReactNode } from 'react'
import { Settings } from 'lucide-react'
import { useLocation } from 'react-router'
import { IconLink } from '../componenti/IconLink'
import { PageHeader } from '../componenti/PageHeader'
import { PERCORSO_IMPOSTAZIONI } from '../navigazione'

/** Struttura comune dei 4 tab: intestazione con il collegamento alle Impostazioni, poi il contenuto. */
export function PaginaTab({ title, children }: { title: string; children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <>
      <PageHeader
        title={title}
        action={
          <IconLink
            icon={Settings}
            label="Impostazioni"
            to={PERCORSO_IMPOSTAZIONI}
            state={{ da: pathname }}
          />
        }
      />
      {children}
    </>
  )
}
