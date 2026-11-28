import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!token) {
      setError('This reset link is invalid or missing.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await api('/auth/reset-password', {
        method: 'POST',
        body: { token, password },
      });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 16 }}>
      <h2>Choose a new password</h2>

      <form onSubmit={handleSubmit}>
        <label>New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          style={{ display: 'block', width: '100%', marginBottom: 12 }}
        />

        <label>Confirm new password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
          style={{ display: 'block', width: '100%', marginBottom: 12 }}
        />

        {message && <p>{message}</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        {!message && (
          <button type="submit" disabled={loading || !token}>
            {loading ? 'Updating...' : 'Update password'}
          </button>
        )}
      </form>

      {message && <p><Link to="/login">Go to login</Link></p>}
    </div>
  );
}