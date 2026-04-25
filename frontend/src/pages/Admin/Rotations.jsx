import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

const SHIFT_TYPES = ['MORNING', 'EVENING'];
const POSITIONS = ['DRIVER_1', 'DRIVER_2', 'DRIVER_3'];

const todayStr = () => new Date().toISOString().split('T')[0];

const Rotations = () => {
    const addAlert = useAlertStore((s) => s.addAlert);
    const [assignments, setAssignments] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [shiftFilter, setShiftFilter] = useState('ALL');
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        route_id: '',
        driver_id: '',
        vehicle_id: '',
        shift_type: 'MORNING',
        position: 'DRIVER_1',
        shift_date: todayStr(),
        shift_start_time: `${todayStr()}T06:00:00`,
        shift_end_time: `${todayStr()}T15:00:00`,
    });

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [a, r, d, v] = await Promise.all([
                api.get('/admin/rotations').catch(() => ({ data: [] })),
                api.get('/admin/routes').catch(() => ({ data: [] })),
                api.get('/admin/drivers').catch(() => ({ data: [] })),
                api.get('/admin/vehicles').catch(() => ({ data: [] })),
            ]);
            setAssignments(a.data || []);
            setRoutes(r.data || []);
            setDrivers(d.data || []);
            setVehicles(v.data || []);
        } catch {
            addAlert?.({ type: 'ERROR', message: 'Failed to load rotations.' });
        } finally {
            setLoading(false);
        }
    }, [addAlert]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const routeById = useMemo(() => {
        const m = new Map();
        routes.forEach((r) => m.set(r.id, r));
        return m;
    }, [routes]);

    const driverById = useMemo(() => {
        const m = new Map();
        drivers.forEach((d) => m.set(d.id, d));
        return m;
    }, [drivers]);

    const vehicleById = useMemo(() => {
        const m = new Map();
        vehicles.forEach((v) => m.set(v.id, v));
        return m;
    }, [vehicles]);

    const filtered = useMemo(() => {
        if (shiftFilter === 'ALL') return assignments;
        return assignments.filter((a) => a.shift_type === shiftFilter);
    }, [assignments, shiftFilter]);

    const openCreate = () => {
        const t = todayStr();
        setForm({
            route_id: '',
            driver_id: '',
            vehicle_id: '',
            shift_type: 'MORNING',
            position: 'DRIVER_1',
            shift_date: t,
            shift_start_time: `${t}T06:00:00`,
            shift_end_time: `${t}T15:00:00`,
        });
        setOpen(true);
    };

    const submit = async () => {
        if (!form.route_id || !form.driver_id || !form.vehicle_id) {
            addAlert?.({ type: 'WARN', message: 'Pick route, driver and vehicle.' });
            return;
        }
        setSaving(true);
        try {
            await api.post('/admin/rotations', {
                ...form,
                route_id: Number(form.route_id),
                driver_id: Number(form.driver_id),
                vehicle_id: Number(form.vehicle_id),
            });
            addAlert?.({ type: 'OK', message: 'Rotation assigned.' });
            setOpen(false);
            fetchAll();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Assignment failed.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <PageHeader
                title="Rotations"
                sub={`${assignments.length} assignments · ${todayStr()}`}
                actions={(
                    <button className="btn primary" onClick={openCreate}>
                        <Icon name="plus" />Assign driver
                    </button>
                )}
            />
            <Filterbar>
                <div style={{ display: 'flex', gap: 6 }}>
                    {['ALL', ...SHIFT_TYPES].map((s) => (
                        <button
                            key={s}
                            className={`btn ${shiftFilter === s ? 'primary' : ''}`}
                            onClick={() => setShiftFilter(s)}
                        >
                            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
                <div className="sep" />
                <span className="mono text-xs muted">{filtered.length} results</span>
            </Filterbar>

            <div className="main-body">
                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No rotation assignments.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>ID</th>
                                    <th>Route</th>
                                    <th>Shift</th>
                                    <th>Position</th>
                                    <th>Driver</th>
                                    <th>Vehicle</th>
                                    <th className="num">Start</th>
                                    <th className="num">End</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((a) => {
                                    const route = routeById.get(a.route_id);
                                    const driver = driverById.get(a.driver_id);
                                    const vehicle = vehicleById.get(a.vehicle_id);
                                    return (
                                        <tr key={a.id}>
                                            <td className="mono text-sm">{a.id}</td>
                                            <td>
                                                <div>{route?.name || `Route #${a.route_id}`}</div>
                                                {route ? (
                                                    <div className="muted text-xs mono" style={{ marginTop: 2 }}>
                                                        {route.start_location} → {route.end_location}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td><Tag status={a.shift_type} /></td>
                                            <td className="mono text-xs">{a.position}</td>
                                            <td>{driver?.user?.full_name || `D-${a.driver_id}`}</td>
                                            <td className="mono text-xs">{vehicle?.plate_number || `V-${a.vehicle_id}`}</td>
                                            <td className="num mono text-xs muted">
                                                {a.shift_start_time
                                                    ? new Date(a.shift_start_time).toLocaleTimeString('en-GB', {
                                                          hour: '2-digit',
                                                          minute: '2-digit',
                                                      })
                                                    : '—'}
                                            </td>
                                            <td className="num mono text-xs muted">
                                                {a.shift_end_time
                                                    ? new Date(a.shift_end_time).toLocaleTimeString('en-GB', {
                                                          hour: '2-digit',
                                                          minute: '2-digit',
                                                      })
                                                    : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </Panel>
            </div>

            {open ? (
                <ModalOverlay onClose={() => setOpen(false)}>
                    <div className="panel" style={{ width: 540 }}>
                        <div className="panel-head">
                            <strong>Assign rotation</strong>
                            <button className="btn ghost" onClick={() => setOpen(false)}>
                                <Icon name="x" />
                            </button>
                        </div>
                        <div className="panel-body">
                            <div className="grid-2" style={{ gap: 12 }}>
                                <Field label="Route">
                                    <select
                                        value={form.route_id}
                                        onChange={(e) => setForm({ ...form, route_id: e.target.value })}
                                    >
                                        <option value="">Select route…</option>
                                        {routes.map((r) => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Driver">
                                    <select
                                        value={form.driver_id}
                                        onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                                    >
                                        <option value="">Select driver…</option>
                                        {drivers.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.user?.full_name || `D-${d.id}`}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Vehicle">
                                    <select
                                        value={form.vehicle_id}
                                        onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                                    >
                                        <option value="">Select vehicle…</option>
                                        {vehicles.map((v) => (
                                            <option key={v.id} value={v.id}>{v.plate_number}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Shift">
                                    <select
                                        value={form.shift_type}
                                        onChange={(e) => setForm({ ...form, shift_type: e.target.value })}
                                    >
                                        {SHIFT_TYPES.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Position">
                                    <select
                                        value={form.position}
                                        onChange={(e) => setForm({ ...form, position: e.target.value })}
                                    >
                                        {POSITIONS.map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Date">
                                    <input
                                        type="date"
                                        value={form.shift_date}
                                        onChange={(e) => {
                                            const d = e.target.value;
                                            setForm({
                                                ...form,
                                                shift_date: d,
                                                shift_start_time: `${d}T06:00:00`,
                                                shift_end_time: `${d}T15:00:00`,
                                            });
                                        }}
                                    />
                                </Field>
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
                            <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
                            <button className="btn primary" onClick={submit} disabled={saving}>
                                {saving ? 'Saving…' : 'Assign'}
                            </button>
                        </div>
                    </div>
                </ModalOverlay>
            ) : null}
        </>
    );
};

const Field = ({ label, children }) => (
    <div>
        <label className="text-xs muted mono" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>
            {label}
        </label>
        <div className="field" style={{ marginTop: 4 }}>{children}</div>
    </div>
);

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

export default Rotations;
