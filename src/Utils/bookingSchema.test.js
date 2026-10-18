import { describe, expect, it } from 'vitest'
import { bookingSchema } from './bookingSchema'

const validRequest = {
  guestName: 'Morgan Lee',
  guestEmail: 'morgan@example.com',
  guestPhone: '+1 555 0182',
  guestCount: 2,
  checkIn: '2027-06-12',
  checkout: '2027-06-15',
  specialRequests: '',
}

describe('booking request validation', () => {
  it('accepts complete guest details and a half-open stay date range', () => {
    expect(bookingSchema.safeParse(validRequest).success).toBe(true)
  })

  it('rejects invalid email, missing contact details, and empty party sizes', () => {
    const result = bookingSchema.safeParse({ ...validRequest, guestEmail: 'not-an-email', guestPhone: '', guestCount: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects checkout dates on or before check-in', () => {
    const result = bookingSchema.safeParse({ ...validRequest, checkout: validRequest.checkIn })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.includes('checkout'))).toBe(true)
  })

  it('rejects oversized special requests', () => {
    expect(bookingSchema.safeParse({ ...validRequest, specialRequests: 'a'.repeat(801) }).success).toBe(false)
  })
})