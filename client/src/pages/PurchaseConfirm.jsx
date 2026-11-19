import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';

export default function PurchaseConfirm() {
  const { state } = useLocation();
  const project = state?.project;
  const quantity = Number(state?.quantity);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [purchase, setPurchase] = useState(null);

  if (!project || !Number.isInteger(quantity) || quantity < 1) {
    return (
      <main style={{ maxWidth: 700, margin: '32px auto', padding: 16 }}>
        <h1>Purchase confirmation</h1>
        <p>Choose a project and quantity before confirming.</p>
        <Link to="/browse">Browse projects</Link>
      </main>
    );
  }

  const total = Number(project.cost_per_unit) * quantity;

  async function handleConfirm() {
    setSubmitting(true);
    setError('');

    try {
      const result = await api('/purchases', {
        method: 'POST',
        body: { projectId: project.id, quantity },
      });
      setPurchase(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: '32px auto', padding: 16 }}>
      <Link to={`/projects/${project.id}`}>← Back to project</Link>

      {purchase ? (
        <>
          <h1>Purchase submitted</h1>
          <p>Status: <strong>{purchase.status}</strong></p>
          <p>Total: {Number(purchase.total_cost ?? total).toFixed(2)}</p>
          <Link to="/browse">Back to projects</Link>
        </>
      ) : (
        <>
          <h1>Review your purchase</h1>
          <p><strong>Project:</strong> {project.title}</p>
          <p><strong>Quantity:</strong> {quantity} {project.unit_label}</p>
          <p><strong>Cost per unit:</strong> {Number(project.cost_per_unit).toFixed(2)}</p>
          <p><strong>Total:</strong> {total.toFixed(2)}</p>

          {error && <p role="alert">{error}</p>}

          <button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Confirm purchase'}
          </button>
        </>
      )}
    </main>
  );
}