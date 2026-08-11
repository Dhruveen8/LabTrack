import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, UserCheck, GraduationCap, Briefcase, Lock, User, ArrowRight } from 'lucide-react';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, switchDemoRole } = useAuth();

  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedRole, setSelectedRole] = useState('admin');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    await login(emailOrId || 'admin@university.edu', password || 'password', selectedRole);
    navigateToRoleDashboard(selectedRole);
  };

  const handleDemoLogin = (role) => {
    setSelectedRole(role);
    switchDemoRole(role);
    navigateToRoleDashboard(role);
  };

  const navigateToRoleDashboard = (role) => {
    switch (role) {
      case 'admin':
        navigate('/admin/dashboard');
        break;
      case 'assistant':
        navigate('/assistant/dashboard');
        break;
      case 'faculty':
        navigate('/faculty/dashboard');
        break;
      case 'student':
        navigate('/student/dashboard');
        break;
      default:
        navigate('/admin/dashboard');
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
        <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, marginTop: '0.35rem' }}>
          OFFICIAL UNIVERSITY SINGLE SIGN-ON PORTAL
        </div>
      </div>

      {/* Main Login Portal Box */}
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
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
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Account Authentication</span>
          <span style={{ fontSize: '0.75rem', color: '#bfdbfe' }}>Secure SSL 256-bit</span>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">University ID / Email Address</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '34px' }}
                  placeholder="e.g. STU-2024-884 or user@university.edu"
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Please contact University IT Helpdesk to reset password.'); }} style={{ fontSize: '0.75rem', color: '#1e40af' }}>
                  Forgot Password?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="password"
                  className="form-control"
                  style={{ paddingLeft: '34px' }}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember Me
              </label>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.65rem' }}>
              Sign In to Portal <ArrowRight size={16} />
            </button>
          </form>

          {/* Quick Demo Login Triggers */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', textAlign: 'center' }}>
              INSTANT DEMO LOGIN BY ROLE
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin('admin')}
                style={{ justifyContent: 'flex-start' }}
              >
                <ShieldCheck size={14} style={{ color: '#1e40af' }} /> Admin
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin('assistant')}
                style={{ justifyContent: 'flex-start' }}
              >
                <UserCheck size={14} style={{ color: '#059669' }} /> Lab Assistant
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin('faculty')}
                style={{ justifyContent: 'flex-start' }}
              >
                <Briefcase size={14} style={{ color: '#d97706' }} /> Faculty
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin('student')}
                style={{ justifyContent: 'flex-start' }}
              >
                <GraduationCap size={14} style={{ color: '#7c3aed' }} /> Student
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
          University Information Technology Services © 2024–2025
        </div>
      </div>
    </div>
  );
};
