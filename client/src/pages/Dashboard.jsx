import { useNavigate, Link } from 'react-router-dom';
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

      {user?.role === 'business' && (
        <div>
          <p>Business area: browse and buy projects.</p>
          <button onClick={() => navigate('/browse')}>Browse projects</button>{' '}
          <button onClick={() => navigate('/purchases/mine')}>My purchases</button>
        </div>
      )}
      {user?.role === 'owner' && <p><Link to="/my-projects">Manage my projects</Link></p>}
{user?.role === 'verifier' && <p><Link to="/verifier/queue">Review pending submissions</Link></p>}
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}