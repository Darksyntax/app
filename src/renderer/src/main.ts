import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { search, searchKeymap, openSearchPanel } from '@codemirror/search'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { GFM } from '@lezer/markdown'
import { livePreview, toggleShowMarkup, toggleShowMarkupEffect } from './editor/livePreview'
import { smartMarkdownKeymap } from './editor/markdownKeymap'
import { einkTheme, darkTheme } from './editor/theme'
import { hyperfocusExtension, toggleHyperfocusMode, toggleHyperfocusModeEffect, typewriterExtension } from './editor/modes'
import { initSidebar } from './sidebar'
import { initSidebarViews } from './guide'
import { confirmModal } from './modal'
import type { PageMeta } from '../../preload/index'
import './style.css'

type ThemePref = 'auto' | 'eink' | 'dark'

const statusEl = document.getElementById('status') as HTMLDivElement
const statusBarEl = document.getElementById('status-bar') as HTMLDivElement
const themeCompartment = new Compartment()

let pages: PageMeta[] = []
let activePageId: string | null = null
let saveTimer: number | undefined
let switchToken = 0

function getContent(): string {
  return view.state.doc.toString()
}

function replaceContent(content: string): void {
  // Switching or creating a page must not carry over "show markdown syntax"
  // or hyperfocus mode from whatever page you were just looking at -- there's
  // only one editor instance under the hood, so without this reset they'd
  // silently stay on.
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content },
    effects: [toggleShowMarkupEffect.of(false), toggleHyperfocusModeEffect.of(false)]
  })
  markupToggleEl.classList.remove('active')
  hyperfocusToggleEl.classList.remove('active')
}

function updateTitle(title: string): void {
  document.title = title
  window.api.setWindowTitle(title)
}

function updateWordCount(): void {
  const text = getContent()
  const words = text.trim().length ? (text.trim().match(/\S+/g)?.length ?? 0) : 0
  const chars = text.length
  statusEl.textContent = `${words} word${words === 1 ? '' : 's'} · ${chars} character${chars === 1 ? '' : 's'}`
}

// --- Page persistence -------------------------------------------------

function scheduleSave(): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void flushSave(), 500)
}

async function flushSave(): Promise<void> {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  if (!activePageId) return
  const meta = await window.api.savePage(activePageId, getContent())
  if (meta) {
    const index = pages.findIndex((p) => p.id === meta.id)
    if (index !== -1) pages[index] = meta
    sidebar.upsertPage(meta)
  }
}

async function switchToPage(id: string): Promise<void> {
  if (id === activePageId) return
  const token = ++switchToken
  await flushSave()
  const content = await window.api.loadPage(id)
  if (token !== switchToken) return
  activePageId = id
  replaceContent(content)
  sidebar.setActive(id)
  const meta = pages.find((p) => p.id === id)
  updateTitle(meta?.title || 'Untitled')
  updateWordCount()
  view.focus()
}

async function createNewPage(): Promise<void> {
  await flushSave()
  const meta = await window.api.createPage()
  pages.unshift(meta)
  activePageId = meta.id
  replaceContent('')
  sidebar.upsertPage(meta)
  sidebar.setActive(meta.id)
  updateTitle(meta.title)
  updateWordCount()
  view.focus()
}

async function handleDeletePage(id: string): Promise<void> {
  const confirmed = await confirmModal({
    title: 'Delete this page?',
    detail: 'This cannot be undone.',
    confirmLabel: 'Delete'
  })
  if (!confirmed) return
  await window.api.deletePage(id)
  const wasActive = id === activePageId
  pages = pages.filter((p) => p.id !== id)
  sidebar.removePage(id)
  if (!wasActive) return
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  activePageId = null
  if (pages.length > 0) await switchToPage(pages[0].id)
  else await createNewPage()
}

function applyImportedPage(meta: PageMeta, content: string): void {
  pages.unshift(meta)
  activePageId = meta.id
  replaceContent(content)
  sidebar.upsertPage(meta)
  sidebar.setActive(meta.id)
  updateTitle(meta.title)
  updateWordCount()
  view.focus()
}

async function doImport(): Promise<void> {
  const result = await window.api.importPage()
  if (!result) return
  await flushSave()
  applyImportedPage(result.meta, result.content)
}

async function doExport(): Promise<void> {
  if (!activePageId) return
  const meta = pages.find((p) => p.id === activePageId)
  await window.api.exportPage(getContent(), meta?.title || 'Untitled')
}

// --- Sidebar ------------------------------------------------------------

const sidebar = initSidebar({
  onSelect: (id) => void switchToPage(id),
  onCreate: () => void createNewPage(),
  onDelete: (id) => void handleDeletePage(id),
  onImport: () => void doImport(),
  onExport: () => void doExport(),
  onReorder: (orderedIds) => void window.api.reorderPages(orderedIds)
})

initSidebarViews()

// --- Editor setup ---------------------------------------------------------

