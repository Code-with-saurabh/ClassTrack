import { useState, useEffect } from 'react';
import { getAllFaculty, createFaculty, updateFaculty } from '../services/facultyService';
import { getAllSubjects } from '../services/subjectService';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { toastError, toastValidation, toastSuccess } from '../utils/toastHelpers';

const PER_PAGE = 10;

const emptyForm = () => ({
  name: '',
  email: '',
  password: '',
  employeeId: '',
  department: 'Computer Science',
  assignedSubjects: [],
});

const FacultyFormModal = ({ faculty, subjects, onClose, onSaved }) => {
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Edit mode me existing data bharo
  useEffect(() => {
    if (faculty) {
      setFormData({
        name: faculty.userId?.name || '',
        email: faculty.userId?.email || '',
        password: '',
        employeeId: faculty.employeeId,
        department: faculty.department,
        assignedSubjects: faculty.assignedSubjects?.map((s) => s._id || s) || [],
      });
    }
  }, [faculty]);

  const updateField = (field, value) => setFormData({ ...formData, [field]: value });

  const validateForm = () => {
    if (!formData.name.trim()) {
      toastValidation('Name is required.');
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      toastValidation('A valid email is required.');
      return false;
    }
    if (!faculty && formData.password.length < 6) {
      toastValidation('Password must be at least 6 characters.');
      return false;
    }
    if (!formData.employeeId.trim()) {
      toastValidation('Employee ID is required.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);

    try {
      if (faculty) {
        await updateFaculty(faculty._id, formData);
        toastSuccess('Faculty updated successfully.');
      } else {
        await createFaculty(formData);
        toastSuccess('Faculty created successfully.');
      }

      onSaved();
    } catch (error) {
      toastError(error, 'Failed to save faculty');
    } finally {
      setSaving(false);
    }
  };

  // Multi-select: Ctrl/Cmd dabakar options choose karne hain
  const handleSubjectsChange = (e) => {
    const values = Array.from(e.target.selectedOptions, (o) => o.value);
    updateField('assignedSubjects', values);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{faculty ? 'Edit Faculty' : 'Add Faculty'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
              />
            </div>
          </div>

          {!faculty && (
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Employee ID</label>
              <input
                type="text"
                value={formData.employeeId}
                onChange={(e) => updateField('employeeId', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => updateField('department', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Assigned Subjects</label>
            <select multiple value={formData.assignedSubjects} onChange={handleSubjectsChange}>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
              ))}
            </select>
            <small style={{ color: 'var(--text-secondary)' }}>Hold Ctrl/Cmd to select multiple</small>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : faculty ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FacultyManagement = () => {
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const [facultyRes, subjectsRes] = await Promise.all([getAllFaculty(), getAllSubjects()]);
      setFaculty(facultyRes.data.data);
      setSubjects(subjectsRes.data.data);
    } catch (error) {
      toastError(error, 'Failed to load faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingFaculty(null);
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingFaculty(item);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditingFaculty(null);
    fetchData();
  };

  const filteredFaculty = faculty.filter(
    (f) =>
      f.employeeId?.includes(search) ||
      f.userId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const { page, setPage, total, pageItems } = usePagination(filteredFaculty, PER_PAGE);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading faculty...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Faculty Management</h2>
        <button className="btn btn-primary" onClick={openAddModal}>
          + Add Faculty
        </button>
      </div>

      <div className="card">
        <div className="search-input">
          <input
            type="text"
            placeholder="Search by name or employee ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Assigned Subjects</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => (
                <tr key={item._id}>
                  <td>{item.employeeId}</td>
                  <td>{item.userId?.name}</td>
                  <td>{item.userId?.email}</td>
                  <td>{item.department}</td>
                  <td>{item.assignedSubjects?.map((s) => s.name || s).join(', ') || 'None'}</td>
                  <td>
                    <span className={`badge ${item.userId?.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {item.userId?.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(item)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination current={page} total={total} perPage={PER_PAGE} onPageChange={setPage} />
      </div>

      {showModal && (
        <FacultyFormModal
          faculty={editingFaculty}
          subjects={subjects}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default FacultyManagement;
