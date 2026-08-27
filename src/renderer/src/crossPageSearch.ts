import type { SearchResult } from '../../preload/index'

export interface CrossPageSearchController {
  focus: () => void
}

const DEBOUNCE_MS = 150

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
        header.textContent = result.pageTitle
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
