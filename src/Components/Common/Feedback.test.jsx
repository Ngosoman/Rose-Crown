import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConfigState, EmptyState, ErrorState, LoadingState } from './Feedback'

describe('shared feedback states', () => {
  it('gives an actionable configuration message when Supabase is missing', () => {
    render(<ConfigState />)
    expect(screen.getByRole('heading', { name: 'Connect your StayEase database' })).toBeInTheDocument()
    expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument()
  })

  it('exposes errors and loading states accessibly', () => {
    const { rerender } = render(<ErrorState message="Could not load stays." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load stays.')
    rerender(<LoadingState label="Loading stays" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading stays')
  })

  it('renders a real empty state without sample records', () => {
    render(<EmptyState title="No published stays" body="Add a property in Supabase." />)
    expect(screen.getByRole('heading', { name: 'No published stays' })).toBeInTheDocument()
  })
})