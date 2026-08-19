import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view'
import { StateField, StateEffect, Range } from '@codemirror/state'

export const toggleHyperfocusModeEffect = StateEffect.define<boolean>()

export const hyperfocusModeField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleHyperfocusModeEffect)) value = effect.value
    }
    return value
  }
})

export function toggleHyperfocusMode(view: EditorView): void {
  const next = !view.state.field(hyperfocusModeField)
  view.dispatch({ effects: toggleHyperfocusModeEffect.of(next) })
}

// Splits a line's text into sentences (naive: no abbreviation handling, same
// tradeoff every lightweight "sentence focus" implementation makes), returning
// each one's absolute document range.
function sentenceRanges(lineText: string, lineFrom: number): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = []
  let start = 0
  const re = /[.!?]+(\s+|$)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(lineText))) {
    const end = match.index + match[0].length
    ranges.push({ from: lineFrom + start, to: lineFrom + end })
    start = end
  }
  if (start < lineText.length) ranges.push({ from: lineFrom + start, to: lineFrom + lineText.length })
  return ranges
}

function buildHyperfocusDecorations(view: EditorView): DecorationSet {
  if (!view.state.field(hyperfocusModeField)) return Decoration.none
  const { state } = view
  const decos: Range<Decoration>[] = []
  const head = state.selection.main.head
  const activeLine = state.doc.lineAt(head)

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = state.doc.lineAt(pos)
      if (line.number !== activeLine.number) {
        decos.push(Decoration.line({ class: 'cm-focus-dim' }).range(line.from))
      }
      pos = line.to + 1
    }
  }

  const sentences = sentenceRanges(activeLine.text, activeLine.from)
  for (const s of sentences) {
    if (head < s.from || head > s.to) {
      decos.push(Decoration.mark({ class: 'cm-focus-dim' }).range(s.from, s.to))
    }
  }

  return Decoration.set(decos, true)
}

const hyperfocusPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildHyperfocusDecorations(view)
    }
    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.startState.field(hyperfocusModeField) !== update.state.field(hyperfocusModeField)
      ) {
        this.decorations = buildHyperfocusDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations }
)

export const hyperfocusExtension = [hyperfocusModeField, hyperfocusPlugin]

// Typewriter scrolling is always on: the current line stays vertically
// centered as the cursor moves, no toggle needed.
function centerCursor(view: EditorView): void {
  requestAnimationFrame(() => {
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'center' }) })
  })
}

// Recentering mid-click is what caused the bug this guards against: if the
// view scrolls while a mouse button is still down, the content shifts under
// a stationary cursor, and the browser reads that as a drag — silently
// creating a real text selection nobody asked for. Capture-phase listeners
// (fire before CodeMirror's own mousedown handling, guaranteeing the flag is
// set before the resulting selection change is processed) suspend centering
// for the duration of the gesture and resume once the button is released.
export const typewriterExtension = ViewPlugin.fromClass(
  class {
    view: EditorView
    mouseDown = false
    onMouseDown = (): void => {
      this.mouseDown = true
    }
    onMouseUp = (): void => {
      this.mouseDown = false
      centerCursor(this.view)
    }

    constructor(view: EditorView) {
      this.view = view
      document.addEventListener('mousedown', this.onMouseDown, true)
      document.addEventListener('mouseup', this.onMouseUp, true)
    }

    update(update: ViewUpdate): void {
      if (this.mouseDown) return
      if (update.selectionSet || update.docChanged) centerCursor(update.view)
    }

    destroy(): void {
      document.removeEventListener('mousedown', this.onMouseDown, true)
      document.removeEventListener('mouseup', this.onMouseUp, true)
    }
  }
)
