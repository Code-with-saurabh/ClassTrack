import { useState, useEffect } from 'react';
import {
  getAllStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from '../services/studentService';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { toastError, toastValidation, toastSuccess } from '../utils/toastHelpers';

const PER_PAGE = 10;

const emptyForm = () => ({
  name: '',
  email: '',
  password: '',
  rollNumber: '',
  semester: 5,
  division: 'A',
  department: 'Computer Science',
  academicYear: '2025-2026',
});

const StudentFormModal = ({ student, onClose, onSaved }) => {
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Edit mode me existing data bharo
  useEffect(() => {
    if (student) {
      setFormData({
        name: student.userId?.name || '',
        email: student.userId?.email || '',
        password: '',
        rollNumber: student.rollNumber,
        semester: student.semester,
        division: student.division,
        department: student.department,
        academicYear: student.academicYear,
      });
    }
  }, [student]);

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
    if (!student && formData.password.length < 6) {
      toastValidation('Password must be at least 6 characters.');
      return false;
    }
    if (!formData.rollNumber.trim()) {
      toastValidation('Roll number is required.');
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
      if (student) {
        await updateStudent(student._id, formData);
        toastSuccess('Student updated successfully.');
      } else {
        await createStudent(formData);
        toastSuccess('Student created successfully.');
      }

      onSaved();
    } catch (error) {
      toastError(error, 'Failed to save student');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{student ? 'Edit Student' : 'Add Student'}</h3>
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

          {!student && (
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
              <label>Roll Number</label>
              <input
                type="text"
                value={formData.rollNumber}
                onChange={(e) => updateField('rollNumber', e.target.value)}
                required
              />
            </div>
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
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Division</label>
              <input
                type="text"
                value={formData.division}
                onChange={(e) => updateField('division', e.target.value)}
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
            <label>Academic Year</label>
            <input
              type="text"
              value={formData.academicYear}
              onChange={(e) => updateField('academicYear', e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : student ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [search, setSearch] = useState('');

  const fetchStudents = async () => {
    try {
      const { data } = await getAllStudents();
      setStudents(data.data);
    } catch (error) {
      toastError(error, 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const openAddModal = () => {
    setEditingStudent(null);
    setShowModal(true);
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditingStudent(null);
    fetchStudents();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student?')) {
      toastValidation('Delete cancelled.');
      return;
    }

    try {
      await deleteStudent(id);
      toastSuccess('Student deleted successfully.');
      fetchStudents();
    } catch (error) {
      toastError(error, 'Failed to delete student');
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.rollNumber?.includes(search) ||
      s.userId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const { page, setPage, total, pageItems } = usePagination(filteredStudents, PER_PAGE);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading students...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Student Management</h2>
        <button className="btn btn-primary" onClick={openAddModal}>
          + Add Student
        </button>
      </div>

      <div className="card">
        <div className="search-input">
          <input
            type="text"
            placeholder="Search by name or roll number..."
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
                <th>Roll No.</th>
                <th>Name</th>
                <th>Email</th>
                <th>Semester</th>
                <th>Division</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((student) => (
                <tr key={student._id}>
                  <td>{student.rollNumber}</td>
                  <td>{student.userId?.name}</td>
                  <td>{student.userId?.email}</td>
                  <td>{student.semester}</td>
                  <td>{student.division}</td>
                  <td>{student.department}</td>
                  <td>
                    <span className={`badge ${student.userId?.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {student.userId?.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(student)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(student._id)}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Delete
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
        <StudentFormModal
          student={editingStudent}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default StudentManagement;
