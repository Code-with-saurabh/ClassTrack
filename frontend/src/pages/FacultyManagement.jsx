import { useState, useEffect } from 'react';
import { getAllFaculty, createFaculty, updateFaculty } from '../services/facultyService';
import { getAllSubjects } from '../services/subjectService';
import toast from 'react-hot-toast';
import { toastError, toastValidation } from '../utils/toastHelpers';

const FacultyManagement = () => {
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', employeeId: '', department: 'Computer Science', assignedSubjects: []
  });

  const fetchData = async () => {
    try {
      const [facultyRes, subjectsRes] = await Promise.all([getAllFaculty(), getAllSubjects()]);
      setFaculty(facultyRes.data.data);
      setSubjects(subjectsRes.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toastError(error, 'Failed to load faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validateForm = () => {
    if (!formData.name.trim()) { toastValidation('Name is required.'); return false; }
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) { toastValidation('A valid email is required.'); return false; }
    if (!editingFaculty && formData.password.length < 6) { toastValidation('Password must be at least 6 characters.'); return false; }
    if (!formData.employeeId.trim()) { toastValidation('Employee ID is required.'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (editingFaculty) {
        await updateFaculty(editingFaculty._id, formData);
        toast.success('Faculty updated successfully.');
      } else {
        await createFaculty(formData);
        toast.success('Faculty created successfully.');
      }
      setShowModal(false);
      setEditingFaculty(null);
      setFormData({ name: '', email: '', password: '', employeeId: '', department: 'Computer Science', assignedSubjects: [] });
      fetchData();
    } catch (error) {
      console.error('Error saving faculty:', error);
      toastError(error, 'Failed to save faculty');
    }
  };

  const handleEdit = (f) => {
    setEditingFaculty(f);
    setFormData({
      name: f.userId?.name || '',
      email: f.userId?.email || '',
      password: '',
      employeeId: f.employeeId,
      department: f.department,
      assignedSubjects: f.assignedSubjects?.map(s => s._id || s) || []
    });
    setShowModal(true);
  };

  const filteredFaculty = faculty.filter(f =>
    f.employeeId?.includes(search) ||
    f.userId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div><p>Loading faculty...</p></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Faculty Management</h2>
        <button className="btn btn-primary" onClick={() => { setEditingFaculty(null); setShowModal(true); }}>
          + Add Faculty
        </button>
      </div>

      <div className="card">
        <div className="search-input">
          <input type="text" placeholder="Search by name or employee ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
              {filteredFaculty.map((f) => (
                <tr key={f._id}>
                  <td>{f.employeeId}</td>
                  <td>{f.userId?.name}</td>
                  <td>{f.userId?.email}</td>
                  <td>{f.department}</td>
                  <td>{f.assignedSubjects?.map(s => s.name || s).join(', ') || 'None'}</td>
                  <td><span className={`badge ${f.userId?.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{f.userId?.status}</span></td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(f)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingFaculty ? 'Edit Faculty' : 'Add Faculty'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                </div>
              </div>
              {!editingFaculty && (
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Employee ID</label>
                  <input type="text" value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Assigned Subjects</label>
                <select multiple value={formData.assignedSubjects} onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, o => o.value);
                  setFormData({ ...formData, assignedSubjects: values });
                }}>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-secondary)' }}>Hold Ctrl/Cmd to select multiple</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingFaculty ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyManagement;
