/** Vero se l'app è aperta dall'icona sulla schermata Home (installata). */
export function appInstallata(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
