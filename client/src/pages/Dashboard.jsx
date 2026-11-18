import { useNavigate } from 'react-router-dom';
import { getUser, clearSession } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', padding: 16 }}>
      <h2>Welcome, {user?.name}</h2>
      <p>You are logged in as: <strong>{user?.role}</strong></p>

      {user?.role === 'business' && <p>Business area: browse and buy projects (coming soon).</p>}
      {user?.role === 'owner' && <p>Owner area: manage your projects (coming soon).</p>}
      {user?.role === 'verifier' && <p>Verifier area: review proofs (coming soon).</p>}

      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}