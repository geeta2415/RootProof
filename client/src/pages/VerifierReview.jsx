import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

function isPdf(url) {
  return /\.pdf($|\?)/i.test(url || '');
}

export default function VerifierReview() {
  const { id } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api(`/verifier/submissions/${id}`);
        if (!cancelled) setSubmission(data);
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
  }, [id]);

  async function handleApprove() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api(`/verifier/submissions/${id}/approve`, { method: 'POST' });
      setMessage(
        result.status === 'certified'
          ? 'Approved. The certificate was generated and the purchase is certified.'
          : 'Approved. The purchase is verified. The certificate will be added when it is ready.'
      );
      setDecided(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Please write a reason before rejecting.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api(`/verifier/submissions/${id}/reject`, {
        method: 'POST',
        body: { reason: trimmed },
      });
      setMessage(
        result.purchaseStatus === 'cancelled'
          ? 'Rejected. This was the second rejection, so the purchase is cancelled and the units were returned.'
          : 'Rejected. The purchase is back to pending so the owner can upload new proof.'
      );
      setDecided(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', padding: 16 }}>
      <Link to="/verifier/queue">&larr; Back to pending submissions</Link>
      <h1>Review proof</h1>

      {loading && <p>Loading submission... (the server may take up to 50 seconds to wake up)</p>}
      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
      {message && <p role="status" style={{ color: 'green' }}>{message}</p>}

      {submission && (
        <article style={{ border: '1px solid #888', borderRadius: 8, padding: 16 }}>
          <h2>{submission.project_title}</h2>
          <p><strong>Business:</strong> {submission.business_name}</p>
          <p><strong>Owner:</strong> {submission.owner_name}</p>
          <p><strong>Units:</strong> {submission.units_purchased} {submission.unit_label}</p>
          <p><strong>Proof type:</strong> {submission.proof_type}</p>
          <p><strong>Attempt:</strong> {submission.attempt} of 2</p>
          <p><strong>Submitted:</strong> {new Date(submission.submitted_at).toLocaleString()}</p>

          <h3>Proof</h3>
          {isPdf(submission.proof_file_url) || imageFailed ? (
            <p>
              <a href={submission.proof_file_url} target="_blank" rel="noreferrer">
                Open proof file in a new tab
              </a>
            </p>
          ) : (
            <img
              src={submission.proof_file_url}
              alt="Proof submitted by the owner"
              onError={() => setImageFailed(true)}
              style={{ maxWidth: '100%', borderRadius: 8 }}
            />
          )}

          {!decided && (
            <div style={{ marginTop: 20 }}>
              <h3>Decision</h3>
              <label>
                Reason (required to reject)
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  style={{ display: 'block', width: '100%', marginBottom: 12 }}
                />
              </label>
              <button onClick={handleApprove} disabled={busy}>Approve</button>{' '}
              <button onClick={handleReject} disabled={busy || !reason.trim()}>Reject</button>
            </div>
          )}

          {decided && (
            <p style={{ marginTop: 20 }}>
              <Link to="/verifier/queue">Back to pending submissions</Link>
            </p>
          )}
        </article>
      )}
    </main>
  );
}