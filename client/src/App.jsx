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
import VerifierQueue from './pages/VerifierQueue';
import OwnerPurchases from './pages/OwnerPurchases';
import VerifierReview from './pages/VerifierReview';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/browse" element={<ProtectedRoute><Browse /></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
        <Route path="/purchase/confirm" element={<ProtectedRoute><PurchaseConfirm /></ProtectedRoute>} />
        <Route path="/purchases/mine" element={<ProtectedRoute><PurchaseHistory /></ProtectedRoute>} />
        <Route path="/my-projects" element={<ProtectedRoute><MyProjects /></ProtectedRoute>} />
        <Route path="/owner/purchases" element={<ProtectedRoute roles={['owner']}><OwnerPurchases /></ProtectedRoute>} />
        <Route path="/verifier/queue" element={<ProtectedRoute roles={['verifier']}><VerifierQueue /></ProtectedRoute>} />
        <Route path="/verifier/review/:id" element={<ProtectedRoute roles={['verifier']}><VerifierReview /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}