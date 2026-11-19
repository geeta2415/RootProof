import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const emptyForm = {
  title: '',
  description: '',
  project_type: '',
  location: '',
  cost_per_unit: '',
  total_units_available: '',
  unit_label: '',
};

const fields = [
  { name: 'title', label: 'Title', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'project_type', label: 'Project type (e.g. tree-planting)', type: 'text' },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'cost_per_unit', label: 'Cost per unit', type: 'number' },
  { name: 'total_units_available', label: 'Total units available', type: 'number' },
  { name: 'unit_label', label: 'Unit label (e.g. trees, stoves)', type: 'text' },
];

export default function MyProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api('/projects/mine');
      setProjects(data);
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

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function openEdit(p) {
    setForm({
      title: p.title,
      description: p.description,
      project_type: p.project_type,
      location: p.location,
      cost_per_unit: p.cost_per_unit,
      total_units_available: p.total_units_available,
      unit_label: p.unit_label,
    });
    setEditingId(p.id);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api(`/projects/${editingId}`, { method: 'PUT', body: form });
        setMessage('Project updated.');
      } else {
        await api('/projects', { method: 'POST', body: form });
        setMessage('Project created.');
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(p) {
    if (!window.confirm(`Close "${p.title}"? Businesses will no longer see it.`)) return;
    setError('');
    try {
      await api(`/projects/${p.id}/close`, { method: 'PATCH' });
      setMessage('Project closed.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    setError('');
    try {
      await api(`/projects/${deleteTarget.id}`, { method: 'DELETE' });
      setMessage('Project deleted.');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    }
  }

  const box = { border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 12 };
  const input = { display: 'block', width: '100%', padding: 8, marginBottom: 10, boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 16 }}>
      <p><Link to="/dashboard">&larr; Back to dashboard</Link></p>
      <h2>My Projects</h2>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {!showForm && <button onClick={openCreate}>+ Create new project</button>}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...box, marginTop: 12 }}>
          <h3>{editingId ? 'Edit project' : 'Create project'}</h3>
          {fields.map((f) => (
            <label key={f.name}>
              {f.label}
              {f.type === 'textarea' ? (
                <textarea name={f.name} value={form[f.name]} onChange={handleChange} style={input} rows={3} required />
              ) : (
                <input
                  name={f.name}
                  type={f.type}
                  value={form[f.name]}
                  onChange={handleChange}
                  style={input}
                  min={f.type === 'number' ? '1' : undefined}
                  step={f.name === 'cost_per_unit' ? 'any' : undefined}
                  required
                />
              )}
            </label>
          ))}
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>{' '}
          <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        {loading && <p>Loading... (the server may take up to 50 seconds to wake up)</p>}
        {!loading && projects.length === 0 && <p>You have no projects yet. Create your first one above.</p>}

        {projects.map((p) => (
          <div key={p.id} style={box}>
            <strong>{p.title}</strong> &mdash; {p.status}
            <div>{p.project_type} | {p.location}</div>
            <div>Price: {p.cost_per_unit} per {p.unit_label}</div>
            <div>
              Sold: {p.units_sold} | Remaining: {p.units_remaining} | Total: {p.total_units_available}
            </div>
            <div style={{ marginTop: 8 }}>
              {p.status === 'active' && <button onClick={() => openEdit(p)}>Edit</button>}{' '}
              {p.status === 'active' && <button onClick={() => handleClose(p)}>Close</button>}{' '}
              <button onClick={() => setDeleteTarget(p)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <div style={{ ...box, background: '#fff3f3', borderColor: 'crimson' }}>
          <p>Delete <strong>{deleteTarget.title}</strong>? This cannot be undone.</p>
          <button onClick={confirmDelete}>Yes, delete</button>{' '}
          <button onClick={() => setDeleteTarget(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}