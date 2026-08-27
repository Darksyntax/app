import type { SearchResult } from '../../preload/index'

export interface CrossPageSearchController {
  focus: () => void
}

const DEBOUNCE_MS = 150

// Matches main/pageStore.ts's SCRATCHPAD_RESULT_ID -- see the comment there
// for why this is a duplicated literal rather than a shared import.
const SCRATCHPAD_RESULT_ID = '__scratchpad__'

const SVG_NS = 'http://www.w3.org/2000/svg'

// Same sticky-note glyph as the #scratchpad-toggle button in index.html, at
// list-row scale, so a Notes result reads as "the scratchpad" at a glance.
function stickyNoteIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', '11')
  svg.setAttribute('height', '11')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.4')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  const body = document.createElementNS(SVG_NS, 'path')
  body.setAttribute('d', 'M2.5 2.5h8l3 3v8h-11z')
  const fold = document.createElementNS(SVG_NS, 'path')
  fold.setAttribute('d', 'M10.5 2.5v3h3')
  svg.append(body, fold)
  return svg
}

export function initCrossPageSearch(onJumpToResult: (result: SearchResult) => void): CrossPageSearchController {
  const input = document.getElementById('search-input') as HTMLInputElement
  const resultsEl = document.getElementById('search-results') as HTMLDivElement
  let debounceTimer: number | undefined

  function renderMessage(text: string, className: 'search-empty' | 'search-hint'): void {
    resultsEl.replaceChildren()
    const el = document.createElement('div')
    el.className = className
    el.textContent = text
    resultsEl.appendChild(el)
  }

  function render(results: SearchResult[]): void {
    resultsEl.replaceChildren()
    if (results.length === 0) {
      renderMessage('No matches', 'search-empty')
      return
    }

    let lastPageId: string | null = null
    for (const result of results) {
      if (result.pageId !== lastPageId) {
        lastPageId = result.pageId
        const header = document.createElement('div')
        header.className = 'search-result-page'
        if (result.pageId === SCRATCHPAD_RESULT_ID) {
          header.classList.add('search-result-page-notes')
          header.appendChild(stickyNoteIcon())
        }
        header.append(document.createTextNode(result.pageTitle))
        resultsEl.appendChild(header)
      }

      const row = document.createElement('div')
      row.className = 'search-result-row'
      row.append(
        document.createTextNode(result.snippet.slice(0, result.matchStart)),
        Object.assign(document.createElement('mark'), { textContent: result.snippet.slice(result.matchStart, result.matchEnd) }),
        document.createTextNode(result.snippet.slice(result.matchEnd))
      )
      row.addEventListener('click', () => onJumpToResult(result))
      resultsEl.appendChild(row)
    }
  }

  async function runSearch(query: string): Promise<void> {
    if (query.trim().length < 2) {
      renderMessage('Type at least 2 characters', 'search-hint')
      return
    }
    const results = await window.api.searchPages(query)
    render(results)
  }

  renderMessage('Type at least 2 characters', 'search-hint')

  input.addEventListener('input', () => {
    if (debounceTimer !== undefined) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => void runSearch(input.value), DEBOUNCE_MS)
  })

  return {
    focus() {
      input.focus()
      input.select()
    }
  }
}
