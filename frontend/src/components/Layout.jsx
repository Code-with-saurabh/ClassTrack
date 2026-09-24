import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  formatNotificationTime,
} from '../services/notificationService';
import { toastError } from '../utils/toastHelpers';

const NOTIF_ICONS = {
  success: '✅',
  warning: '⚠️',
  danger: '🔴',
  info: 'ℹ️',
};

const NotificationBell = () => {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const bellRef = useRef(null);
  const navigate = useNavigate();

  const refreshCount = () => {
    getUnreadCount()
      .then(({ data }) => setCount(data.data?.count || 0))
      .catch((err) => {
        if (err?.response?.status !== 401) {
          // silent-ish: avoid spamming every 45s
        }
      });
  };

  useEffect(() => {
    refreshCount();
    const timer = setInterval(refreshCount, 45000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const { data } = await getNotifications({ limit: 20 });
        setItems(data.data || []);
        refreshCount();
      } catch (err) {
        setItems([]);
        toastError(err, 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleItemClick = async (n) => {
    if (!n.read) {
      try {
        await markAsRead(n._id);
        setItems((prev) => prev.map((it) => (it._id === n._id ? { ...it, read: true } : it)));
        setCount((c) => Math.max(0, c - 1));
      } catch (err) {
        toastError(err, 'Failed to mark notification as read');
      }
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const handleMarkAll = async () => {
    if (items.every((n) => n.read) || count === 0) {
      toast.success('You are already all caught up!');
      return;
    }
    try {
      await markAllRead();
      setCount(0);
      setItems((prev) => prev.map((it) => ({ ...it, read: true })));
      toast.success('All notifications marked as read.');
    } catch (err) {
      toastError(err, 'Failed to mark all as read');
    }
  };

  return (
    <div className="notif-bell" ref={bellRef}>
      <button className="notif-bell-btn" onClick={toggle} aria-label="Notifications">
        <span className="notif-bell-icon">🔔</span>
        {count > 0 && <span className="notif-badge">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span className="notif-title">Notifications</span>
            <button
              className="notif-mark-read"
              onClick={handleMarkAll}
              disabled={items.every((n) => n.read)}
            >
              Mark all read
            </button>
          </div>
          <div className="notif-list">
            {loading ? (
              <div className="notif-empty">Loading…</div>
            ) : items.length === 0 ? (
              <div className="notif-empty">You're all caught up 🎉</div>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  className={`notif-item ${n.read ? '' : 'unread'}`}
                  onClick={() => handleItemClick(n)}
                >
                  <span className={`notif-icon notif-${n.type}`}>
                    {NOTIF_ICONS[n.type] || NOTIF_ICONS.info}
                  </span>
                  <span className="notif-body">
                    <span className="notif-text">{n.title}</span>
                    {n.body && <span className="notif-sub">{n.body}</span>}
                    <span className="notif-time">{formatNotificationTime(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const NAV_GROUPS = {
  student: [
    { section: 'Main', items: [{ path: '/student', label: 'Dashboard', icon: '📊' }] },
    {
      section: 'Academics',
      items: [
        { path: '/student/timetable', label: 'Timetable', icon: '📅' },
        { path: '/student/marks', label: 'My Marks', icon: '📝' },
      ],
    },
  ],
  faculty: [
    { section: 'Main', items: [{ path: '/faculty', label: 'Dashboard', icon: '📊' }] },
    {
      section: 'Attendance',
      items: [
        { path: '/faculty/attendance', label: 'Take Attendance', icon: '✅' },
        { path: '/faculty/analytics', label: 'Analytics', icon: '📈' },
        { path: '/faculty/daily-register', label: 'Daily Register', icon: '📋' },
      ],
    },
    { section: 'Academics', items: [{ path: '/faculty/marks', label: 'Enter Marks', icon: '📝' }] },
    { section: 'Reports', items: [{ path: '/faculty/report', label: 'Report & PDF', icon: '🖨️' }] },
  ],
  admin: [
    { section: 'Main', items: [{ path: '/admin', label: 'Dashboard', icon: '📊' }] },
    {
      section: 'Manage',
      items: [
        { path: '/admin/students', label: 'Students', icon: '👥' },
        { path: '/admin/faculty', label: 'Faculty', icon: '👨‍🏫' },
        { path: '/admin/subjects', label: 'Subjects', icon: '📚' },
      ],
    },
    { section: 'Schedule', items: [{ path: '/admin/timetable', label: 'Timetable', icon: '📅' }] },
    {
      section: 'Insights',
      items: [
        { path: '/admin/daily-register', label: 'Daily Register', icon: '📋' },
        { path: '/admin/report', label: 'Attendance Report', icon: '🖨️' },
      ],
    },
  ],
};

const CRUMB_LABELS = {
  '/student': 'Dashboard',
  '/student/timetable': 'Timetable',
  '/student/marks': 'My Marks',
  '/faculty': 'Dashboard',
  '/faculty/attendance': 'Take Attendance',
  '/faculty/analytics': 'Analytics',
  '/faculty/marks': 'Enter Marks',
  '/faculty/daily-register': 'Daily Register',
  '/faculty/report': 'Report & PDF',
  '/admin': 'Dashboard',
  '/admin/students': 'Students',
  '/admin/faculty': 'Faculty',
  '/admin/subjects': 'Subjects',
  '/admin/timetable': 'Timetable',
  '/admin/daily-register': 'Daily Register',
  '/admin/report': 'Attendance Report',
};

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const groups = NAV_GROUPS[user?.role] || [];
  const crumb = CRUMB_LABELS[location.pathname] || 'Dashboard';

  return (
    <div className="app-container">
      <button className="menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle navigation">
        {menuOpen ? '✕' : '☰'}
      </button>
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <span className="logo-mark">C</span>
            <span>
              <span className="logo-name">ClassTrack</span>
              <span className="logo-sub">Academic CRM</span>
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group.section}>
              <div className="nav-section">{group.section}</div>
              {group.items.map((item) => (
                <button
                  key={item.path}
                  className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar small">{user?.name?.charAt(0)?.toUpperCase()}</div>
            <div className="sidebar-user-meta">
              <span className="sidebar-user-name">{user?.name}</span>
              <span className="sidebar-user-role">
                {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
              </span>
            </div>
            <button className="sidebar-logout" onClick={handleLogout} title="Logout" aria-label="Logout">
              ⏻
            </button>
          </div>
        </div>
      </aside>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)}></div>}

      <main className="main-content">
        <div className="topbar">
          <div>
            <div className="breadcrumb">
              <span className="crumb-root">ClassTrack</span>
              <span className="crumb-sep">/</span>
              <span className="crumb-current">{crumb}</span>
            </div>
            <h2 className="page-title">Welcome, {user?.name?.split(' ')[0]} 👋</h2>
          </div>
          <div className="user-info">
            <NotificationBell />
            <div className="user-chip">
              <div className="user-avatar">{user?.name?.charAt(0)?.toUpperCase()}</div>
              <div className="user-chip-meta">
                <span className="user-chip-name">{user?.name}</span>
                <span className="user-chip-role">
                  {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                </span>
              </div>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
};

export default Layout;