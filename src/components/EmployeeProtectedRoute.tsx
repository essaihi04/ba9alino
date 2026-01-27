import { Navigate } from 'react-router-dom'

interface EmployeeProtectedRouteProps {
  children: React.ReactNode
}

export default function EmployeeProtectedRoute({ children }: EmployeeProtectedRouteProps) {
  const employeeId = localStorage.getItem('employee_id')
  const employeeRole = localStorage.getItem('employee_role')

  const allowedRoles = new Set(['employee', 'stock', 'admin'])

  if (!employeeId || !employeeRole || !allowedRoles.has(employeeRole)) {
    return <Navigate to="/employee/login" replace />
  }

  return <>{children}</>
}
