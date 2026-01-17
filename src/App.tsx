import { createBrowserRouter, RouterProvider } from 'react-router-dom'
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

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/profiling', element: <ProfilingPage /> },
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/files', element: <FilesPage /> },
  { path: '/files/:id', element: <FileDetailPage /> },
  { path: '/quizzes', element: <QuizzesPage /> },
  { path: '/quizzes/:id', element: <QuizSessionPage /> },
  { path: '/learning-path', element: <LearningPathPage /> },
  { path: '/analytics', element: <AnalyticsPage /> },
  { path: '/profile', element: <ProfilePage /> },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
