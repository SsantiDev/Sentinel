import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './presentation/pages/LoginPage'
import { DashboardPage } from './presentation/pages/DashboardPage'
import { ServiceDetailPage } from './presentation/pages/ServiceDetailPage'
import { getToken } from './infrastructure/authStorage'

function ProtectedRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/services/:id" element={<ProtectedRoute><ServiceDetailPage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
