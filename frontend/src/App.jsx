import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AttendanceEntry from './pages/AttendanceEntry';
import AttendanceAnalytics from './pages/AttendanceAnalytics';
import AttendanceByDate from './pages/AttendanceByDate';
import AttendanceReport from './pages/AttendanceReport';
import MarksEntry from './pages/MarksEntry';
import StudentMarks from './pages/StudentMarks';
import Timetable from './pages/Timetable';
import StudentManagement from './pages/StudentManagement';
import FacultyManagement from './pages/FacultyManagement';
import SubjectManagement from './pages/SubjectManagement';
import TimetableManagement from './pages/TimetableManagement';
import './App.css';

// Role ke hisaab se home page
const HOME_BY_ROLE = {
  admin: '/admin',
  faculty: '/faculty',
  student: '/student',
};

// Saare protected routes ek jagah — path, allowed roles, aur page
const PROTECTED_ROUTES = [
  { path: '/student', roles: ['student'], page: <StudentDashboard /> },
  { path: '/student/timetable', roles: ['student'], page: <Timetable /> },
  { path: '/student/marks', roles: ['student'], page: <StudentMarks /> },
  { path: '/faculty', roles: ['faculty'], page: <FacultyDashboard /> },
  { path: '/faculty/attendance', roles: ['faculty'], page: <AttendanceEntry /> },
  { path: '/faculty/analytics', roles: ['faculty'], page: <AttendanceAnalytics /> },
  { path: '/faculty/marks', roles: ['faculty'], page: <MarksEntry /> },
  { path: '/faculty/daily-register', roles: ['faculty'], page: <AttendanceByDate /> },
  { path: '/faculty/report', roles: ['faculty'], page: <AttendanceReport /> },
  { path: '/admin', roles: ['admin'], page: <AdminDashboard /> },
  { path: '/admin/students', roles: ['admin'], page: <StudentManagement /> },
  { path: '/admin/faculty', roles: ['admin'], page: <FacultyManagement /> },
  { path: '/admin/subjects', roles: ['admin'], page: <SubjectManagement /> },
  { path: '/admin/timetable', roles: ['admin'], page: <TimetableManagement /> },
  { path: '/admin/daily-register', roles: ['admin'], page: <AttendanceByDate /> },
  { path: '/admin/report', roles: ['admin'], page: <AttendanceReport /> },
];

const LoadingScreen = () => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>Loading...</p>
  </div>
);

// Login ke bina koi page nahi khulega; role galat ho to login par bhej dega
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? <Navigate to={HOME_BY_ROLE[user.role] || '/login'} replace /> : <Login />
        }
      />

      {PROTECTED_ROUTES.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <ProtectedRoute allowedRoles={route.roles}>
              <Layout>{route.page}</Layout>
            </ProtectedRoute>
          }
        />
      ))}

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const TOAST_OPTIONS = {
  duration: 3000,
  style: {
    background: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #334155',
    borderRadius: '10px',
    fontSize: '0.9rem',
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    padding: '12px 16px',
    maxWidth: '420px',
  },
  success: {
    iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
    style: { background: '#064e3b', border: '1px solid #10b981' },
  },
  error: {
    iconTheme: { primary: '#ef4444', secondary: '#f8fafc' },
    style: { background: '#7f1d1d', border: '1px solid #ef4444' },
  },
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
      <Toaster position="top-right" visibleToasts={2} toastOptions={TOAST_OPTIONS} />
    </AuthProvider>
  );
}

export default App;
