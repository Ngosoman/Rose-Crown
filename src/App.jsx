import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import SiteLayout from './Components/Layout/SiteLayout'
import HomePage from './Pages/Public/HomePage'
import StaySearchPage from './Pages/Public/StaySearchPage'
import PropertyPage from './Pages/Public/PropertyPage'
import BookingPage from './Pages/Public/BookingPage'
import AuthPage from './Pages/Auth/AuthPage'
import GuestDashboard from './Pages/Guest/GuestDashboard'
import StaffDashboard from './Pages/Admin/StaffDashboard'
import PolicyPage from './Pages/Public/PolicyPage'
import ProfilePage from './Pages/Account/ProfilePage'

export default function App() {
  return <BrowserRouter>
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="stays" element={<StaySearchPage />} />
        <Route path="stays/:slug" element={<PropertyPage />} />
        <Route path="book/:unitId" element={<BookingPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="my-stays" element={<GuestDashboard />} />
        <Route path="manage" element={<StaffDashboard />} />
        <Route path="privacy" element={<PolicyPage />} />
        <Route path="terms" element={<PolicyPage />} />
        <Route path="contact" element={<PolicyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    <Toaster position="top-right" richColors />
  </BrowserRouter>
}
