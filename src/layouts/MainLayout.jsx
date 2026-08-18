import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLabTrack } from '../context/LabTrackContext';
import { NotificationPanel } from '../components/notification/NotificationPanel';
import { Breadcrumb } from '../components/common/Breadcrumb';
import {
  LayoutDashboard,
  Building2,
  Package,
  Users,
  History,
  FileSpreadsheet,
  ArrowRightLeft,
  BarChart3,
  BrainCircuit,
  Bell,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  Search,
  BookOpen,
  Send,
  CalendarCheck,
  PackagePlus,
  QrCode
} from 'lucide-react';

export const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { notificationsList } = useLabTrack();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const role = user?.role || 'student';
  const roleNotifications = notificationsList.filter(n => {
    if (n.targetRoles && n.targetRoles.length > 0 && !n.targetRoles.includes(role)) return false;
    if (role === 'admin') {
      const allowed = ['equipment_addition', 'bulk_import', 'bulk_event_issue', 'inter_lab_transfer', 'system'];
      if (n.category && !allowed.includes(n.category)) return false;
    }
    return true;
  });

  const unreadCount = roleNotifications.filter(n => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Nav Configurations by Role
  const getNavItems = () => {
    const role = user?.role || 'student';

    if (role === 'admin') {
      return [
        { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'Labs', path: '/labs', icon: Building2 },
        { label: 'Equipment', path: '/equipment', icon: Package },
        { label: 'Users', path: '/users', icon: Users },
        { label: 'Transactions', path: '/transactions', icon: History },
        { label: 'Requests', path: '/requests', icon: FileSpreadsheet },
        { label: 'Inter-Lab Transfers', path: '/inter-lab-transfers', icon: ArrowRightLeft },
        { label: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
        { label: 'Smart Procurement', path: '/smart-procurement', icon: BrainCircuit },
        { label: 'Notifications', path: '/notifications', icon: Bell, badge: unreadCount },
        { label: 'Settings', path: '/settings', icon: Settings }
      ];
    }

    if (role === 'assistant') {
      return [
        { label: 'Dashboard', path: '/assistant/dashboard', icon: LayoutDashboard },
        { label: 'Equipment', path: '/equipment', icon: Package },
        { label: 'Issue Equipment', path: '/issue-equipment', icon: QrCode },
        { label: 'Return Equipment', path: '/return-equipment', icon: History },
        { label: 'Bulk Import', path: '/bulk-import', icon: PackagePlus },
        { label: 'Requests', path: '/requests', icon: FileSpreadsheet },
        { label: 'Inter-Lab Transfers', path: '/inter-lab-transfers', icon: ArrowRightLeft },
        { label: 'Transactions', path: '/transactions', icon: History },
        { label: 'Notifications', path: '/notifications', icon: Bell, badge: unreadCount },
        { label: 'Profile', path: '/profile', icon: User }
      ];
    }

    if (role === 'faculty') {
      return [
        { label: 'Dashboard', path: '/faculty/dashboard', icon: LayoutDashboard },
        { label: 'Browse Equipment', path: '/browse-equipment', icon: Search },
        { label: 'Request Equipment', path: '/request-equipment', icon: Send },
        { label: 'My Borrowings', path: '/transactions', icon: BookOpen },
        { label: 'My Requests', path: '/requests', icon: FileSpreadsheet },
        { label: 'Event / Club Issue', path: '/event-issue', icon: CalendarCheck },
        { label: 'Inter-Lab Requests', path: '/inter-lab-transfers', icon: ArrowRightLeft },
        { label: 'Notifications', path: '/notifications', icon: Bell, badge: unreadCount },
        { label: 'Profile', path: '/profile', icon: User }
      ];
    }

    // Student
    return [
      { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
      { label: 'Browse Equipment', path: '/browse-equipment', icon: Search },
      { label: 'Request Equipment', path: '/request-equipment', icon: Send },
      { label: 'My Borrowings', path: '/transactions', icon: BookOpen },
      { label: 'My Requests', path: '/requests', icon: FileSpreadsheet },
      { label: 'Notifications', path: '/notifications', icon: Bell, badge: unreadCount },
      { label: 'Profile', path: '/profile', icon: User }
    ];
  };

  const navItems = getNavItems();

  return (
    <div className="app-container">
      {/* OFFICIAL UNIVERSITY TOP HEADER */}
      <header
        style={{
          backgroundColor: 'var(--color-bg-header)',
          borderBottom: '3px solid #1e40af',
          color: '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 900
        }}
      >
        {/* Top institutional strip */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-header-top)',
            padding: '4px 1.5rem',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <span>OFFICIAL UNIVERSITY LABORATORY MANAGEMENT PORTAL</span>
          <span>Academic Year 2025–2026</span>
        </div>

        {/* Main Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.5rem'
          }}
        >
          {/* Left Brand / Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer'
              }}
              className="mobile-toggle-btn"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* University Crest Placeholder */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                color: '#1e3a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1rem',
                border: '2px solid #3b82f6',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              U
            </div>

            <div>
              <Link to="/" style={{ textDecoration: 'none', color: '#ffffff' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.05em', lineHeight: 1 }}>
                  LABTRACK
                </div>
                <div style={{ fontSize: '0.7rem', color: '#93c5fd', fontWeight: 400, marginTop: '2px' }}>
                  Smart Laboratory Equipment Management System
                </div>
              </Link>
            </div>
          </div>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                  position: 'relative'
                }}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <NotificationPanel onClose={() => setShowNotifications(false)} />
              )}
            </div>

            {/* User Profile Tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '1rem', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                  {user?.name || 'Portal User'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#cbd5e1', textTransform: 'capitalize' }}>
                  Role: <span style={{ color: '#93c5fd', fontWeight: 600 }}>{user?.role || 'Guest'}</span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Logout"
                className="btn btn-sm"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '6px'
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* BODY CONTENT AREA WITH SIDEBAR */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside
          style={{
            width: '240px',
            backgroundColor: 'var(--color-bg-sidebar)',
            borderRight: '1px solid var(--color-border)',
            padding: '1.25rem 0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 'calc(100vh - 85px)'
          }}
          className="portal-sidebar"
        >
          <div>
            <div style={{ padding: '0 1.25rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              MAIN NAVIGATION
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 1.25rem',
                      fontSize: '0.85rem',
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? '#1d4ed8' : '#334155',
                      backgroundColor: isActive ? '#eff6ff' : 'transparent',
                      borderLeft: isActive ? '4px solid #1d4ed8' : '4px solid transparent',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Icon size={18} style={{ color: isActive ? '#1d4ed8' : '#64748b' }} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge > 0 && (
                      <span
                        style={{
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '9999px',
                          fontWeight: 700
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Institutional Footer Widget */}
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>LabTrack Portal v2.4</div>
            <div>University IT Support Line</div>
            <div style={{ color: '#1e40af', marginTop: '2px' }}>support@university.edu</div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main style={{ flex: 1, padding: '1.5rem 2rem', backgroundColor: '#f8fafc', overflowX: 'hidden' }}>
          <Breadcrumb />
          {children}
        </main>
      </div>
    </div>
  );
};
