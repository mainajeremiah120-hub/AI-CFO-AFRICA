import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Lazy-load every page so the initial bundle only contains routing logic.
// Each module loads on first visit — dramatically cuts first-paint JS.
const Login       = lazy(() => import('./pages/Login'));
const Register    = lazy(() => import('./pages/Register'));
const Dashboard   = lazy(() => import('./pages/Dashboard'));
const Accounting  = lazy(() => import('./pages/Accounting'));
const Receivables = lazy(() => import('./pages/Receivables'));
const Payables    = lazy(() => import('./pages/Payables'));
const Inventory   = lazy(() => import('./pages/Inventory'));
const Payroll     = lazy(() => import('./pages/payroll'));
const Procurement = lazy(() => import('./pages/Procurement'));
const Banking     = lazy(() => import('./pages/Banking'));
const Analytics   = lazy(() => import('./pages/Analytics'));
const Pos         = lazy(() => import('./pages/Pos'));
const Settings    = lazy(() => import('./pages/Settings'));

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const valid = token && token !== 'undefined' && token !== 'null';
  return valid ? children : <Navigate to="/login" replace />;
};

// Minimal inline spinner — no dependency, no flicker
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f9fafb' }}>
    <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTop: '3px solid #a31b32', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard"   element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/accounting"  element={<PrivateRoute><Accounting /></PrivateRoute>} />
          <Route path="/receivables" element={<PrivateRoute><Receivables /></PrivateRoute>} />
          <Route path="/payables"    element={<PrivateRoute><Payables /></PrivateRoute>} />
          <Route path="/inventory"   element={<PrivateRoute><Inventory /></PrivateRoute>} />
          <Route path="/payroll"     element={<PrivateRoute><Payroll /></PrivateRoute>} />
          <Route path="/procurement" element={<PrivateRoute><Procurement /></PrivateRoute>} />
          <Route path="/banking"     element={<PrivateRoute><Banking /></PrivateRoute>} />
          <Route path="/analytics"   element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="/pos"         element={<PrivateRoute><Pos /></PrivateRoute>} />
          <Route path="/settings"    element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="*"            element={<Navigate to="/login" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
