import { woltAdapter } from './src/content/adapters/wolt'
import { wireModalButton, resolveModalBase } from './src/content/orchestrator'
;(window as any).__wire = () => {
  const modal = woltAdapter.findOpenModal(document)
  if (!modal) return 'no-modal'
  const base = resolveModalBase(woltAdapter, modal, woltAdapter.findItems(document))
  if (!base) return 'no-base'
  const fetchEstimates = async (items: { id: string }[]) => ({ ok: true, results: Object.fromEntries(items.map((i) => [i.id, { calories: 123, protein_g: 5, carbs_g: 10, fat_g: 3 }])) })
  wireModalButton(woltAdapter, modal, base, fetchEstimates as any)
  return 'wired:' + base.name
}
