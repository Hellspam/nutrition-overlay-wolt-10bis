import type { MenuItem, ModalOption } from '../../shared/types'

export interface SiteAdapter {
  /** True if this adapter handles the current hostname. */
  matches(host: string): boolean
  /** Root node to attach the MutationObserver to. */
  observeRoot(): HTMLElement
  /** Extract all currently-rendered menu items. */
  findItems(root: ParentNode): MenuItem[]
  /** Given an open modal root, the selectable add-on option rows. */
  findModalOptions(modalRoot: HTMLElement): ModalOption[]
  /** Within an open modal, the element to render the running total into/near. */
  getModalTotalAnchor(modalRoot: HTMLElement): HTMLElement | null
  /** Detect an open item modal within a mutation, or null. */
  findOpenModal(root: ParentNode): HTMLElement | null
  /** The base item's name + description read from an OPEN modal, or null if not derivable. */
  getModalItem(modalRoot: HTMLElement): { name: string; description: string } | null
}
