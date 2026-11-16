import { Navigate } from 'react-router-dom';
import { getToken, getUser } from '../api';

export default function ProtectedRoute({ children, roles }) {
  if (!getToken()) return <Navigate to="/login" replace />;

  const user = getUser();
  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}