import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LabTrackProvider } from './context/LabTrackContext';
import { MainLayout } from './layouts/MainLayout';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { AdminDashboard } from './pages/dashboards/AdminDashboard';
import { AssistantDashboard } from './pages/dashboards/AssistantDashboard';
import { FacultyDashboard } from './pages/dashboards/FacultyDashboard';
import { StudentDashboard } from './pages/dashboards/StudentDashboard';

import { EquipmentListPage } from './pages/equipment/EquipmentListPage';
import { AddEquipmentPage } from './pages/equipment/AddEquipmentPage';
import { EquipmentDetailPage } from './pages/equipment/EquipmentDetailPage';
import { BrowseEquipmentPage } from './pages/equipment/BrowseEquipmentPage';

import { IssueEquipmentPage } from './pages/operations/IssueEquipmentPage';
import { ReturnEquipmentPage } from './pages/operations/ReturnEquipmentPage';
import { EventIssuePage } from './pages/operations/EventIssuePage';
import { BulkImportPage } from './pages/operations/BulkImportPage';

import { LabsListPage } from './pages/labs/LabsListPage';
import { RequestsListPage } from './pages/requests/RequestsListPage';
import { RequestEquipmentPage } from './pages/requests/RequestEquipmentPage';
import { ExtendRequestPage } from './pages/requests/ExtendRequestPage';
import { InterLabTransfersPage } from './pages/requests/InterLabTransfersPage';
import { TransactionsListPage } from './pages/transactions/TransactionsListPage';

import { ReportsAnalyticsPage } from './pages/analytics/ReportsAnalyticsPage';
import { SmartProcurementPage } from './pages/analytics/SmartProcurementPage';

import { UserManagementPage } from './pages/users/UserManagementPage';
import { NotificationsPage } from './pages/user/NotificationsPage';
import { ProfilePage } from './pages/user/ProfilePage';
import { SettingsPage } from './pages/user/SettingsPage';

// Protected Route Wrapper with Role check
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to proper role dashboard if unauthorized for this specific page
    switch (user?.role) {
      case 'admin': return <Navigate to="/admin/dashboard" replace />;
      case 'assistant': return <Navigate to="/assistant/dashboard" replace />;
      case 'faculty': return <Navigate to="/faculty/dashboard" replace />;
      case 'student': return <Navigate to="/student/dashboard" replace />;
      default: return <Navigate to="/login" replace />;
    }
  }

  return <MainLayout>{children}</MainLayout>;
};

// Root Redirect Component
const RootRedirect = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  switch (user?.role) {
    case 'admin': return <Navigate to="/admin/dashboard" replace />;
    case 'assistant': return <Navigate to="/assistant/dashboard" replace />;
    case 'faculty': return <Navigate to="/faculty/dashboard" replace />;
    case 'student': return <Navigate to="/student/dashboard" replace />;
    default: return <Navigate to="/login" replace />;
  }
};

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <LabTrackProvider>
          <Router>
            <Routes>
              {/* Public Auth Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Root Redirect */}
              <Route path="/" element={<RootRedirect />} />

              {/* Role Dashboards */}
              <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/assistant/dashboard" element={<ProtectedRoute allowedRoles={['assistant']}><AssistantDashboard /></ProtectedRoute>} />
              <Route path="/faculty/dashboard" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
              <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />

              {/* Equipment Pages */}
              <Route path="/equipment" element={<ProtectedRoute allowedRoles={['admin', 'assistant']}><EquipmentListPage /></ProtectedRoute>} />
              <Route path="/equipment/add" element={<ProtectedRoute allowedRoles={['admin', 'assistant']}><AddEquipmentPage /></ProtectedRoute>} />
              <Route path="/equipment/:id" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty', 'student']}><EquipmentDetailPage /></ProtectedRoute>} />
              <Route path="/browse-equipment" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty', 'student']}><BrowseEquipmentPage /></ProtectedRoute>} />

              {/* Operations Pages (Counter issue/return exclusive to Lab Assistant) */}
              <Route path="/issue-equipment" element={<ProtectedRoute allowedRoles={['assistant']}><IssueEquipmentPage /></ProtectedRoute>} />
              <Route path="/return-equipment" element={<ProtectedRoute allowedRoles={['assistant']}><ReturnEquipmentPage /></ProtectedRoute>} />
              <Route path="/event-issue" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty']}><EventIssuePage /></ProtectedRoute>} />
              <Route path="/bulk-import" element={<ProtectedRoute allowedRoles={['admin', 'assistant']}><BulkImportPage /></ProtectedRoute>} />

              {/* Labs & Management */}
              <Route path="/labs" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty', 'student']}><LabsListPage /></ProtectedRoute>} />
              <Route path="/requests" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty', 'student']}><RequestsListPage /></ProtectedRoute>} />
              <Route path="/request-equipment" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty', 'student']}><RequestEquipmentPage /></ProtectedRoute>} />
              <Route path="/extend-request/:transactionId" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty', 'student']}><ExtendRequestPage /></ProtectedRoute>} />
              <Route path="/inter-lab-transfers" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty']}><InterLabTransfersPage /></ProtectedRoute>} />
              <Route path="/transactions" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty', 'student']}><TransactionsListPage /></ProtectedRoute>} />

              {/* Analytics & Smart Procurement */}
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin']}><ReportsAnalyticsPage /></ProtectedRoute>} />
              <Route path="/smart-procurement" element={<ProtectedRoute allowedRoles={['admin']}><SmartProcurementPage /></ProtectedRoute>} />

              {/* User & Settings */}
              <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagementPage /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty', 'student']}><NotificationsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute allowedRoles={['admin', 'assistant', 'faculty', 'student']}><ProfilePage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><SettingsPage /></ProtectedRoute>} />

              {/* Catch-all fallback */}
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Router>
        </LabTrackProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
