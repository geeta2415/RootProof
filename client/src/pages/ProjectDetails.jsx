import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
        const data = await api(`/browse/projects/${id}`);
        if (!cancelled) setProject(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProject();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleBuy() {
    const amount = Number(quantity);

    if (!Number.isInteger(amount) || amount < 1 || amount > project.units_remaining) {
      setError(`Enter a whole number from 1 to ${project.units_remaining}.`);
      return;
    }

    navigate('/purchase/confirm', {
      state: { project, quantity: amount },
    });
  }

  if (loading) return <main style={{ padding: 24 }}><p>Loading project…</p></main>;
  if (error && !project) return <main style={{ padding: 24 }}><p role="alert">{error}</p><Link to="/browse">Back to browse</Link></main>;
  if (!project) return null;

  return (
    <main style={{ maxWidth: 800, margin: '32px auto', padding: 16 }}>
      <Link to="/browse">← Back to projects</Link>
      <h1>{project.title}</h1>
      <p>{project.description}</p>
      <p><strong>Type:</strong> {project.project_type}</p>
      <p><strong>Location:</strong> {project.location}</p>
      <p><strong>Cost per unit:</strong> {Number(project.cost_per_unit).toFixed(2)}</p>
      <p><strong>Available:</strong> {project.units_remaining} {project.unit_label}</p>
      <p><strong>Project owner:</strong> {project.owner_name}</p>

      {project.units_remaining > 0 ? (
        <div>
          <label>
            Quantity
            <input
              type="number"
              min="1"
              max={project.units_remaining}
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <button onClick={handleBuy}>Continue to purchase</button>
          {error && <p role="alert">{error}</p>}
        </div>
      ) : (
        <p>This project has no units remaining.</p>
      )}
    </main>
  );
}