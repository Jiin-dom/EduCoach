import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import ProfilingPage from './pages/ProfilingPage'
import DashboardPage from './pages/DashboardPage'
import FilesPage from './pages/FilesPage'
import FileDetailPage from './pages/FileDetailPage'
import QuizzesPage from './pages/QuizzesPage'
import QuizSessionPage from './pages/QuizSessionPage'
import LearningPathPage from './pages/LearningPathPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ProfilePage from './pages/ProfilePage'
import SubscriptionPage from './pages/SubscriptionPage'
import SubscriptionCheckoutPage from './pages/SubscriptionCheckoutPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminSubscriptionsPage from './pages/AdminSubscriptionsPage'

const router = createBrowserRouter([
  // Public routes
  { path: '/', element: <LandingPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/login', element: <LoginPage /> },

  // Protected routes (require authentication)
  {
    path: '/profiling',
    element: (
      <ProtectedRoute>
        <ProfilingPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute requireProfile>
        <DashboardPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/files',
    element: (
      <ProtectedRoute requireProfile>
        <FilesPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/files/:id',
    element: (
      <ProtectedRoute requireProfile>
        <FileDetailPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/quizzes',
    element: (
      <ProtectedRoute requireProfile>
        <QuizzesPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/quizzes/:id',
    element: (
      <ProtectedRoute requireProfile>
        <QuizSessionPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/learning-path',
    element: (
      <ProtectedRoute requireProfile>
        <LearningPathPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/analytics',
    element: (
      <ProtectedRoute requireProfile requirePremium>
        <AnalyticsPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    )
  },
  {
    path: '/subscription',
    element: (
      <ProtectedRoute requireProfile>
        <SubscriptionPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/subscription/checkout',
    element: (
      <ProtectedRoute requireProfile>
        <SubscriptionCheckoutPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/admin/users',
    element: (
      <ProtectedRoute requireAdmin>
        <AdminUsersPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/admin/subscriptions',
    element: (
      <ProtectedRoute requireAdmin>
        <AdminSubscriptionsPage />
      </ProtectedRoute>
    )
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
