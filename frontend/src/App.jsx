import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Accounting from './pages/Accounting';
import Receivables from './pages/Receivables';
import Payables from './pages/Payables';
import Inventory from './pages/Inventory';
import Payroll from './pages/payroll';
import Procurement from './pages/procurement';
import Banking from './pages/banking';
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/accounting" element={<PrivateRoute><Accounting /></PrivateRoute>} />
        <Route path="/receivables" element={<PrivateRoute><Receivables /></PrivateRoute>} />
        <Route path="/payables" element={<PrivateRoute><Payables /></PrivateRoute>} />
        <Route path="/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />
        <Route path="/payroll" element={<PrivateRoute><Payroll /></PrivateRoute>} />
        <Route path="/procurement" element={<PrivateRoute><Procurement /></PrivateRoute>} />
        <Route path="/banking" element={<PrivateRoute><Banking /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}