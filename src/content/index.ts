import { woltAdapter } from './adapters/wolt'
import { tenbisAdapter } from './adapters/tenbis'
import type { SiteAdapter } from './adapters/types'
import { processItems, wireModal } from './orchestrator'
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

  const run = () => { void processItems(adapter, document, fetchEstimates) }
  run()

  let t: number | undefined
  const obs = new MutationObserver(() => {
    window.clearTimeout(t)
    t = window.setTimeout(() => {
      run()
      const modal = adapter.findOpenModal(document)
      if (modal) {
        const items = adapter.findItems(document)
        const base = items.find((it) => modal.textContent?.includes(it.name)) ?? items[0]
        if (base) void wireModal(adapter, modal, base, fetchEstimates)
      }
    }, 400)
  })
  obs.observe(adapter.observeRoot(), { childList: true, subtree: true })
}
