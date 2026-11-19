import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const emptyFilters = {
  type: '',
  location: '',
  minPrice: '',
  maxPrice: '',
};

export default function Browse() {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value.trim()) params.set(key, value.trim());
      });

      const query = params.toString();
      const path = `/browse/projects${query ? `?${query}` : ''}`;

      try {
        const data = await api(path);
        if (!cancelled) setProjects(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [appliedFilters]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  }

  function handleClear() {
    setFilters({ ...emptyFilters });
    setAppliedFilters({});
  }

  return (
    <main style={{ maxWidth: 1000, margin: '32px auto', padding: 16 }}>
      <h1>Browse environmental projects</h1>
      <p>Find an active project to support.</p>

      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}>
          <label>
            Project type
            <input name="type" value={filters.type} onChange={handleChange}
              placeholder="e.g. tree planting" />
          </label>

          <label>
            Location
            <input name="location" value={filters.location} onChange={handleChange}
              placeholder="e.g. Karachi" />
          </label>

          <label>
            Minimum price
            <input name="minPrice" type="number" min="0" step="0.01"
              value={filters.minPrice} onChange={handleChange} />
          </label>

          <label>
            Maximum price
            <input name="maxPrice" type="number" min="0" step="0.01"
              value={filters.maxPrice} onChange={handleChange} />
          </label>
        </div>

        <button type="submit" style={{ marginTop: 12 }}>Apply filters</button>
        <button type="button" onClick={handleClear} style={{ margin: 12 }}>
          Clear filters
        </button>
      </form>

      {loading && <p>Loading projects…</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && projects.length === 0 && (
        <p>No matching projects found. Try changing or clearing your filters.</p>
      )}

      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 16,
        marginTop: 24,
      }}>
        {projects.map((project) => (
          <article key={project.id}
            style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16 }}>
            <h2>{project.title}</h2>
            <p>{project.description}</p>
            <p><strong>Type:</strong> {project.project_type}</p>
            <p><strong>Location:</strong> {project.location}</p>
            <p><strong>Cost per unit:</strong> {Number(project.cost_per_unit).toFixed(2)}</p>
            <p><strong>Units available:</strong> {project.units_remaining} {project.unit_label}</p>
            <p><strong>Project owner:</strong> {project.owner_name}</p>
            <Link to={`/projects/${project.id}`}>View details</Link>
          </article>
        ))}
      </section>
    </main>
  );
}