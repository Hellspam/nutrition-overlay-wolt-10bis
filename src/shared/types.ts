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
