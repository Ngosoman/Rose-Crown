import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SiteLayout from './SiteLayout'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../../Lib/supabase', () => ({
  supabase: { auth: mocks, from: mocks.from },
}))

afterEach(cleanup)

function renderLayout() {
  return render(<MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<div>Home page</div>} />
        <Route path="manage" element={<div>Property desk</div>} />
        <Route path="profile" element={<div>Profile settings</div>} />
      </Route>
    </Routes>
  </MemoryRouter>)
}

describe('signed-in account menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'admin-id', email: 'admin@example.com', user_metadata: { full_name: 'Rose Admin' } } } } })
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [{ role: 'super_admin' }], error: null }) }),
    })
  })

  it('shows the signed-in admin and links to profile settings', async () => {
    renderLayout()
    expect(await screen.findByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('Rose Admin')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open account menu' }))
    await user.click(screen.getByRole('menuitem', { name: /Manage profile/ }))
    expect(await screen.findByText('Profile settings')).toBeInTheDocument()
  })

  it('signs out and returns to the home page', async () => {
    renderLayout()
    await screen.findByRole('button', { name: 'Open account menu' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open account menu' }))
    await user.click(screen.getByRole('menuitem', { name: /Sign out/ }))
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce())
    expect(await screen.findByText('Home page')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sign in/ })).toBeInTheDocument()
  })
})