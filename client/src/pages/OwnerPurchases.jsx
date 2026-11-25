import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiUpload } from '../api';

const STATUS_TEXT = {
  pending: 'Waiting for proof',
  under_review: 'Under review by a verifier',
  verified: 'Verified (certificate is being prepared)',
  certified: 'Certified',
  cancelled: 'Cancelled (units returned)',
};

const box = { border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 12 };
const input = { display: 'block', width: '100%', padding: 8, marginBottom: 10, boxSizing: 'border-box' };

function PurchaseCard({ p, onDone }) {
  const [proofType, setProofType] = useState('photo');
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canUpload = p.status === 'pending' && p.attempts < 2;
  const isResubmit = p.attempts === 1;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!file) return setError('Please choose a file');
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) return setError('Only images and PDF files are allowed');
    if (file.size > 5 * 1024 * 1024) return setError('File must be 5 MB or smaller');

    const formData = new FormData();
    formData.append('proofType', proofType);
    formData.append('file', file);
    if (notes.trim()) formData.append('notes', notes.trim());

    setSaving(true);
    try {
      await apiUpload(`/owner/purchases/${p.id}/proof`, formData);
      setFile(null);
      setNotes('');
      onDone(isResubmit ? 'Proof resubmitted.' : 'Proof uploaded. A verifier will review it.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={box}>
      <strong>{p.project_title}</strong>
      <div>Business: {p.business_name}</div>
      <div>Units: {p.units_purchased} {p.unit_label}</div>
      <div>Bought: {new Date(p.purchase_date).toLocaleDateString()}</div>
      <div>Status: <strong>{STATUS_TEXT[p.status] || p.status}</strong></div>
      <div>Proof attempts: {p.attempts} of 2</div>

      {p.last_rejection_reason && (
        <div style={{ background: '#fff3f3', border: '1px solid crimson', borderRadius: 6, padding: 8, marginTop: 8 }}>
          <strong>Rejection reason:</strong> {p.last_rejection_reason}
        </div>
      )}

      {p.certificate_url && (
        <p><a href={p.certificate_url} target="_blank" rel="noreferrer">View certificate</a></p>
      )}

      {canUpload && (
        <form onSubmit={handleSubmit} style={{ marginTop: 10 }}>
          <h4 style={{ margin: '8px 0' }}>
            {isResubmit ? 'Resubmit proof (last attempt)' : 'Upload proof'}
          </h4>
          <label>
            Proof type
            <select value={proofType} onChange={(e) => setProofType(e.target.value)} style={input}>
              <option value="photo">Photo</option>
              <option value="gps">GPS data</option>
              <option value="receipt">Receipt</option>
            </select>
          </label>
          <label>
            File (image or PDF, max 5 MB)
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files[0] || null)}
              style={input}
            />
          </label>
          <label>
            Notes (optional)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={input} rows={2} />
          </label>
          {error && <p style={{ color: 'crimson' }}>{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? 'Uploading...' : isResubmit ? 'Resubmit proof' : 'Upload proof'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function OwnerPurchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const data = await api('/owner/purchases');
      setPurchases(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleDone(msg) {
    setMessage(msg);
    load();
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 16 }}>
      <p><Link to="/dashboard">&larr; Back to dashboard</Link></p>
      <h2>Purchases on my projects</h2>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {loading && <p>Loading... (the server may take up to 50 seconds to wake up)</p>}
      {!loading && !error && purchases.length === 0 && <p>No purchases on your projects yet.</p>}

      {purchases.map((p) => (
        <PurchaseCard key={p.id} p={p} onDone={handleDone} />
      ))}
    </div>
  );
}