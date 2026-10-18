import { describe, expect, it } from 'vitest'
import { formatMoney, getUnitImage, humanizeStatus } from './format'

describe('StayEase display helpers', () => {
  it('formats amounts using the selected currency', () => {
    expect(formatMoney(125, 'USD')).toContain('125.00')
  })

  it('selects the first ordered stored photo without mutating the source', () => {
    const photos = [{ storage_path: 'later.jpg', sort_order: 2 }, { storage_path: 'first.jpg', sort_order: 1 }]
    expect(getUnitImage({ unit_photos: photos }).storage_path).toBe('first.jpg')
    expect(photos[0].storage_path).toBe('later.jpg')
  })

  it('renders booking state labels without changing the stored value', () => {
    expect(humanizeStatus('checkout_due')).toBe('Checkout Due')
  })
})