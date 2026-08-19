export interface ConfirmModalOptions {
  title: string
  detail?: string
  confirmLabel?: string
  cancelLabel?: string
}

// Only one modal is ever open at a time in this app, so a single set of DOM
// elements reused per call is enough -- no need for a stacking/queue system.
export function confirmModal(options: ConfirmModalOptions): Promise<boolean> {
  const overlay = document.getElementById('modal-overlay') as HTMLDivElement
  const titleEl = document.getElementById('modal-title') as HTMLDivElement
  const detailEl = document.getElementById('modal-detail') as HTMLDivElement
  const cancelBtn = document.getElementById('modal-cancel') as HTMLButtonElement
  const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement

  titleEl.textContent = options.title
  detailEl.textContent = options.detail ?? ''
  detailEl.style.display = options.detail ? '' : 'none'
  cancelBtn.textContent = options.cancelLabel ?? 'Cancel'
  confirmBtn.textContent = options.confirmLabel ?? 'OK'

  overlay.classList.remove('hidden')

  return new Promise((resolve) => {
    function cleanup(result: boolean): void {
      overlay.classList.add('hidden')
      cancelBtn.removeEventListener('click', onCancel)
      confirmBtn.removeEventListener('click', onConfirm)
      overlay.removeEventListener('mousedown', onOverlayClick)
      document.removeEventListener('keydown', onKeydown)
      resolve(result)
    }
    function onCancel(): void {
      cleanup(false)
    }
    function onConfirm(): void {
      cleanup(true)
    }
    function onOverlayClick(e: MouseEvent): void {
      if (e.target === overlay) cleanup(false)
    }
    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') cleanup(false)
      if (e.key === 'Enter') cleanup(true)
    }
    cancelBtn.addEventListener('click', onCancel)
    confirmBtn.addEventListener('click', onConfirm)
    overlay.addEventListener('mousedown', onOverlayClick)
    document.addEventListener('keydown', onKeydown)
    // Cancel is the safe default for a destructive confirmation, same
    // convention as the native dialog it replaces.
    cancelBtn.focus()
  })
}
