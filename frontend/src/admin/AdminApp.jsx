import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import ErrorBoundary from '../components/ErrorBoundary';

const AdminLogin = lazy(() => import('./AdminLogin'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const AnomaliesPage = lazy(() => import('./pages/AnomaliesPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const CamerasPage = lazy(() => import('./pages/CamerasPage'));
const ActiveLearningPage = lazy(() => import('./pages/ActiveLearningPage'));
const ExplainabilityPage = lazy(() => import('./pages/ExplainabilityPage'));
const ParkingsManagementPage = lazy(() => import('./pages/ParkingsManagementPage'));

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAdminAuth();
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
};

const AdminAppContent = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ background: '#0a0a0f', height: '100vh' }} />}>
        <Routes>
          <Route path="login" element={<AdminLogin />} />
          <Route 
            path="dashboard" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="anomalies" element={<AnomaliesPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="cameras" element={<CamerasPage />} />
            <Route path="parkings" element={<ParkingsManagementPage />} />
            <Route path="active-learning" element={<ActiveLearningPage />} />
            <Route path="explainability" element={<ExplainabilityPage />} />
          </Route>
          <Route path="*" element={<Navigate to="login" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

const AdminApp = () => {
  return (
    <AdminAuthProvider>
      <AdminAppContent />
    </AdminAuthProvider>
  );
};

export default AdminApp;
