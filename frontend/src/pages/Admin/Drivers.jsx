import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

const emptyForm = {
    user_id: '',
    license_number: '',
    license_expiry: '',
    garage_id: '',
    status: 'OFF_DUTY',
    current_vehicle_id: '',
    current_route_id: '',
    rating: 5,
};

const Drivers = () => {
    const addAlert = useAlertStore((s) => s.addAlert);
    const [drivers, setDrivers] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const fetchDrivers = useCallback(async () => {
        const res = await api.get('/admin/drivers');
        setDrivers(res.data || []);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [d, u] = await Promise.all([
                    api.get('/admin/drivers'),
                    api.get('/admin/users').catch(() => ({ data: [] })),
                ]);
                if (cancelled) return;
                setDrivers(d.data || []);
                setUsers((u.data || []).filter((x) => x.role === 'DRIVER'));
            } catch {
                if (!cancelled) addAlert?.({ type: 'ERROR', message: 'Failed to fetch drivers.' });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [addAlert]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setFormError(null);
        setEditorOpen(true);
    };

    const openEdit = (d) => {
        setEditing(d);
        setForm({
            user_id: d.user_id || '',
            license_number: d.license_number || '',
            license_expiry: d.license_expiry || '',
            garage_id: d.garage_id ?? '',
            status: d.status || 'OFF_DUTY',
            current_vehicle_id: d.current_vehicle_id ?? '',
            current_route_id: d.current_route_id ?? '',
            rating: d.rating ?? 5,
        });
        setFormError(null);
        setEditorOpen(true);
    };

    const submit = async (e) => {
        e.preventDefault();
        setFormError(null);
        if (!form.license_number || form.license_number.length < 5) {
            setFormError('License number must be at least 5 characters.');
            return;
        }
        setSubmitting(true);
        try {
            if (editing) {
                const payload = {
                    license_number: form.license_number,
                    license_expiry: form.license_expiry || null,
                    garage_id: form.garage_id !== '' ? Number(form.garage_id) : null,
                    status: form.status,
                    current_vehicle_id: form.current_vehicle_id !== '' ? Number(form.current_vehicle_id) : null,
                    current_route_id: form.current_route_id !== '' ? Number(form.current_route_id) : null,
                    rating: form.rating !== '' ? Number(form.rating) : null,
                };
                await api.put(`/admin/drivers/${editing.id}`, payload);
                addAlert?.({ type: 'OK', message: 'Driver updated.' });
            } else {
                const payload = {
                    user_id: form.user_id ? Number(form.user_id) : undefined,
                    license_number: form.license_number,
                    license_expiry: form.license_expiry || null,
                    garage_id: form.garage_id ? Number(form.garage_id) : null,
                };
                await api.post('/admin/drivers', payload);
                addAlert?.({ type: 'OK', message: 'Driver created.' });
            }
            setEditorOpen(false);
            await fetchDrivers();
        } catch (err) {
            const detail = err?.response?.data?.detail;
            setFormError(Array.isArray(detail) ? detail.map((x) => x.msg).join(', ') : (detail || 'Save failed.'));
        } finally {
            setSubmitting(false);
        }
    };

    const doDeactivate = async (id) => {
        try {
            await api.patch(`/admin/drivers/${id}/deactivate`);
            addAlert?.({ type: 'OK', message: 'Driver deactivated.' });
            fetchDrivers();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Action failed.' });
        }
        setConfirm(null);
    };

    const doActivate = async (id) => {
        try {
            await api.patch(`/admin/drivers/${id}/activate`);
            addAlert?.({ type: 'OK', message: 'Driver activated.' });
            fetchDrivers();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Action failed.' });
        }
    };

    const doDelete = async (id) => {
        try {
            await api.delete(`/admin/drivers/${id}`);
            addAlert?.({ type: 'OK', message: 'Driver deleted.' });
            fetchDrivers();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Delete failed.' });
        }
        setConfirm(null);
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return drivers.filter((d) => {
            if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
            if (!q) return true;
            const fullName = d.user?.full_name?.toLowerCase() || '';
            const email = d.user?.email?.toLowerCase() || '';
            const lic = String(d.license_number || '').toLowerCase();
            return fullName.includes(q) || email.includes(q) || lic.includes(q) || String(d.id).includes(q);
        });
    }, [drivers, query, statusFilter]);

    const counts = useMemo(() => {
        const total = drivers.length;
        const onTrip = drivers.filter((d) => d.status === 'ON_TRIP').length;
        const onBreak = drivers.filter((d) => d.status === 'ON_BREAK' || d.status === 'BREAK').length;
        const off = drivers.filter((d) => d.status === 'OFF_DUTY' || d.status === 'OFF').length;
        return { total, onTrip, onBreak, off };
    }, [drivers]);

    return (
        <>
            <PageHeader
                title="Drivers"
                sub={`${counts.total} total · ${counts.onTrip} on trip · ${counts.onBreak} on break · ${counts.off} off`}
                actions={(
                    <>
                        <button className="btn">
                            <Icon name="download" />Export CSV
                        </button>
                        <button className="btn primary" onClick={openCreate}>
                            <Icon name="plus" />Add driver
                        </button>
                    </>
                )}
            />
            <Filterbar>
                <div className="field" style={{ minWidth: 260 }}>
                    <Icon name="search" />
                    <input
                        placeholder="Search by name, email, license, ID"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="field">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="ALL">All statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="ON_TRIP">On trip</option>
                        <option value="ON_BREAK">On break</option>
                        <option value="OFF_DUTY">Off duty</option>
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
                        <div style={{ padding: 28 }}><Empty>No drivers match your filters.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>ID</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>License</th>
                                    <th>Expires</th>
                                    <th>Status</th>
                                    <th className="num">Rating</th>
                                    <th style={{ width: 220 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((d) => {
                                    const deactivated = d.user && d.user.is_active === false;
                                    return (
                                        <tr key={d.id} style={{ opacity: deactivated ? 0.55 : 1 }}>
                                            <td className="mono text-sm">{d.id}</td>
                                            <td>
                                                <div>{d.user?.full_name || '—'}</div>
                                            </td>
                                            <td className="muted text-sm">{d.user?.email || '—'}</td>
                                            <td className="mono text-xs">{d.license_number}</td>
                                            <td className="mono text-xs muted">{d.license_expiry || '—'}</td>
                                            <td>
                                                {deactivated ? (
                                                    <Tag variant="">Inactive</Tag>
                                                ) : (
                                                    <Tag status={d.status || 'ACTIVE'} />
                                                )}
                                            </td>
                                            <td className="num mono">{d.rating ?? '—'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn ghost" onClick={() => openEdit(d)}>
                                                        Edit
                                                    </button>
                                                    {deactivated ? (
                                                        <button className="btn" onClick={() => doActivate(d.id)}>
                                                            Activate
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="btn"
                                                            onClick={() => setConfirm({ type: 'deactivate', id: d.id, name: d.user?.full_name })}
                                                        >
                                                            Deactivate
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn"
                                                        style={{ color: 'var(--crit)' }}
                                                        onClick={() => setConfirm({ type: 'delete', id: d.id, name: d.user?.full_name })}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </Panel>
            </div>

            {editorOpen ? (
                <ModalOverlay onClose={() => setEditorOpen(false)}>
                    <form className="panel" onSubmit={submit} style={{ width: 480 }}>
                        <div className="panel-head">
                            <strong>{editing ? 'Edit driver' : 'Add driver'}</strong>
                            <button type="button" className="btn ghost" onClick={() => setEditorOpen(false)}>
                                <Icon name="x" />
                            </button>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {formError ? (
                                <div
                                    className="mono text-xs"
                                    style={{ color: 'var(--crit)', letterSpacing: '.04em' }}
                                >
                                    {formError}
                                </div>
                            ) : null}

                            {!editing ? (
                                <div>
                                    <label>User account</label>
                                    <div className="field">
                                        <select
                                            value={form.user_id}
                                            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                                            required
                                        >
                                            <option value="">Select user…</option>
                                            {users.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.full_name} ({u.email})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : null}

                            <div>
                                <label>License number</label>
                                <div className="field">
                                    <input
                                        value={form.license_number}
                                        onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label>License expiry</label>
                                <div className="field">
                                    <input
                                        type="date"
                                        value={form.license_expiry || ''}
                                        onChange={(e) => setForm({ ...form, license_expiry: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                                {editing ? (
                                    <div>
                                        <label>Status</label>
                                        <div className="field">
                                            <select
                                                value={form.status}
                                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                                            >
                                                <option value="OFF_DUTY">Off duty</option>
                                                <option value="ACTIVE">Active</option>
                                                <option value="ON_TRIP">On trip</option>
                                                <option value="ON_BREAK">On break</option>
                                            </select>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {editing ? (
                                <>
                                    <div className="rule" />
                                    <div
                                        className="mono text-xs muted"
                                        style={{ letterSpacing: '.06em', textTransform: 'uppercase' }}
                                    >
                                        Assignment & rating
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label>Vehicle ID</label>
                                            <div className="field">
                                                <input
                                                    type="number"
                                                    value={form.current_vehicle_id ?? ''}
                                                    onChange={(e) => setForm({ ...form, current_vehicle_id: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label>Route ID</label>
                                            <div className="field">
                                                <input
                                                    type="number"
                                                    value={form.current_route_id ?? ''}
                                                    onChange={(e) => setForm({ ...form, current_route_id: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label>Rating (0-5)</label>
                                            <div className="field">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="5"
                                                    value={form.rating ?? ''}
                                                    onChange={(e) => setForm({ ...form, rating: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : null}
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
                            <button type="button" className="btn" onClick={() => setEditorOpen(false)}>
                                Cancel
                            </button>
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
                        <div
                            className="panel-head"
                            style={{ color: confirm.type === 'delete' ? 'var(--crit)' : 'var(--warn)' }}
                        >
                            <strong style={{ color: 'inherit' }}>
                                {confirm.type === 'delete' ? 'Delete driver?' : 'Deactivate driver?'}
                            </strong>
                        </div>
                        <div className="panel-body">
                            <div className="text-sm">
                                {confirm.type === 'delete'
                                    ? `${confirm.name || '#' + confirm.id} will be permanently removed. This cannot be undone.`
                                    : `${confirm.name || '#' + confirm.id} will no longer be able to sign in.`}
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
                                style={{
                                    background: confirm.type === 'delete' ? 'var(--crit)' : 'var(--warn)',
                                    borderColor: confirm.type === 'delete' ? 'var(--crit)' : 'var(--warn)',
                                }}
                                onClick={() =>
                                    confirm.type === 'delete' ? doDelete(confirm.id) : doDeactivate(confirm.id)
                                }
                            >
                                {confirm.type === 'delete' ? 'Delete forever' : 'Deactivate'}
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

export default Drivers;
