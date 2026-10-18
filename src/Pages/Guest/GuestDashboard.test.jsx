import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import GuestDashboard from './GuestDashboard'

vi.mock('../../Lib/supabase', () => ({ supabase: null, supabaseConfigured: false }))

describe('guest route without a configured backend', () => {
  it('does not fabricate guest records and points to Supabase setup', () => {
    render(<MemoryRouter><GuestDashboard /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Connect your Rose-Crown database' })).toBeInTheDocument()
    expect(screen.queryByText('No stays on the calendar yet')).not.toBeInTheDocument()
  })
})
