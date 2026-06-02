import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import AccessPortal from './pages/AccessPortal'
import VoterAuth from './pages/VoterAuth'
import AdminAuth from './pages/AdminAuth'
import Dashboard from './pages/Dashboard'
import VoterDashboard from './pages/VoterDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/portal" element={<AccessPortal />} />
      <Route path="/voter-auth" element={<VoterAuth />} />
      <Route path="/admin-auth" element={<AdminAuth />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/voter" element={<VoterDashboard />} />
    </Routes>
  )
}
