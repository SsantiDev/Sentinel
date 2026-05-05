import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './application/context/ThemeContext'
import { LoginPage } from './presentation/pages/LoginPage'
import { DashboardPage } from './presentation/pages/DashboardPage'
import { ServiceDetailPage } from './presentation/pages/ServiceDetailPage'
import { AlertsPage } from './presentation/pages/AlertsPage'
import { HistoryPage } from './presentation/pages/HistoryPage'
import { SettingsPage } from './presentation/pages/SettingsPage'
import { getToken } from './infrastructure/authStorage'
import { Layout } from './presentation/components/Layout'
import { SessionWatcher } from './presentation/components/SessionWatcher'

function ProtectedRoute({ children }) {
  return getToken() ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <SessionWatcher />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/services/:id" element={<ProtectedRoute><ServiceDetailPage /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
