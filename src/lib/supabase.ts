import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export { createClient }

// Type definitions
export interface User {
  id: string
  email: string
  created_at: string
}

export interface Client {
  id: string
  user_id: string
  company_name_ar: string
  company_name_en: string
  company_logo_url: string
  industry_ar: string
  contact_person_name: string
  contact_person_email: string
  contact_person_phone: string
  billing_address_ar: string
  city: string
  subscription_tier: string
  subscription_status: string
  is_active: boolean
  commercial_id?: string
  created_by?: string
  gps_lat?: number
  gps_lng?: number
  shop_photo_url?: string
  credit_limit?: number
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  client_id: string
  order_date: string
  expected_delivery_date: string
  status: string
  payment_status: string
  shipping_status: string
  subtotal: number
  tax_amount: number
  shipping_cost: number
  discount_amount: number
  total_amount: number
  currency: string
  created_by?: string
  source?: 'pos' | 'commercial' | 'admin'
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  invoice_number: string
  order_id: string
  client_id: string
  invoice_date: string
  due_date: string
  status: string
  subtotal: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  amount_due: number
  currency: string
  created_at: string
  updated_at: string
}

export interface CreditNote {
  id: string
  credit_note_number: string
  invoice_id: string
  client_id: string
  reason_ar: string
  reason_type: string
  credit_date: string
  status: string
  total_credit_amount: number
  applied_amount: number
  remaining_amount: number
  currency: string
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  sku: string
  name_ar: string
  name_en: string
  price: number
  cost_price: number
  is_active: boolean
  is_active_for_commercial?: boolean
  created_at: string
}

export interface Stock {
  id: string
  product_id: string
  quantity_in_stock: number
  quantity_reserved: number
  quantity_available: number
  reorder_level: number
  is_low_stock: boolean
  is_out_of_stock: boolean
}

export interface SupplierPayment {
  id: string
  supplier_id: string
  amount: number
  payment_date: string
  payment_method: 'cash' | 'transfer' | 'check' | 'card' | 'other'
  notes?: string
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  date: string
  category: 'rent' | 'electricity' | 'water' | 'internet' | 'transport' | 'salary' | 'other'
  description: string
  amount: number
  payment_method: 'cash' | 'transfer' | 'check' | 'card' | 'other'
  employee_id?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  national_id?: string
  salary?: number
  monthly_salary?: number
  advance_limit?: number
  hire_date?: string
  role: 'admin' | 'commercial' | 'stock' | 'truck_driver' | 'delivery_driver' | 'custom'
  custom_role?: string
  status: 'active' | 'inactive'
  password_hash?: string
  created_at: string
  updated_at: string
}

export interface EmployeeTransaction {
  id: string
  employee_id: string
  transaction_date: string
  transaction_type: 'advance' | 'repayment' | 'salary_payment' | 'salary_deduction'
  amount: number
  payment_method: 'cash' | 'transfer' | 'check' | 'card' | 'other'
  notes?: string
  created_by?: string
  created_at: string
}

export interface Visit {
  id: string
  commercial_id: string
  client_id: string
  visit_date: string
  gps_lat?: number
  gps_lng?: number
  note?: string
  photo_url?: string
  order_created: boolean
  duration_minutes?: number
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id?: string
  created_by?: string
  details?: Record<string, any>
  created_at: string
}
