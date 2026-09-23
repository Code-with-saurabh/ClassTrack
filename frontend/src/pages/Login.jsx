import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../services/authService';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await login({ email, password });
      loginUser(data.data);

      const role = data.data.user.role;
      if (role === 'admin') navigate('/admin');
      else if (role === 'faculty') navigate('/faculty');
      else navigate('/student');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo">
            <span className="logo-mark lg">C</span>
            <span className="logo-name light">ClassTrack</span>
          </div>
          <h1>Every lecture tracked.<br />Every outcome in focus.</h1>
          <p>
            A complete academic management platform — attendance, analytics, marks
            and reports — designed for teams that take education seriously.
          </p>

          <div className="login-stats">
            <div className="login-stat">
              <div className="login-stat-value">3</div>
              <div className="login-stat-label">Portals</div>
            </div>
            <div className="login-stat">
              <div className="login-stat-value">75%</div>
              <div className="login-stat-label">Eligibility</div>
            </div>
            <div className="login-stat">
              <div className="login-stat-value">5</div>
              <div className="login-stat-label">Subjects</div>
            </div>
            <div className="login-stat">
              <div className="login-stat-value">24/7</div>
              <div className="login-stat-label">Access</div>
            </div>
          </div>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div className="login-card-head">
            <h2>Welcome back</h2>
            <p>Sign in to your dashboard to continue.</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@classtrack.com"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Signing you in…' : 'Sign in'}
            </button>
          </form>

          <div className="login-demo">
            <p className="login-demo-title">Demo credentials</p>
            <button className="login-demo-row" onClick={() => { setEmail('admin@classtrack.com'); setPassword('admin123'); }}>
              <span>Admin</span>
              <code>admin@classtrack.com / admin123</code>
            </button>
            <button className="login-demo-row" onClick={() => { setEmail('saurabh@classtrack.com'); setPassword('faculty123'); }}>
              <span>Faculty</span>
              <code>saurabh@classtrack.com / faculty123</code>
            </button>
            <button className="login-demo-row" onClick={() => { setEmail('student1@classtrack.com'); setPassword('student123'); }}>
              <span>Student</span>
              <code>student1@classtrack.com / student123</code>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;