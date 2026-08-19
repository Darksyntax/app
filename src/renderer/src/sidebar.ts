import type { PageMeta } from '../../preload/index'

export interface SidebarCallbacks {
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onImport: () => void
  onExport: () => void
}

export interface SidebarController {
  setPages: (pages: PageMeta[], activeId: string | null) => void
  upsertPage: (meta: PageMeta) => void
  removePage: (id: string) => void
  setActive: (id: string | null) => void
  toggle: () => void
  setVisible: (visible: boolean) => void
  isVisible: () => boolean
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  const min = 60_000
  const hr = 60 * min
  const day = 24 * hr
  if (diff < min) return 'just now'
  if (diff < hr) return `${Math.floor(diff / min)}m`
  if (diff < day) return `${Math.floor(diff / hr)}h`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function initSidebar(callbacks: SidebarCallbacks): SidebarController {
  const sidebarEl = document.getElementById('sidebar') as HTMLDivElement
  const listEl = document.getElementById('sidebar-list') as HTMLDivElement
  const newButton = document.getElementById('sidebar-new') as HTMLButtonElement
  const importButton = document.getElementById('sidebar-import') as HTMLButtonElement
  const exportButton = document.getElementById('sidebar-export') as HTMLButtonElement
  // Lives outside #sidebar (a fixed sibling) so it stays put and stays clickable
  // even while the sidebar itself is translated off-screen.
  const toggleButton = document.getElementById('sidebar-toggle') as HTMLButtonElement

  let pages: PageMeta[] = []
  let activeId: string | null = null
  let visible = localStorage.getItem('calliope:sidebarVisible') !== 'false'

  newButton.addEventListener('click', () => callbacks.onCreate())
  importButton.addEventListener('click', () => callbacks.onImport())
  exportButton.addEventListener('click', () => callbacks.onExport())
  toggleButton.addEventListener('click', () => toggleVisible())

  function render(): void {
    listEl.replaceChildren()
    for (const page of pages) {
      const row = document.createElement('div')
      row.className = 'page-row' + (page.id === activeId ? ' active' : '')
      row.dataset.id = page.id

      const text = document.createElement('div')
      text.className = 'page-row-text'

      const title = document.createElement('div')
      title.className = 'page-row-title'
      title.textContent = page.title || 'Untitled'

      const meta = document.createElement('div')
      meta.className = 'page-row-preview'
      meta.textContent = page.preview ? `${formatRelativeTime(page.updatedAt)} — ${page.preview}` : formatRelativeTime(page.updatedAt)

      text.append(title, meta)

      const deleteButton = document.createElement('button')
      deleteButton.className = 'page-row-delete'
      deleteButton.type = 'button'
      deleteButton.title = 'Delete page'
      deleteButton.textContent = '×'
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation()
        callbacks.onDelete(page.id)
      })

      row.append(text, deleteButton)
      row.addEventListener('click', () => callbacks.onSelect(page.id))
      listEl.appendChild(row)
    }
  }

  function applyVisibility(): void {
    sidebarEl.classList.toggle('hidden', !visible)
  }
  applyVisibility()

  function toggleVisible(): void {
    visible = !visible
    localStorage.setItem('calliope:sidebarVisible', String(visible))
    applyVisibility()
  }

  return {
    setPages(next, nextActiveId) {
      pages = next
      activeId = nextActiveId
      render()
    },
    upsertPage(meta) {
      // Only reorders for a genuinely new page (inserted at the top). Updating
      // an existing page's title/preview/timestamp on autosave must NOT move
      // it, or the list reshuffles under you every ~500ms while typing.
      const index = pages.findIndex((p) => p.id === meta.id)
      if (index === -1) pages.unshift(meta)
      else pages[index] = meta
      render()
    },
    removePage(id) {
      pages = pages.filter((p) => p.id !== id)
      render()
    },
    setActive(id) {
      activeId = id
      render()
    },
    toggle: toggleVisible,
    setVisible(next) {
      visible = next
      localStorage.setItem('calliope:sidebarVisible', String(visible))
      applyVisibility()
    },
    isVisible() {
      return visible
    }
  }
}
