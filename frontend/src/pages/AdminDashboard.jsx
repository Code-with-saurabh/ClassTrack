import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllStudents } from '../services/studentService';
import { getAllFaculty } from '../services/facultyService';
import { getAllSubjects } from '../services/subjectService';
import { getGreeting } from '../utils/helpers';
import { toastError } from '../utils/toastHelpers';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ students: 0, faculty: 0, subjects: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [studentsRes, facultyRes, subjectsRes] = await Promise.all([
          getAllStudents(),
          getAllFaculty(),
          getAllSubjects()
        ]);
        setStats({
          students: studentsRes.data.data.length,
          faculty: facultyRes.data.data.length,
          subjects: subjectsRes.data.data.length
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        toastError(error, 'Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          {getGreeting()}, {user?.name?.split(' ')[0]}
        </h2>
        <p style={{ opacity: 0.9 }}>Admin Dashboard - Academic Structure Management</p>
      </div>

      <div className="card-grid">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/students')}>
          <div className="label">Total Students</div>
          <div className="value">{stats.students}</div>
          <div className="subtext">Manage students →</div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/faculty')}>
          <div className="label">Total Faculty</div>
          <div className="value">{stats.faculty}</div>
          <div className="subtext">Manage faculty →</div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/subjects')}>
          <div className="label">Total Subjects</div>
          <div className="value">{stats.subjects}</div>
          <div className="subtext">Manage subjects →</div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/timetable')}>
          <div className="label">Timetable</div>
          <div className="value" style={{ color: 'var(--primary)' }}>→</div>
          <div className="subtext">Manage schedule →</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h3>Management Overview</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={() => navigate('/admin/students')} style={{ padding: '1rem', justifyContent: 'center' }}>
            👥 Student Management
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/admin/faculty')} style={{ padding: '1rem', justifyContent: 'center' }}>
            👨‍🏫 Faculty Management
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/admin/subjects')} style={{ padding: '1rem', justifyContent: 'center' }}>
            📚 Subject Management
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/admin/timetable')} style={{ padding: '1rem', justifyContent: 'center' }}>
            📅 Timetable Management
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
