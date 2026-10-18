import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import GuestDashboard from './GuestDashboard'

describe('guest route without a configured backend', () => {
  it('does not fabricate guest records and points to Supabase setup', () => {
    render(<MemoryRouter><GuestDashboard /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Connect your Rose-Crown database' })).toBeInTheDocument()
    expect(screen.queryByText('No stays on the calendar yet')).not.toBeInTheDocument()
  })
})
