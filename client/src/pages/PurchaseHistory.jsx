import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    async function loadPurchases() {
      try {
        const data = await api('/purchases/mine');
        setPurchases(
          Array.isArray(data) ? data : (data.purchases || [])
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPurchases();
  }, []);
  async function downloadCertificate(purchaseId) {
  setError('');
  setDownloadingId(purchaseId);

  try {
    const result = await api(`/purchases/${purchaseId}/certificate`);

    if (!result?.certificateUrl) {
      throw new Error('The certificate URL was not returned.');
    }

    window.location.assign(result.certificateUrl);
  } catch (err) {
    setError(err.message || 'Failed to download certificate.');
  } finally {
    setDownloadingId(null);
  }
}

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', padding: 16 }}>
      <Link to="/browse">← Back to projects</Link>
      <h1>Purchase history</h1>

      {loading && <p>Loading your purchases…</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && purchases.length === 0 && (
        <p>You haven’t made any purchases yet.</p>
      )}

      {!loading && !error && purchases.length > 0 && (
        <div>
          {purchases.map((purchase, index) => (
            <article
              key={purchase.id || index}
              style={{ border: '1px solid #888', borderRadius: 8, padding: 16, marginBottom: 12 }}
            >
              <h2>{purchase.project_title || 'Project'}</h2>
              <p>Quantity: {purchase.units_purchased} {purchase.unit_label}</p>
              <p>Total: {Number(purchase.total_cost).toFixed(2)}</p>
              <p>Status: <strong>{purchase.status}</strong></p>
              {purchase.certificate_url  && (
              <button
                type="button"
                onClick={() => downloadCertificate(purchase.id)}
                disabled={downloadingId === purchase.id}
              >
                {downloadingId === purchase.id
                  ? 'Opening certificate...'
                  : 'Download certificate'}
              </button>
            )}
              {purchase.purchase_date && (
                <p>Date: {new Date(purchase.purchase_date).toLocaleString()}</p>
            )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}