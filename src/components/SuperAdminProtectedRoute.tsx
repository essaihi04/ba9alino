import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSuperAdminStore } from '../store/superAdmin'

interface Props {
  children: React.ReactNode
}

export default function SuperAdminProtectedRoute({ children }: Props) {
  const { superAdminId, hydrate } = useSuperAdminStore()

  useEffect(() => {
    if (!superAdminId) hydrate()
  }, [superAdminId, hydrate])

  if (!superAdminId) {
    // Re-hydrate synchronously in case useEffect hasn't fired yet
    const raw = (() => { try { return sessionStorage.getItem('superadmin_session') } catch { return null } })()
    if (!raw) return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
