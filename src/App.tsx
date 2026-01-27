import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import POSPage from './pages/POSPage'
import CreditsPage from './pages/CreditsPage'
import ClientsPage from './pages/ClientsPage'
import OrdersPage from './pages/OrdersPage'
import InvoicesPage from './pages/InvoicesPage'
import InvoicePage from './pages/InvoicePage'
import DeliveryNotePage from './pages/DeliveryNotePage'
import DeliveryNotesPage from './pages/DeliveryNotesPage'
import ProfilePage from './pages/ProfilePage'
import SupplierCreditsPage from './pages/SupplierCreditsPage'
import ExpensesPage from './pages/ExpensesPage'
import EmployeesPage from './pages/EmployeesPage'
import CreditNotesPage from './pages/CreditNotesPage'
import CouponsPage from './pages/CouponsPage'
import ProductsPage from './pages/ProductsPage'
import EmployeeAddProductPage from './pages/employee/EmployeeAddProductPage'
import StockPage from './pages/StockPage'
import PaymentsPage from './pages/PaymentsPage'
import SuppliersPage from './pages/SuppliersPage'
import PurchasesPage from './pages/PurchasesPage'
import WarehousesPage from './pages/WarehousesPage'
import StockTransfersPage from './pages/StockTransfersPage'
import UserAccountsPage from './pages/UserAccountsPage'
import ClientTrackingPage from './pages/ClientTrackingPage'
import CommercialLoginPage from './pages/commercial/CommercialLoginPage'
import CommercialDashboardPage from './pages/commercial/CommercialDashboardPage'
import CommercialProductsPage from './pages/commercial/CommercialProductsPage'
import CommercialClientsPage from './pages/commercial/CommercialClientsPage'
import CommercialOrdersPage from './pages/commercial/CommercialOrdersPage'
import CommercialNewOrderPage from './pages/commercial/CommercialNewOrderPage'
import CommercialMapPage from './pages/commercial/CommercialMapPage'
import CommercialVisitPage from './pages/commercial/CommercialVisitPage'
import CommercialPaymentsPage from './pages/commercial/CommercialPaymentsPage'
import CommercialPerformancePage from './pages/commercial/CommercialPerformancePage'
import CommercialOrdersManagementPage from './pages/CommercialOrdersManagementPage'
import EmployeeLoginPage from './pages/employee/EmployeeLoginPage'
import EmployeeDashboardPage from './pages/employee/EmployeeDashboardPage'
import EmployeeOrdersPage from './pages/employee/EmployeeOrdersPage'
import EmployeeInvoicesPage from './pages/employee/EmployeeInvoicesPage'
import EmployeeProductsPage from './pages/employee/EmployeeProductsPage'
import EmployeeClientsPage from './pages/employee/EmployeeClientsPage'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import EmployeeProtectedRoute from './components/EmployeeProtectedRoute'

function App() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Commercial Routes - No Layout */}
        <Route path="/commercial/login" element={<CommercialLoginPage />} />
        <Route path="/commercial/dashboard" element={<CommercialDashboardPage />} />
        <Route path="/commercial/products" element={<CommercialProductsPage />} />
        <Route path="/commercial/clients" element={<CommercialClientsPage />} />
        <Route path="/commercial/orders" element={<CommercialOrdersPage />} />
        <Route path="/commercial/orders/new" element={<CommercialNewOrderPage />} />
        <Route path="/commercial/map" element={<CommercialMapPage />} />
        <Route path="/commercial/visits/new" element={<CommercialVisitPage />} />
        <Route path="/commercial/payments" element={<CommercialPaymentsPage />} />
        <Route path="/commercial/performance" element={<CommercialPerformancePage />} />

        {/* Employee Routes - No Layout */}
        <Route path="/employee/login" element={<EmployeeLoginPage />} />
        <Route path="/employee/dashboard" element={
          <EmployeeProtectedRoute>
            <EmployeeDashboardPage />
          </EmployeeProtectedRoute>
        } />
        <Route path="/employee/orders" element={
          <EmployeeProtectedRoute>
            <EmployeeOrdersPage />
          </EmployeeProtectedRoute>
        } />
        <Route path="/employee/orders/new" element={
          <EmployeeProtectedRoute>
            <Navigate to="/employee/pos" replace />
          </EmployeeProtectedRoute>
        } />
        <Route path="/employee/invoices" element={
          <EmployeeProtectedRoute>
            <EmployeeInvoicesPage />
          </EmployeeProtectedRoute>
        } />
        <Route path="/employee/invoices/new" element={
          <EmployeeProtectedRoute>
            <Navigate to="/employee/pos" replace />
          </EmployeeProtectedRoute>
        } />
        <Route path="/employee/products" element={
          <EmployeeProtectedRoute>
            <EmployeeProductsPage />
          </EmployeeProtectedRoute>
        } />
        <Route path="/employee/products/add" element={
          <EmployeeProtectedRoute>
            <EmployeeAddProductPage />
          </EmployeeProtectedRoute>
        } />
        <Route path="/employee/pos" element={
          <EmployeeProtectedRoute>
            <POSPage mode="employee" />
          </EmployeeProtectedRoute>
        } />
        <Route path="/employee/clients" element={
          <EmployeeProtectedRoute>
            <EmployeeClientsPage />
          </EmployeeProtectedRoute>
        } />
        <Route path="/employee/clients/new" element={
          <EmployeeProtectedRoute>
            <Navigate to="/employee/pos?addClient=1" replace />
          </EmployeeProtectedRoute>
        } />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <></>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute>
              <Layout>
                <POSPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/credits"
          element={
            <ProtectedRoute>
              <Layout>
                <CreditsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <Layout>
                <ClientsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Layout>
                <ProductsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouses"
          element={
            <ProtectedRoute>
              <Layout>
                <WarehousesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <ProtectedRoute>
              <Layout>
                <StockPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock-transfers"
          element={
            <ProtectedRoute>
              <Layout>
                <StockTransfersPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Layout>
                <OrdersPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <ProtectedRoute>
              <Layout>
                <InvoicesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices/create"
          element={
            <ProtectedRoute>
              <Layout>
                <InvoicePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <InvoicePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/delivery-notes/create"
          element={
            <ProtectedRoute>
              <Layout>
                <DeliveryNotePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/delivery-notes"
          element={
            <ProtectedRoute>
              <Layout>
                <DeliveryNotesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <Layout>
                <PaymentsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <Layout>
                <SuppliersPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchases"
          element={
            <ProtectedRoute>
              <Layout>
                <PurchasesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/supplier-credits"
          element={
            <ProtectedRoute>
              <Layout>
                <SupplierCreditsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <Layout>
                <ExpensesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <Layout>
                <EmployeesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-accounts"
          element={
            <ProtectedRoute>
              <Layout>
                <UserAccountsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/client-tracking/:clientId"
          element={
            <ProtectedRoute>
              <Layout>
                <ClientTrackingPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/commercial-orders"
          element={
            <ProtectedRoute>
              <Layout>
                <CommercialOrdersManagementPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/commercial-activity"
          element={
            <ProtectedRoute>
              <Layout>
                <CommercialVisitPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/credit-notes"
          element={
            <ProtectedRoute>
              <Layout>
                <CreditNotesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coupons"
          element={
            <ProtectedRoute>
              <Layout>
                <CouponsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
