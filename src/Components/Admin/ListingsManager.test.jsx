import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ListingsManager from './ListingsManager'

const mocks = vi.hoisted(() => ({
  getStaffProperties: vi.fn(),
  getAmenities: vi.fn(),
  saveProperty: vi.fn(),
  saveUnit: vi.fn(),
  replaceUnitAmenities: vi.fn(),
  addUnitRateRule: vi.fn(),
  uploadUnitPhoto: vi.fn(),
  deleteUnitPhoto: vi.fn(),
  listingPhotoUrl: vi.fn(),
}))

vi.mock('../../Services/stayService', () => mocks)

afterEach(cleanup)

const property = {
  id: 'property-1',
  name: 'Harbor House',
  slug: 'harbor-house',
  city: 'Portside',
  currency: 'USD',
  timezone: 'UTC',
  published: false,
  units: [{
    id: 'unit-1',
    property_id: 'property-1',
    name: 'Garden suite',
    unit_type: 'studio',
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    description: '',
    base_nightly_price: 90,
    currency: 'USD',
    active: true,
    unit_photos: [],
    unit_rate_rules: [],
    unit_amenities: [],
  }],
}

describe('Listings manager role controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStaffProperties.mockResolvedValue({ data: [property], error: null })
    mocks.getAmenities.mockResolvedValue({ data: [], error: null })
    mocks.listingPhotoUrl.mockReturnValue('https://example.invalid/listing.jpg')
  })

  it('lets a super-admin open property creation', async () => {
    const user = userEvent.setup()
    render(<ListingsManager isSuperAdmin canManageListings />)
    await user.click(await screen.findByRole('button', { name: 'Edit property' }))
    expect(screen.getByRole('heading', { name: 'Edit property' })).toBeInTheDocument()
    expect(screen.getByLabelText('Property name')).toHaveValue('Harbor House')
  })

  it('lets a property manager manage units but not create properties', async () => {
    render(<ListingsManager isSuperAdmin={false} canManageListings />)
    expect(await screen.findByRole('button', { name: 'Add unit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit property' })).not.toBeInTheDocument()
  })

  it('keeps listing writes hidden for a receptionist', async () => {
    render(<ListingsManager isSuperAdmin={false} canManageListings={false} />)
    expect(await screen.findByRole('heading', { name: 'Harbor House' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add unit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Seasonal pricing' })).not.toBeInTheDocument()
    expect(screen.queryByText('Add photo')).not.toBeInTheDocument()
  })
})
