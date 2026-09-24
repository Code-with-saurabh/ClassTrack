import { useState, useEffect } from 'react';
import { getAllSubjects, createSubject, updateSubject } from '../services/subjectService';
import { getAllFaculty } from '../services/facultyService';
import toast from 'react-hot-toast';
import { toastError, toastValidation } from '../utils/toastHelpers';

const SubjectManagement = () => {
  const [subjects, setSubjects] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '', code: '', semester: 5, department: 'Computer Science', faculty: ''
  });

  const fetchData = async () => {
    try {
      const [subjectsRes, facultyRes] = await Promise.all([getAllSubjects(), getAllFaculty()]);
      setSubjects(subjectsRes.data.data);
      setFacultyList(facultyRes.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toastError(error, 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validateForm = () => {
    if (!formData.name.trim()) { toastValidation('Subject name is required.'); return false; }
    if (!formData.code.trim()) { toastValidation('Subject code is required.'); return false; }
    if (formData.semester < 1 || formData.semester > 8) { toastValidation('Semester must be between 1 and 8.'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (editingSubject) {
        await updateSubject(editingSubject._id, formData);
        toast.success('Subject updated successfully.');
      } else {
        await createSubject(formData);
        toast.success('Subject created successfully.');
      }
      setShowModal(false);
      setEditingSubject(null);
      setFormData({ name: '', code: '', semester: 5, department: 'Computer Science', faculty: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving subject:', error);
      toastError(error, 'Failed to save subject');
    }
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code,
      semester: subject.semester,
      department: subject.department,
      faculty: subject.faculty?._id || ''
    });
    setShowModal(true);
  };

  const filteredSubjects = subjects.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div><p>Loading subjects...</p></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Subject Management</h2>
        <button className="btn btn-primary" onClick={() => { setEditingSubject(null); setShowModal(true); }}>
          + Add Subject
        </button>
      </div>

      <div className="card">
        <div className="search-input">
          <input type="text" placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Semester</th>
                <th>Department</th>
                <th>Assigned Faculty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.map((subject) => (
                <tr key={subject._id}>
                  <td>{subject.code}</td>
                  <td>{subject.name}</td>
                  <td>{subject.semester}</td>
                  <td>{subject.department}</td>
                  <td>{subject.faculty?.userId?.name || 'Unassigned'}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(subject)}>Edit</button>
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
              <h3>{editingSubject ? 'Edit Subject' : 'Add Subject'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Subject Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Subject Code</label>
                  <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Semester</label>
                  <input type="number" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })} min="1" max="8" required />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Assign Faculty</label>
                <select value={formData.faculty} onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}>
                  <option value="">Select Faculty</option>
                  {facultyList.map((f) => (
                    <option key={f._id} value={f._id}>{f.userId?.name} ({f.employeeId})</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingSubject ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectManagement;
