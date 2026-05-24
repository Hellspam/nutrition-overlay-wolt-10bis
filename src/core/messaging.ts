import type { EstimateRequest, EstimateResponse } from '../shared/types'

export async function requestEstimates(
  items: EstimateRequest['items'],
): Promise<EstimateResponse> {
  return chrome.runtime.sendMessage({ type: 'ESTIMATE', items } as EstimateRequest)
}
