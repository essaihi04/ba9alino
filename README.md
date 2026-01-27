# Ba9alino Admin Dashboard

Modern, professional admin web application for Ba9alino e-commerce platform with full Arabic RTL support, built with React, TypeScript, and Supabase.

## 🎨 Features

### Dashboard & Analytics
- **Real-time Dashboard** with key metrics (revenue, orders, clients, low stock)
- **Revenue Charts** showing monthly trends with interactive visualizations
- **Order Status Pie Chart** displaying order distribution
- **Recent Orders Table** with quick access to latest transactions

### Client Management
- **Client Directory** with search and filter capabilities
- **Add New Clients** with company details and subscription tiers
- **Client Profiles** showing contact information and subscription status
- **Subscription Tier Management** (Basic, Standard, Premium, Enterprise)

### Order Management
- **Complete Order Tracking** with status and payment information
- **Order Search & Filtering** by order number
- **Order Status Indicators** (Pending, Processing, Completed, Cancelled)
- **Payment Status Tracking** (Pending, Paid, Partial, Overdue)

### Invoice Management
- **Invoice Listing** with comprehensive details
- **Invoice Status Tracking** (Draft, Sent, Paid, Overdue, Cancelled)
- **Amount Tracking** (Total, Paid, Due)
- **PDF Download** capability for invoices
- **Invoice Search** functionality

### Credit Notes Management
- **Credit Note Tracking** with full audit trail
- **Amount Management** (Total Credit, Applied, Remaining)
- **Status Management** (Draft, Issued, Applied, Cancelled)
- **Credit Note Search** functionality

### User Interface
- **Modern Design** with gradient backgrounds and smooth transitions
- **Full Arabic RTL Support** for all interfaces
- **Responsive Layout** that works on all screen sizes
- **Professional Color Scheme** with indigo and purple gradients
- **Intuitive Navigation** with collapsible sidebar
- **Loading States** with animated spinners
- **Modal Dialogs** for adding new records

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Supabase account with configured project
- Environment variables set up

### Installation

```bash
# Navigate to admin-app directory
cd admin-app

# Install dependencies
npm install

# Create .env file with Supabase credentials
echo "VITE_SUPABASE_URL=your_supabase_url" > .env
echo "VITE_SUPABASE_ANON_KEY=your_anon_key" >> .env

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Variables

Create a `.env` file in the `admin-app` directory:

```
VITE_SUPABASE_URL=https://pvztozmqrbjxsyqwxmex.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key_here
```

## 📁 Project Structure

```
admin-app/
├── src/
│   ├── components/
│   │   ├── Layout.tsx          # Main layout with sidebar
│   │   └── ProtectedRoute.tsx   # Auth guard component
│   ├── pages/
│   │   ├── LoginPage.tsx        # Authentication page
│   │   ├── DashboardPage.tsx    # Main dashboard
│   │   ├── ClientsPage.tsx      # Client management
│   │   ├── OrdersPage.tsx       # Order management
│   │   ├── InvoicesPage.tsx     # Invoice management
│   │   └── CreditNotesPage.tsx  # Credit notes management
│   ├── store/
│   │   └── auth.ts             # Zustand auth store
│   ├── lib/
│   │   └── supabase.ts         # Supabase client & types
│   ├── App.tsx                 # Main app routing
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## 🔐 Authentication

The app uses Supabase Authentication with email/password login.

### Test Credentials
- **Email:** admin@example.com
- **Password:** password123

### Login Flow
1. User enters credentials on LoginPage
2. Supabase authenticates user
3. Auth store saves user session
4. Protected routes redirect to dashboard
5. User can logout from sidebar

## 🎯 Pages Overview

### Login Page
- Email and password input fields
- Error handling and validation
- Test credentials display
- Gradient background design

### Dashboard Page
- **Stats Cards:** Revenue, Orders, Clients, Low Stock
- **Revenue Chart:** Monthly trend visualization
- **Order Status Chart:** Distribution pie chart
- **Recent Orders:** Latest 5 orders table

### Clients Page
- **Search Bar:** Find clients by name
- **Clients Table:** Company, contact, email, phone, tier, actions
- **Add Client Modal:** Form for new client creation
- **Subscription Tiers:** Color-coded tier badges

### Orders Page
- **Search Bar:** Find orders by order number
- **Orders Table:** Order #, date, amount, status, payment status
- **Status Indicators:** Color-coded status badges
- **Quick Actions:** View, edit, delete buttons

### Invoices Page
- **Search Bar:** Find invoices by invoice number
- **Invoices Table:** Invoice #, date, amount, paid, status
- **Status Tracking:** Draft, Sent, Paid, Overdue, Cancelled
- **Download:** PDF export capability

### Credit Notes Page
- **Search Bar:** Find credit notes by number
- **Credit Notes Table:** Number, date, amount, applied, remaining, status
- **Amount Tracking:** Total credit, applied amount, remaining balance
- **Status Management:** Draft, Issued, Applied, Cancelled

## 🎨 Design System

### Colors
- **Primary:** Indigo (#4f46e5)
- **Secondary:** Purple (#9333ea)
- **Success:** Green (#10b981)
- **Warning:** Orange (#f59e0b)
- **Danger:** Red (#ef4444)
- **Neutral:** Gray (#6b7280)

### Typography
- **Headings:** Bold, large sizes
- **Body:** Regular weight, readable sizes
- **Labels:** Medium weight, smaller sizes

### Components
- **Cards:** White background, shadow, rounded corners
- **Buttons:** Gradient backgrounds, hover effects
- **Tables:** Striped rows, hover effects
- **Modals:** Centered, overlay background
- **Inputs:** Border focus, outline on focus

## 🌍 Arabic RTL Support

All pages include `dir="rtl"` for proper right-to-left text direction.

### Supported Arabic Text
- Menu labels and navigation
- Page titles and descriptions
- Table headers and content
- Form labels and placeholders
- Button text and messages
- Status labels and badges

## 📊 Data Integration

### Supabase Tables
- `clients` - Client information
- `orders` - Order records
- `invoices` - Invoice details
- `credit_notes` - Credit note records
- `user_profiles` - User information
- `products` - Product catalog
- `stock` - Inventory management

### Real-time Features
- Live data fetching on page load
- Search and filter functionality
- Status updates and tracking
- Amount calculations

## 🔧 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Tech Stack
- **Framework:** React 18
- **Language:** TypeScript
- **Routing:** React Router v6
- **State Management:** Zustand
- **Backend:** Supabase
- **Styling:** TailwindCSS
- **Icons:** Lucide React
- **Charts:** Recharts
- **Build Tool:** Vite

## 📱 Responsive Design

The dashboard is fully responsive and works on:
- Desktop (1920px and above)
- Laptop (1366px - 1920px)
- Tablet (768px - 1366px)
- Mobile (320px - 768px)

## 🔒 Security

- **Authentication:** Supabase Auth with JWT
- **Authorization:** Role-based access control
- **RLS Policies:** Row-level security on database
- **Protected Routes:** Auth guard on all pages
- **Secure Storage:** Session-based authentication

## 📝 API Integration

All data is fetched from Supabase using the JavaScript client:

```typescript
// Example: Fetch clients
const { data, error } = await supabase
  .from('clients')
  .select('*')
  .order('created_at', { ascending: false })
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Netlify
1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in Netlify dashboard

### Deploy to Vercel
1. Connect GitHub repository
2. Vercel auto-detects Vite configuration
3. Add environment variables in Vercel dashboard

## 📚 Documentation

- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

This project is proprietary and confidential.

## 📞 Support

For issues and questions, please contact the development team.

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Language:** Arabic (RTL) & English
