import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import './App.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'faculty' ? '/faculty' : '/student'} replace /> : <Login />
      } />

      <Route path="/student" element={
        <ProtectedRoute allowedRoles={['student']}>
          <Layout><StudentDashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/student/timetable" element={
        <ProtectedRoute allowedRoles={['student']}>
          <Layout><Timetable /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/student/marks" element={
        <ProtectedRoute allowedRoles={['student']}>
          <Layout><StudentMarks /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/faculty" element={
        <ProtectedRoute allowedRoles={['faculty']}>
          <Layout><FacultyDashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/faculty/attendance" element={
        <ProtectedRoute allowedRoles={['faculty']}>
          <Layout><AttendanceEntry /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/faculty/analytics" element={
        <ProtectedRoute allowedRoles={['faculty']}>
          <Layout><AttendanceAnalytics /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/faculty/marks" element={
        <ProtectedRoute allowedRoles={['faculty']}>
          <Layout><MarksEntry /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/faculty/daily-register" element={
        <ProtectedRoute allowedRoles={['faculty']}>
          <Layout><AttendanceByDate /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/faculty/report" element={
        <ProtectedRoute allowedRoles={['faculty']}>
          <Layout><AttendanceReport /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout><AdminDashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/students" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout><StudentManagement /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/faculty" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout><FacultyManagement /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/subjects" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout><SubjectManagement /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/timetable" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout><TimetableManagement /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/daily-register" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout><AttendanceByDate /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/report" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout><AttendanceReport /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </AuthProvider>
  );
}

export default App;
