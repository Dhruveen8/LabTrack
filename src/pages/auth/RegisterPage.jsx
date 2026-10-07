import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { idExample, resolveInstitutionalId } from '../../utils/userIds';
import { User, Lock, Mail, ArrowRight } from 'lucide-react';

export const RegisterPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    universityId: '',
    departmentId: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState('');

  useEffect(() => {
    let active = true;
    apiClient.get('/auth/registration-departments').then(({ data }) => {
      if (!active) return;
      setDepartments(data);
      if (!data.length) setDepartmentsError('No departments are available. Please contact the administrator.');
    }).catch(() => {
      if (active) setDepartmentsError('Unable to load departments. Please refresh and try again.');
    }).finally(() => {
      if (active) setDepartmentsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name || !formData.email || !formData.password || !formData.departmentId) {
      setError('Please fill in all required fields.');
      return;
    }

    const email = formData.email.trim().toLowerCase();
    // Role-based email validation
    const isStudent = formData.role === 'student';
    const isFacultyOrAsst = ['faculty', 'assistant'].includes(formData.role);

    if (isStudent && !email.endsWith('@charusat.edu.in')) {
      setError('Student emails must end in @charusat.edu.in');
      return;
    }

    if (isFacultyOrAsst && !email.endsWith('@charusat.ac.in')) {
      setError('Faculty and Assistant emails must end in @charusat.ac.in');
      return;
    }

    try {
      const universityId = resolveInstitutionalId(formData.role, formData.universityId, email);
      await apiClient.post('/auth/register', {
        name: formData.name.trim(), email, password: formData.password,
        role: formData.role.toUpperCase(), university_id: universityId,
        department_id: Number(formData.departmentId),
      });

      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(item => item.msg).join('; ') : err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
    >
      {/* Official Top Institutional Banner */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#1e3a8a',
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.75rem',
            border: '3px solid #3b82f6',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            marginBottom: '0.75rem'
          }}
        >
          U
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.05em', margin: 0 }}>
          LABTRACK
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, marginTop: '0.25rem' }}>
          Smart Laboratory Equipment Management System
        </p>
      </div>

      {/* Main Registration Portal Box */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#1e3a8a',
            color: '#ffffff',
            borderBottom: '1px solid #1e40af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Account Registration</span>
          <span style={{ fontSize: '0.75rem', color: '#bfdbfe' }}>Secure SSL 256-bit</span>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <form onSubmit={handleRegisterSubmit}>
            {error && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '0.65rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.85rem'
              }}>
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                padding: '0.65rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.85rem'
              }}>
                ✅ {success}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  name="name"
                  className="form-control"
                  style={{ paddingLeft: '34px' }}
                  placeholder="e.g. Dhruveen Patel"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">University Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="email"
                  name="email"
                  className="form-control"
                  style={{ paddingLeft: '34px' }}
                  placeholder="e.g. 24ce001@charusat.edu.in"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Role</label>
              <div role="group" aria-label="Registration role" style={{ display: 'flex', gap: '0.5rem' }}>
                {[['student', 'Student'], ['faculty', 'Faculty'], ['assistant', 'Assistant']].map(([role, label]) => (
                  <button key={role} type="button" aria-pressed={formData.role === role}
                    className={`btn ${formData.role === role ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }} onClick={() => setFormData(previous => ({ ...previous, role, universityId: '' }))}>
                    {label}
                  </button>
                ))}
              </div>
              {formData.role !== 'student' && (
                <div style={{ fontSize: '0.75rem', color: '#0369a1', marginTop: '0.25rem' }}>
                  Note: Faculty and Assistant accounts require Admin approval before activation.
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              {formData.role === 'assistant' ? <p>Your assistant ID is assigned automatically, for example ASST001.</p> : <>
                <label className="form-label" htmlFor="registration-id">{formData.role === 'student' ? 'Student' : 'Faculty'} ID</label>
                <input id="registration-id" name="universityId" className="form-control"
                  placeholder={idExample(formData.role)} value={formData.universityId} onChange={handleChange} maxLength={32} />
                <small>Example: {idExample(formData.role)}. If blank, your email ID is used.</small>
              </>}
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="registration-department">Department</label>
              <select id="registration-department" name="departmentId" className="form-control" required
                value={formData.departmentId} onChange={handleChange} disabled={departmentsLoading || !!departmentsError}>
                <option value="">{departmentsLoading ? 'Loading departments...' : 'Select your department'}</option>
                {departments.map(department => (
                  <option key={department.id} value={department.id}>{department.code} — {department.name}</option>
                ))}
              </select>
              {departmentsError && <small role="alert" style={{ color: '#991b1b' }}>{departmentsError}</small>}
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="password"
                  name="password"
                  className="form-control"
                  style={{ paddingLeft: '34px' }}
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={departmentsLoading || !!departmentsError}
              style={{ width: '100%', padding: '0.65rem', marginBottom: '1rem' }}>
              Register Account <ArrowRight size={16} />
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#475569' }}>
              Already have an account? <Link to="/login" style={{ color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>Sign In here</Link>
            </div>
          </form>
        </div>

        <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
          University Information Technology Services © 2026–2027
        </div>
      </div>
    </div>
  );
};
