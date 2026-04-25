import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

const emptyForm = {
    name: '',
    start_location: '',
    end_location: '',
    estimated_time_minutes: '',
    fare: '',
    distance_km: '',
    turnaround_time_minutes: 10,
    is_active: true,
    stops_text: '',
};

const parseStops = (text) =>
    text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, idx) => ({
            stop_name: line,
            sequence_order: idx + 1,
            dwell_time_minutes: 2.0,
        }));

const Routes = () => {
    const addAlert = useAlertStore((s) => s.addAlert);
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const fetchRoutes = useCallback(async () => {
        const res = await api.get('/admin/routes');
        setRoutes(res.data || []);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await api.get('/admin/routes');
                if (!cancelled) setRoutes(res.data || []);
            } catch {
                if (!cancelled) addAlert?.({ type: 'ERROR', message: 'Failed to fetch routes.' });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [addAlert]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setFormError(null);
        setEditorOpen(true);
    };

    const openEdit = (r) => {
        setEditing(r);
        setForm({
            name: r.name || '',
            start_location: r.start_location || '',
            end_location: r.end_location || '',
            estimated_time_minutes: r.estimated_time_minutes ?? '',
            fare: r.fare ?? '',
            distance_km: r.distance_km ?? '',
            turnaround_time_minutes: r.turnaround_time_minutes ?? 10,
            is_active: r.is_active !== false,
            stops_text: (r.stops || []).map((s) => s.stop_name).join('\n'),
        });
        setFormError(null);
        setEditorOpen(true);
    };

    const submit = async (e) => {
        e.preventDefault();
        setFormError(null);
        setSubmitting(true);
        try {
            if (editing) {
                const payload = {
                    name: form.name,
                    is_active: form.is_active,
                };
                await api.put(`/admin/routes/${editing.id}`, payload);
                addAlert?.({ type: 'OK', message: 'Route updated.' });
            } else {
                const payload = {
                    name: form.name,
                    start_location: form.start_location,
                    end_location: form.end_location,
                    estimated_time_minutes: Number(form.estimated_time_minutes) || 0,
                    fare: Number(form.fare) || 0,
                    distance_km: form.distance_km ? Number(form.distance_km) : null,
                    turnaround_time_minutes: Number(form.turnaround_time_minutes) || 10,
                    is_active: form.is_active,
                    stops: parseStops(form.stops_text),
                };
                await api.post('/admin/routes', payload);
                addAlert?.({ type: 'OK', message: 'Route created.' });
            }
            setEditorOpen(false);
            await fetchRoutes();
        } catch (err) {
            const detail = err?.response?.data?.detail;
            setFormError(Array.isArray(detail) ? detail.map((x) => x.msg).join(', ') : (detail || 'Save failed.'));
        } finally {
            setSubmitting(false);
        }
    };

    const doDelete = async (id) => {
        try {
            await api.delete(`/admin/routes/${id}`);
            addAlert?.({ type: 'OK', message: 'Route deleted.' });
            fetchRoutes();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Delete failed.' });
        }
        setConfirm(null);
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return routes;
        return routes.filter((r) =>
            String(r.name || '').toLowerCase().includes(q) ||
            String(r.start_location || '').toLowerCase().includes(q) ||
            String(r.end_location || '').toLowerCase().includes(q) ||
            String(r.id).includes(q),
        );
    }, [routes, query]);

    return (
        <>
            <PageHeader
                title="Routes"
                sub={`${routes.length} routes · ${routes.filter((r) => r.is_active).length} active`}
                actions={(
                    <>
                        <button className="btn"><Icon name="download" />Export</button>
                        <button className="btn primary" onClick={openCreate}>
                            <Icon name="plus" />Add route
                        </button>
                    </>
                )}
            />
            <Filterbar>
                <div className="field" style={{ minWidth: 260 }}>
                    <Icon name="search" />
                    <input
                        placeholder="Search routes"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="sep" />
                <span className="mono text-xs muted">{filtered.length} results</span>
            </Filterbar>

            <div className="main-body">
                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No routes match.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>ID</th>
                                    <th>Name</th>
                                    <th>From</th>
                                    <th>To</th>
                                    <th className="num">Distance</th>
                                    <th className="num">Time</th>
                                    <th className="num">Fare</th>
                                    <th className="num">Stops</th>
                                    <th>Status</th>
                                    <th style={{ width: 180 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r) => (
                                    <tr key={r.id}>
                                        <td className="mono text-sm">{r.id}</td>
                                        <td>{r.name}</td>
                                        <td className="text-sm">{r.start_location}</td>
                                        <td className="text-sm">{r.end_location}</td>
                                        <td className="num mono text-xs">
                                            {r.distance_km ? `${r.distance_km} km` : '—'}
                                        </td>
                                        <td className="num mono text-xs">{Math.round(r.estimated_time_minutes || 0)}m</td>
                                        <td className="num mono">{Number(r.fare || 0).toFixed(2)}</td>
                                        <td className="num mono">{(r.stops || []).length}</td>
                                        <td>
                                            {r.is_active ? <Tag status="ACTIVE" /> : <Tag status="INACTIVE" />}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn ghost" onClick={() => openEdit(r)}>Edit</button>
                                                <button
                                                    className="btn"
                                                    style={{ color: 'var(--crit)' }}
                                                    onClick={() => setConfirm({ id: r.id, name: r.name })}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Panel>
            </div>

            {editorOpen ? (
                <ModalOverlay onClose={() => setEditorOpen(false)}>
                    <form className="panel" onSubmit={submit} style={{ width: 560 }}>
                        <div className="panel-head">
                            <strong>{editing ? 'Edit route' : 'Add route'}</strong>
                            <button type="button" className="btn ghost" onClick={() => setEditorOpen(false)}>
                                <Icon name="x" />
                            </button>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {formError ? (
                                <div className="mono text-xs" style={{ color: 'var(--crit)' }}>{formError}</div>
                            ) : null}
                            <div>
                                <label>Name</label>
                                <div className="field">
                                    <input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            {!editing ? (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label>From</label>
                                            <div className="field">
                                                <input
                                                    value={form.start_location}
                                                    onChange={(e) => setForm({ ...form, start_location: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label>To</label>
                                            <div className="field">
                                                <input
                                                    value={form.end_location}
                                                    onChange={(e) => setForm({ ...form, end_location: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label>Distance (km)</label>
                                            <div className="field">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={form.distance_km}
                                                    onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label>Time (min)</label>
                                            <div className="field">
                                                <input
                                                    type="number"
                                                    value={form.estimated_time_minutes}
                                                    onChange={(e) =>
                                                        setForm({ ...form, estimated_time_minutes: e.target.value })
                                                    }
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label>Fare</label>
                                            <div className="field">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={form.fare}
                                                    onChange={(e) => setForm({ ...form, fare: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label>Stops (one per line)</label>
                                        <div className="field" style={{ padding: 0 }}>
                                            <textarea
                                                rows={5}
                                                value={form.stops_text}
                                                onChange={(e) => setForm({ ...form, stops_text: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: 10,
                                                    background: 'transparent',
                                                    border: 'none',
                                                    outline: 'none',
                                                    color: 'var(--ink)',
                                                    fontFamily: 'inherit',
                                                    fontSize: 13,
                                                    resize: 'vertical',
                                                }}
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : null}
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    marginTop: 4,
                                    cursor: 'pointer',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                />
                                <span className="text-sm">Active</span>
                            </label>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                padding: 14,
                                borderTop: '1px solid var(--line)',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <button type="button" className="btn" onClick={() => setEditorOpen(false)}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={submitting}>
                                {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create'}
                            </button>
                        </div>
                    </form>
                </ModalOverlay>
            ) : null}

            {confirm ? (
                <ModalOverlay onClose={() => setConfirm(null)}>
                    <div className="panel" style={{ width: 420 }}>
                        <div className="panel-head" style={{ color: 'var(--crit)' }}>
                            <strong style={{ color: 'inherit' }}>Delete route?</strong>
                        </div>
                        <div className="panel-body">
                            <div className="text-sm">{confirm.name} will be permanently removed.</div>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                padding: 14,
                                borderTop: '1px solid var(--line)',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
                            <button
                                className="btn primary"
                                style={{ background: 'var(--crit)', borderColor: 'var(--crit)' }}
                                onClick={() => doDelete(confirm.id)}
                            >
                                Delete forever
                            </button>
                        </div>
                    </div>
                </ModalOverlay>
            ) : null}
        </>
    );
};

const ModalOverlay = ({ children, onClose }) => (
    <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.4)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 200,
        }}
    >
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
);

export default Routes;
