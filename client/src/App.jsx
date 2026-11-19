import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Browse from './pages/Browse';
import ProjectDetails from './pages/ProjectDetails';
import PurchaseConfirm from './pages/PurchaseConfirm';
import PurchaseHistory from './pages/PurchaseHistory';
import MyProjects from './pages/MyProjects';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/browse" element={<ProtectedRoute><Browse /></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
        <Route path="/purchase/confirm" element={<ProtectedRoute><PurchaseConfirm /></ProtectedRoute>} />
        <Route path="/purchases/mine" element={<ProtectedRoute><PurchaseHistory /></ProtectedRoute>} />
        <Route path="/my-projects" element={<ProtectedRoute><MyProjects /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
