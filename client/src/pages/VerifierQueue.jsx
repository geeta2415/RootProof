import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function VerifierQueue() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api('/verifier/submissions');
        if (!cancelled) setSubmissions(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', padding: 16 }}>
      <Link to="/dashboard">&larr; Back to dashboard</Link>
      <h1>Pending submissions</h1>
      <p>Oldest first. Open one to review the proof.</p>

      {loading && <p>Loading submissions... (the server may take up to 50 seconds to wake up)</p>}
      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
      {!loading && !error && submissions.length === 0 && (
        <p>No submissions are waiting for review.</p>
      )}

      {submissions.map((s) => (
        <article
          key={s.id}
          style={{ border: '1px solid #888', borderRadius: 8, padding: 16, marginBottom: 12 }}
        >
          <h2>{s.project_title}</h2>
          <p><strong>Business:</strong> {s.business_name}</p>
          <p><strong>Owner:</strong> {s.owner_name}</p>
          <p><strong>Units:</strong> {s.units_purchased} {s.unit_label}</p>
          <p><strong>Proof type:</strong> {s.proof_type}</p>
          <p><strong>Attempt:</strong> {s.attempt} of 2</p>
          <p><strong>Submitted:</strong> {new Date(s.submitted_at).toLocaleString()}</p>
          <Link to={`/verifier/review/${s.id}`}>Review proof</Link>
        </article>
      ))}
    </main>
  );
}