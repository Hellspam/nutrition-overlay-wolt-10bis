import type { Nutrition } from '../shared/types'

export function zeroNutrition(): Nutrition {
  return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
}

export function sumNutrition(parts: Nutrition[]): Nutrition {
  const total = parts.reduce((acc, n) => ({
    calories: acc.calories + n.calories,
    protein_g: acc.protein_g + n.protein_g,
    carbs_g: acc.carbs_g + n.carbs_g,
    fat_g: acc.fat_g + n.fat_g,
  }), zeroNutrition())
  return {
    calories: Math.round(total.calories),
    protein_g: Math.round(total.protein_g),
    carbs_g: Math.round(total.carbs_g),
    fat_g: Math.round(total.fat_g),
  }
}
