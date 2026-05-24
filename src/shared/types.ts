export interface Nutrition {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MenuItem {
  id: string            // cache key derived from name+description
  name: string
  description: string
  priceText: string
  anchor: HTMLElement   // node the badge is injected into/after
}

export interface ModalOption {
  label: string
  input: HTMLInputElement // the checkbox/radio to watch
}

export interface EstimateRequest {
  type: 'ESTIMATE'
  items: { id: string; name: string; description: string; priceText?: string }[]
}
export interface EstimateResponse {
  ok: boolean
  results?: Record<string, Nutrition> // id -> nutrition (only successful ones)
  error?: 'NO_API_KEY' | 'API_ERROR' | 'RATE_LIMIT'
}
