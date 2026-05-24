import { woltAdapter } from './adapters/wolt'
import { tenbisAdapter } from './adapters/tenbis'
import type { SiteAdapter } from './adapters/types'
import { wireModalButton, resolveModalBase } from './orchestrator'
import { requestEstimates } from '../core/messaging'
import { renderNoKeyPrompt } from './render'

const adapters: SiteAdapter[] = [woltAdapter, tenbisAdapter]
const adapter = adapters.find((a) => a.matches(location.hostname))
if (adapter) start(adapter)

function start(adapter: SiteAdapter) {
  const fetchEstimates = async (items: { id: string; name: string; description: string }[]) => {
    const resp = await requestEstimates(items)
    if (!resp.ok && resp.error === 'NO_API_KEY') renderNoKeyPrompt()
    return resp
  }

  // On-demand only: when an item modal opens, inject a "calculate nutrition"
  // button. Nothing is sent to Gemini until the user clicks it — then a single
  // grouped request covers that dish + all its options. No per-page auto-fetch.
  let t: number | undefined
  const obs = new MutationObserver(() => {
    window.clearTimeout(t)
    t = window.setTimeout(() => {
      const modal = adapter.findOpenModal(document)
      if (!modal) return
      const base = resolveModalBase(adapter, modal, adapter.findItems(document))
      if (base) wireModalButton(adapter, modal, base, fetchEstimates)
    }, 300)
  })
  obs.observe(adapter.observeRoot(), { childList: true, subtree: true })
}
