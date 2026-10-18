import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthPage from './AuthPage'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../../Lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    auth: { signInWithPassword: mocks.signInWithPassword, signUp: mocks.signUp },
    from: mocks.from,
  },
}))

afterEach(cleanup)

function renderAuth(returnTo) {
  const initialEntry = returnTo ? { pathname: '/auth', state: { returnTo } } : '/auth'
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/manage" element={<div>Admin property desk</div>} />
        <Route path="/my-stays" element={<div>Guest stays</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submitSignIn() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email address'), 'owner@example.com')
  await user.type(screen.getByLabelText('Password'), 'correct-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('role-aware sign-in routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'signed-in-user' }, session: { user: { id: 'signed-in-user' } } },
      error: null,
    })
    mocks.signUp.mockResolvedValue({ data: { user: { id: 'new-guest' }, session: null }, error: null })
    mocks.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: table === 'user_roles' ? [] : [],
        error: null,
      }),
    }))
  })

  it.each(['super_admin', 'property_manager'])('routes %s accounts to the admin desk', async (role) => {
    mocks.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: table === 'user_roles' && role === 'super_admin'
          ? [{ role }]
          : table === 'property_members' && role === 'property_manager'
            ? [{ role }]
            : [],
        error: null,
      }),
    }))
    renderAuth()
    await submitSignIn()
    expect(await screen.findByText('Admin property desk')).toBeInTheDocument()
  })

  it('routes a guest away from a requested admin page', async () => {
    renderAuth('/manage')
    await submitSignIn()
    expect(await screen.findByText('Guest stays')).toBeInTheDocument()
  })

  it('respects a safe internal return path for a guest', async () => {
    renderAuth('/my-stays')
    await submitSignIn()
    expect(await screen.findByText('Guest stays')).toBeInTheDocument()
  })

  it('keeps a newly registered user out of the admin desk', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: 'new-guest' }, session: { user: { id: 'new-guest' } } }, error: null })
    renderAuth('/manage')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    await user.type(screen.getByLabelText('Your name'), 'New Guest')
    await user.type(screen.getByLabelText('Email address'), 'guest@example.com')
    await user.type(screen.getByLabelText('Password'), 'new-guest-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Guest stays')).toBeInTheDocument()
  })
})
