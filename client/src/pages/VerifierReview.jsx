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

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', padding: 16 }}>
      <Link to="/verifier/queue">&larr; Back to pending submissions</Link>
      <h1>Review proof</h1>

      {loading && <p>Loading submission... (the server may take up to 50 seconds to wake up)</p>}
      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}

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
        </article>
      )}
    </main>
  );
}