import { useState, useEffect } from 'react';
import { getAllSubjects, createSubject, updateSubject } from '../services/subjectService';
import { getAllFaculty } from '../services/facultyService';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { toastError, toastValidation, toastSuccess } from '../utils/toastHelpers';

const PER_PAGE = 10;

const emptyForm = () => ({
  name: '',
  code: '',
  semester: 5,
  department: 'Computer Science',
  faculty: '',
});

const SubjectFormModal = ({ subject, facultyList, onClose, onSaved }) => {
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Edit mode me existing data bharo
  useEffect(() => {
    if (subject) {
      setFormData({
        name: subject.name,
        code: subject.code,
        semester: subject.semester,
        department: subject.department,
        faculty: subject.faculty?._id || '',
      });
    }
  }, [subject]);

  const updateField = (field, value) => setFormData({ ...formData, [field]: value });

  const validateForm = () => {
    if (!formData.name.trim()) {
      toastValidation('Subject name is required.');
      return false;
    }
    if (!formData.code.trim()) {
      toastValidation('Subject code is required.');
      return false;
    }
    if (formData.semester < 1 || formData.semester > 8) {
      toastValidation('Semester must be between 1 and 8.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);

    try {
      if (subject) {
        await updateSubject(subject._id, formData);
        toastSuccess('Subject updated successfully.');
      } else {
        await createSubject(formData);
        toastSuccess('Subject created successfully.');
      }

      onSaved();
    } catch (error) {
      toastError(error, 'Failed to save subject');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{subject ? 'Edit Subject' : 'Add Subject'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Subject Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Subject Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => updateField('code', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Semester</label>
              <input
                type="number"
                value={formData.semester}
                onChange={(e) => updateField('semester', parseInt(e.target.value))}
                min="1"
                max="8"
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
            <label>Assign Faculty</label>
            <select value={formData.faculty} onChange={(e) => updateField('faculty', e.target.value)}>
              <option value="">Select Faculty</option>
              {facultyList.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.userId?.name} ({f.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : subject ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SubjectManagement = () => {
  const [subjects, setSubjects] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const [subjectsRes, facultyRes] = await Promise.all([getAllSubjects(), getAllFaculty()]);
      setSubjects(subjectsRes.data.data);
      setFacultyList(facultyRes.data.data);
    } catch (error) {
      toastError(error, 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingSubject(null);
    setShowModal(true);
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditingSubject(null);
    fetchData();
  };

  const filteredSubjects = subjects.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.code?.toLowerCase().includes(search.toLowerCase())
  );

  const { page, setPage, total, pageItems } = usePagination(filteredSubjects, PER_PAGE);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading subjects...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Subject Management</h2>
        <button className="btn btn-primary" onClick={openAddModal}>
          + Add Subject
        </button>
      </div>

      <div className="card">
        <div className="search-input">
          <input
            type="text"
            placeholder="Search by name or code..."
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
                <th>Code</th>
                <th>Name</th>
                <th>Semester</th>
                <th>Department</th>
                <th>Assigned Faculty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((subject) => (
                <tr key={subject._id}>
                  <td>{subject.code}</td>
                  <td>{subject.name}</td>
                  <td>{subject.semester}</td>
                  <td>{subject.department}</td>
                  <td>{subject.faculty?.userId?.name || 'Unassigned'}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(subject)}>
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
        <SubjectFormModal
          subject={editingSubject}
          facultyList={facultyList}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default SubjectManagement;
