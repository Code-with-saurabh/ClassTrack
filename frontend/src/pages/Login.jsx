import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../services/authService';
import toast from 'react-hot-toast';
import { toastError, toastValidation, toastSuccess } from '../utils/toastHelpers';

const HOME_BY_ROLE = {
  admin: '/admin',
  faculty: '/faculty',
  student: '/student',
};

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@classtrack.com', password: 'admin123' },
  { label: 'Faculty', email: 'hem@classtrack.com', password: 'faculty123' },
  { label: 'Student', email: 'student1@classtrack.com', password: 'student123' },
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const showError = (message) => {
    setError(message);
    toastValidation(message);
  };

  const validate = () => {
    if (!email.trim() || !password) {
      showError('Please enter your email and password.');
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      showError('Please enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!validate()) return;
    setLoading(true);

    try {
      const { data } = await login({ email, password });
      loginUser(data.data);

      toastSuccess('Signed in successfully!');
      navigate(HOME_BY_ROLE[data.data.user.role] || '/student');
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      toastError(err, 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    toast.success(`${account.label} credentials filled. Click Sign in.`, { id: 'fill-credentials' });
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
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.label}
                className="login-demo-row"
                onClick={() => fillDemo(account)}
              >
                <span>{account.label}</span>
                <code>{account.email} / {account.password}</code>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
