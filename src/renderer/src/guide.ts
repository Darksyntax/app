type SidebarView = 'pages' | 'guide' | 'search'

export interface SidebarViewsController {
  setView: (view: SidebarView) => void
}

// The rail lets the sidebar switch between Pages, the Markdown Guide, and
// cross-page Search without shrinking the pages list's available height,
// unlike the collapsible-drawer approach this replaced.
export function initSidebarViews(): SidebarViewsController {
  const railPages = document.getElementById('rail-pages') as HTMLButtonElement
  const railGuide = document.getElementById('rail-guide') as HTMLButtonElement
  const railSearch = document.getElementById('rail-search') as HTMLButtonElement
  const sidebarTitle = document.getElementById('sidebar-title') as HTMLSpanElement
  const newButton = document.getElementById('sidebar-new') as HTMLButtonElement
  const list = document.getElementById('sidebar-list') as HTMLDivElement
  const guidePanel = document.getElementById('guide-panel') as HTMLDivElement
  const searchPanel = document.getElementById('search-panel') as HTMLDivElement
  const footer = document.getElementById('sidebar-footer') as HTMLDivElement

  const titles: Record<SidebarView, string> = {
    pages: 'Pages',
    guide: 'Markdown Guide',
    search: 'Search'
  }

  function setView(view: SidebarView): void {
    const isPages = view === 'pages'
    railPages.classList.toggle('active', isPages)
    railPages.setAttribute('aria-pressed', String(isPages))
    railGuide.classList.toggle('active', view === 'guide')
    railGuide.setAttribute('aria-pressed', String(view === 'guide'))
    railSearch.classList.toggle('active', view === 'search')
    railSearch.setAttribute('aria-pressed', String(view === 'search'))

    list.classList.toggle('hidden', !isPages)
    footer.classList.toggle('hidden', !isPages)
    newButton.classList.toggle('hidden', !isPages)
    guidePanel.classList.toggle('hidden', view !== 'guide')
    searchPanel.classList.toggle('hidden', view !== 'search')
    sidebarTitle.textContent = titles[view]
  }

  railPages.addEventListener('click', () => setView('pages'))
  railGuide.addEventListener('click', () => setView('guide'))
  railSearch.addEventListener('click', () => setView('search'))

  return { setView }
}
