import { EditorView, KeyBinding } from '@codemirror/view'
import { insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown'

// @codemirror/lang-markdown's default Enter handling needs three consecutive
// Enter presses to escape a blockquote/list (it only drops the marker once it
// sees two already-empty marker lines in a row). That traps the cursor inside
// the block for anyone hitting Enter twice, which is the universal markdown-editor
// convention. Detect the empty-marker-line case ourselves and exit in one press.
const EMPTY_QUOTE_LINE = /^(\s*>)+\s*$/
const EMPTY_LIST_LINE = /^\s*([-*+]|\d+[.)])\s*$/

function exitEmptyBlockOnEnter(view: EditorView): boolean {
  const { state } = view
  const { main } = state.selection
  if (!main.empty) return false
  const line = state.doc.lineAt(main.head)
  if (main.head !== line.to) return false
  if (!EMPTY_QUOTE_LINE.test(line.text) && !EMPTY_LIST_LINE.test(line.text)) return false
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: '' },
    selection: { anchor: line.from },
    userEvent: 'delete'
  })
  return true
}

export const smartMarkdownKeymap: KeyBinding[] = [
  { key: 'Enter', run: exitEmptyBlockOnEnter },
  { key: 'Enter', run: insertNewlineContinueMarkup },
  { key: 'Backspace', run: deleteMarkupBackward }
]
