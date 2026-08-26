type SidebarView = 'pages' | 'guide'

// The rail lets the sidebar switch between Pages and the Markdown Guide
// without shrinking the pages list's available height, unlike the
// collapsible-drawer approach this replaced.
export function initSidebarViews(): void {
  const railPages = document.getElementById('rail-pages') as HTMLButtonElement
  const railGuide = document.getElementById('rail-guide') as HTMLButtonElement
  const sidebarTitle = document.getElementById('sidebar-title') as HTMLSpanElement
  const newButton = document.getElementById('sidebar-new') as HTMLButtonElement
  const list = document.getElementById('sidebar-list') as HTMLDivElement
  const guidePanel = document.getElementById('guide-panel') as HTMLDivElement
  const footer = document.getElementById('sidebar-footer') as HTMLDivElement

  function setView(view: SidebarView): void {
    const isPages = view === 'pages'
    railPages.classList.toggle('active', isPages)
    railPages.setAttribute('aria-pressed', String(isPages))
    railGuide.classList.toggle('active', !isPages)
    railGuide.setAttribute('aria-pressed', String(!isPages))

    list.classList.toggle('hidden', !isPages)
    footer.classList.toggle('hidden', !isPages)
    newButton.classList.toggle('hidden', !isPages)
    guidePanel.classList.toggle('hidden', isPages)
    sidebarTitle.textContent = isPages ? 'Pages' : 'Markdown Guide'
  }

  railPages.addEventListener('click', () => setView('pages'))
  railGuide.addEventListener('click', () => setView('guide'))
}