const view = new EditorView({
  parent: document.getElementById('editor')!,
  state: EditorState.create({
    doc: '',
    extensions: [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({ codeLanguages: languages, extensions: [GFM], addKeymap: false }),
      livePreview,
      hyperfocusExtension,
      typewriterExtension,
      // top: true keeps the search panel clear of the status bar in the
      // bottom-right corner, which is where CodeMirror puts it by default.
      search({ top: true }),
      themeCompartment.of(einkTheme),
      keymap.of([...smartMarkdownKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          scheduleSave()
          updateWordCount()
        }
      })
    ]
  })
})

async function init(): Promise<void> {
  // listPages() already comes back sorted by the user's manual drag order --
  // re-sorting it here (as an earlier version of this function did) would
  // silently discard that order on every launch. The page that opens by
  // default is a separate concern: resume whatever was most recently edited,
  // not just whatever's first in the manually-arranged list.
  pages = await window.api.listPages()
  if (pages.length === 0) pages = [await window.api.createPage()]
  const mostRecent = pages.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
  activePageId = mostRecent.id
  const content = await window.api.loadPage(activePageId)
  replaceContent(content)
  sidebar.setPages(pages, activePageId)
  updateTitle(mostRecent.title)
  updateWordCount()
  view.focus()
}
void init()

// --- Theme ------------------------------------------------------------

function resolveTheme(pref: ThemePref): 'eink' | 'dark' {
  if (pref === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'eink'
  return pref
}

function applyTheme(pref: ThemePref): void {
  const effective = resolveTheme(pref)
  view.dispatch({ effects: themeCompartment.reconfigure(effective === 'dark' ? darkTheme : einkTheme) })
  document.documentElement.classList.toggle('theme-dark', effective === 'dark')
  document.documentElement.classList.toggle('theme-eink', effective === 'eink')
}

let themePref = (localStorage.getItem('calliope:theme') as ThemePref | null) ?? 'auto'
if ((themePref as string) === 'light') themePref = 'eink'
applyTheme(themePref)

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (themePref === 'auto') applyTheme('auto')
})

function cycleTheme(): void {
  themePref = themePref === 'auto' ? 'eink' : themePref === 'eink' ? 'dark' : 'auto'
  localStorage.setItem('calliope:theme', themePref)
  applyTheme(themePref)
}

document.getElementById('theme-toggle')?.addEventListener('click', () => cycleTheme())

// --- Markdown syntax visibility -----------------------------------------

const markupToggleEl = document.getElementById('markup-toggle') as HTMLButtonElement

function handleToggleShowMarkup(): void {
  const showing = toggleShowMarkup(view)
  markupToggleEl.classList.toggle('active', showing)
}

markupToggleEl.addEventListener('click', () => handleToggleShowMarkup())

// --- Hyperfocus mode ------------------------------------------------------

const hyperfocusToggleEl = document.getElementById('hyperfocus-toggle') as HTMLButtonElement

function handleToggleHyperfocus(): void {
  const active = toggleHyperfocusMode(view)
  hyperfocusToggleEl.classList.toggle('active', active)
}

hyperfocusToggleEl.addEventListener('click', () => handleToggleHyperfocus())

// --- Status bar visibility ---------------------------------------------

let statusVisible = localStorage.getItem('calliope:statusVisible') !== 'false'
statusBarEl.classList.toggle('hidden', !statusVisible)

function toggleStatusVisible(): void {
  statusVisible = !statusVisible
  localStorage.setItem('calliope:statusVisible', String(statusVisible))
  statusBarEl.classList.toggle('hidden', !statusVisible)
}

// --- Menu wiring ----------------------------------------------------------

window.api.onMenu('menu:save', () => void flushSave())
window.api.onMenu('menu:new-page', () => void createNewPage())
window.api.onMenu('menu:delete-page', () => {
  if (activePageId) void handleDeletePage(activePageId)
})
window.api.onMenu('menu:export', () => void doExport())
window.api.onMenu('menu:reveal-folder', () => window.api.revealPagesFolder())
window.api.onMenu('menu:change-location', () => {
  void (async () => {
    await flushSave()
    await window.api.changePagesLocation()
  })()
})
window.api.onMenu('menu:toggle-sidebar', () => sidebar.toggle())
window.api.onMenu('menu:find', () => openSearchPanel(view))
window.api.onMenu('menu:toggle-hyperfocus', () => handleToggleHyperfocus())
window.api.onMenu('menu:toggle-wordcount', () => toggleStatusVisible())
window.api.onMenu('menu:toggle-theme', () => cycleTheme())
window.api.onMenu('menu:toggle-markup', () => handleToggleShowMarkup())

window.api.onPagesImported(({ meta, content }) => {
  void (async () => {
    await flushSave()
    applyImportedPage(meta, content)
  })()
})

// --- Flush on quit ------------------------------------------------------

window.addEventListener('beforeunload', () => {
  if (saveTimer !== undefined && activePageId) {
    window.api.savePageSync(activePageId, getContent())
  }
})
