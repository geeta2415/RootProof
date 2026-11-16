import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('business');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: { name, email, password, role },
      });
      saveSession(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 16 }}>
      <h2>Create your RootProof account</h2>
      <form onSubmit={handleSubmit}>
        <label>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 12 }}
        />
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 12 }}
        />
        <label>Password (at least 8 characters)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={{ display: 'block', width: '100%', marginBottom: 12 }}
        />
        <label>I am a</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 12 }}
        >
          <option value="business">Business (I want to fund projects)</option>
          <option value="owner">Project owner (I run a project)</option>
        </select>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}