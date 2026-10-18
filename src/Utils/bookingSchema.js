import { z } from 'zod'

export const bookingSchema = z.object({
  guestName: z.string().trim().min(2, 'Enter the guest name.'),
  guestEmail: z.string().trim().email('Enter a valid email address.'),
  guestPhone: z.string().trim().min(5, 'Enter a phone number.'),
  guestCount: z.coerce.number().int().min(1, 'Choose at least one guest.'),
  checkIn: z.string().min(1, 'Choose a check-in date.'),
  checkout: z.string().min(1, 'Choose a check-out date.'),
  specialRequests: z.string().max(800, 'Keep requests under 800 characters.'),
}).refine((value) => value.checkout > value.checkIn, { path: ['checkout'], message: 'Check-out must be after check-in.' })