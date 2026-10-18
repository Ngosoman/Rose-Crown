import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProfilePage from './ProfilePage'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
  from: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('../../Lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: { auth: mocks, from: mocks.from },
}))

afterEach(cleanup)

function renderProfile() {
  return render(<MemoryRouter initialEntries={['/profile']}>
    <Routes>
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/auth" element={<div>Sign in page</div>} />
      <Route path="/manage" element={<div>Property desk</div>} />
    </Routes>
  </MemoryRouter>)
}

describe('profile settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'admin-id', email: 'admin@example.com', user_metadata: { full_name: 'Rose Admin' } } } } })
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    mocks.updateUser.mockResolvedValue({ data: { user: { id: 'admin-id', email: 'admin@example.com', user_metadata: { full_name: 'Updated Admin' } } }, error: null })
    mocks.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { display_name: 'Rose Admin', phone: '' }, error: null }) }) }),
      update: (values) => {
        mocks.updateProfile(values)
        return { eq: () => Promise.resolve({ error: null }) }
      },
    })
  })

  it('updates the signed-in user profile', async () => {
    renderProfile()
    const user = userEvent.setup()
    const displayName = await screen.findByLabelText('Display name')
    await user.clear(displayName)
    await user.type(displayName, 'Updated Admin')
    await user.type(screen.getByLabelText('Phone number'), '555-0101')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(mocks.updateProfile).toHaveBeenCalledWith({ display_name: 'Updated Admin', phone: '555-0101' })
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Updated Admin' } })
  })

  it('rejects mismatched password confirmation', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('New password'), 'new-password-123')
    await user.type(screen.getByLabelText('Confirm new password'), 'different-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The new passwords do not match.')
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })
})