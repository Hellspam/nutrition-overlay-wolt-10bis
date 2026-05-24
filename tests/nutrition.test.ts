import { describe, it, expect } from 'vitest'
import { sumNutrition, zeroNutrition } from '../src/core/nutrition'
import type { Nutrition } from '../src/shared/types'

const a: Nutrition = { calories: 500, protein_g: 30, carbs_g: 40, fat_g: 20 }
const b: Nutrition = { calories: 310, protein_g: 4, carbs_g: 38, fat_g: 15 }

describe('sumNutrition', () => {
  it('returns zeros for empty input', () => {
    expect(sumNutrition([])).toEqual(zeroNutrition())
  })
  it('adds a base and one option', () => {
    expect(sumNutrition([a, b])).toEqual({
      calories: 810, protein_g: 34, carbs_g: 78, fat_g: 35,
    })
  })
  it('rounds fractional sums to whole numbers', () => {
    expect(sumNutrition([{ calories: 1.4, protein_g: 0.5, carbs_g: 0.5, fat_g: 0.4 },
                         { calories: 1.4, protein_g: 0.6, carbs_g: 0.6, fat_g: 0.4 }]))
      .toEqual({ calories: 3, protein_g: 1, carbs_g: 1, fat_g: 1 })
  })
})
