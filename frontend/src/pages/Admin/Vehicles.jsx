import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

const emptyForm = {
    plate_number: '',
    model: '',
    year: '',
    capacity: 50,
    garage_id: '',
};

const Vehicles = () => {
    const addAlert = useAlertStore((s) => s.addAlert);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const fetchVehicles = useCallback(async () => {
        const res = await api.get('/admin/vehicles');
        setVehicles(res.data || []);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await api.get('/admin/vehicles');
                if (!cancelled) setVehicles(res.data || []);
            } catch {
                if (!cancelled) addAlert?.({ type: 'ERROR', message: 'Failed to fetch vehicles.' });
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

    const openEdit = (v) => {
        setEditing(v);
        setForm({
            plate_number: v.plate_number || '',
            model: v.model || '',
            year: v.year ?? '',
            capacity: v.capacity ?? 50,
            garage_id: v.garage_id ?? '',
        });
        setFormError(null);
        setEditorOpen(true);
    };

    const submit = async (e) => {
        e.preventDefault();
        setFormError(null);
        const payload = {
            ...form,
            year: form.year ? Number(form.year) : null,
            capacity: Number(form.capacity) || 0,
            garage_id: form.garage_id ? Number(form.garage_id) : null,
        };
        setSubmitting(true);
        try {
            if (editing) {
                await api.put(`/admin/vehicles/${editing.id}`, payload);
                addAlert?.({ type: 'OK', message: 'Vehicle updated.' });
            } else {
                await api.post('/admin/vehicles', payload);
                addAlert?.({ type: 'OK', message: 'Vehicle created.' });
            }
            setEditorOpen(false);
            await fetchVehicles();
        } catch (err) {
            const detail = err?.response?.data?.detail;
            setFormError(Array.isArray(detail) ? detail.map((x) => x.msg).join(', ') : (detail || 'Save failed.'));
        } finally {
            setSubmitting(false);
        }
    };

    const doDelete = async (id) => {
        try {
            await api.delete(`/admin/vehicles/${id}`);
            addAlert?.({ type: 'OK', message: 'Vehicle deleted.' });
            fetchVehicles();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Delete failed.' });
        }
        setConfirm(null);
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return vehicles.filter((v) => {
            if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
            if (!q) return true;
            return (
                String(v.plate_number || '').toLowerCase().includes(q) ||
                String(v.model || '').toLowerCase().includes(q) ||
                String(v.id).includes(q)
            );
        });
    }, [vehicles, query, statusFilter]);

    const counts = useMemo(() => {
        const total = vehicles.length;
        const free = vehicles.filter((v) => v.status === 'FREE').length;
        const onTrip = vehicles.filter((v) => v.status === 'ON_TRIP').length;
        const maint = vehicles.filter((v) => v.status === 'MAINTENANCE' || v.status === 'MAINT').length;
        return { total, free, onTrip, maint };
    }, [vehicles]);

    return (
        <>
            <PageHeader
                title="Vehicles"
                sub={`${counts.total} total · ${counts.onTrip} on trip · ${counts.free} free · ${counts.maint} maintenance`}
                actions={(
                    <>
                        <button className="btn"><Icon name="download" />Export</button>
                        <button className="btn primary" onClick={openCreate}>
                            <Icon name="plus" />Add vehicle
                        </button>
                    </>
                )}
            />
            <Filterbar>
                <div className="field" style={{ minWidth: 260 }}>
                    <Icon name="search" />
                    <input
                        placeholder="Search by plate, model, ID"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="field">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="ALL">All statuses</option>
                        <option value="FREE">Free</option>
                        <option value="ON_TRIP">On trip</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="GARAGE">Garage</option>
                    </select>
                </div>
                <div className="sep" />
                <span className="mono text-xs muted">{filtered.length} results</span>
            </Filterbar>

            <div className="main-body">
                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No vehicles match.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>ID</th>
                                    <th>Plate</th>
                                    <th>Model</th>
                                    <th className="num">Year</th>
                                    <th className="num">Capacity</th>
                                    <th>Status</th>
                                    <th style={{ width: 180 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((v) => (
                                    <tr key={v.id}>
                                        <td className="mono text-sm">{v.id}</td>
                                        <td className="mono">{v.plate_number}</td>
                                        <td>{v.model}</td>
                                        <td className="num mono">{v.year || '—'}</td>
                                        <td className="num mono">{v.capacity}</td>
                                        <td><Tag status={v.status || 'FREE'} /></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn ghost" onClick={() => openEdit(v)}>Edit</button>
                                                <button
                                                    className="btn"
                                                    style={{ color: 'var(--crit)' }}
                                                    onClick={() => setConfirm({ id: v.id, name: v.plate_number })}
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
                    <form className="panel" onSubmit={submit} style={{ width: 480 }}>
                        <div className="panel-head">
                            <strong>{editing ? 'Edit vehicle' : 'Add vehicle'}</strong>
                            <button type="button" className="btn ghost" onClick={() => setEditorOpen(false)}>
                                <Icon name="x" />
                            </button>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {formError ? (
                                <div className="mono text-xs" style={{ color: 'var(--crit)' }}>{formError}</div>
                            ) : null}
                            <div>
                                <label>Plate number</label>
                                <div className="field">
                                    <input
                                        value={form.plate_number}
                                        onChange={(e) => setForm({ ...form, plate_number: e.target.value.toUpperCase() })}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label>Model</label>
                                <div className="field">
                                    <input
                                        value={form.model}
                                        onChange={(e) => setForm({ ...form, model: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label>Year</label>
                                    <div className="field">
                                        <input
                                            type="number"
                                            value={form.year}
                                            onChange={(e) => setForm({ ...form, year: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label>Capacity</label>
                                    <div className="field">
                                        <input
                                            type="number"
                                            value={form.capacity}
                                            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label>Garage ID</label>
                                <div className="field">
                                    <input
                                        type="number"
                                        value={form.garage_id ?? ''}
                                        onChange={(e) => setForm({ ...form, garage_id: e.target.value })}
                                    />
                                </div>
                            </div>
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
                            <strong style={{ color: 'inherit' }}>Delete vehicle?</strong>
                        </div>
                        <div className="panel-body">
                            <div className="text-sm">
                                {confirm.name || '#' + confirm.id} will be permanently removed.
                            </div>
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

export default Vehicles;
