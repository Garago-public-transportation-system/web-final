import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Stat, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';
import { useTranslation } from '../../hooks/useTranslation';

const DAYS_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const startOfWeek = (d) => {
    const day = d.getDay();
    // ISO week starting Monday: JS Sunday=0, Monday=1 ... shift so Monday=0
    const diff = (day + 6) % 7;
    const monday = new Date(d);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(d.getDate() - diff);
    return monday;
};

const fmtDateISO = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const Schedule = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const addAlert = useAlertStore((s) => s.addAlert);
    const [tab, setTab] = useState('ROSTER');
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [trips, setTrips] = useState([]);
    const [rotations, setRotations] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [tripsLoading, setTripsLoading] = useState(true);
    const [rotationLoading, setRotationLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [assignModal, setAssignModal] = useState(null); // { trip } | null
    const [assignForm, setAssignForm] = useState({ driver_id: '', vehicle_id: '' });
    const [assigning, setAssigning] = useState(false);

    const weekDays = useMemo(
        () => Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return d;
        }),
        [weekStart],
    );

    const rangeLabel = useMemo(() => {
        const last = weekDays[6];
        const sameMonth = weekStart.getMonth() === last.getMonth();
        const startFmt = weekStart.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: sameMonth ? undefined : 'short',
        });
        const endFmt = last.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        return `${startFmt} → ${endFmt}`;
    }, [weekStart, weekDays]);

    const fetchTrips = useCallback(async () => {
        setTripsLoading(true);
        try {
            const res = await api.get('/admin/trips');
            setTrips(res.data || []);
        } catch {
            addAlert?.({ type: 'ERROR', message: t('schedule.failedFetchTrips') });
        } finally {
            setTripsLoading(false);
        }
    }, [addAlert, t]);

    const fetchRoster = useCallback(async () => {
        setRotationLoading(true);
        try {
            const [rot, drv, veh] = await Promise.all([
                api.get('/admin/rotations', {
                    params: {
                        start_date: fmtDateISO(weekDays[0]),
                        end_date: fmtDateISO(weekDays[6]),
                    },
                }).catch(() => ({ data: [] })),
                api.get('/admin/drivers').catch(() => ({ data: [] })),
                api.get('/admin/vehicles').catch(() => ({ data: [] })),
            ]);
            setRotations(rot.data || []);
            setDrivers(drv.data || []);
            setVehicles(veh.data || []);
        } catch {
            addAlert?.({ type: 'ERROR', message: t('schedule.failedRoster') });
        } finally {
            setRotationLoading(false);
        }
    }, [weekDays, addAlert, t]);

    const openAssign = (trip) => {
        setAssignModal(trip);
        setAssignForm({ driver_id: String(trip.driver_id || ''), vehicle_id: String(trip.vehicle_id || '') });
    };

    const submitAssign = async () => {
        if (!assignForm.driver_id) {
            addAlert?.({ type: 'WARN', message: 'Please select a driver.' });
            return;
        }
        setAssigning(true);
        try {
            const payload = { driver_id: Number(assignForm.driver_id) };
            if (assignForm.vehicle_id) payload.vehicle_id = Number(assignForm.vehicle_id);
            const res = await api.patch(`/admin/trips/${assignModal.id}/assign`, payload);
            addAlert?.({ type: 'OK', message: res.data?.message || 'Trip assigned.' });
            setAssignModal(null);
            await fetchTrips();
            await fetchRoster();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Assignment failed.' });
        } finally {
            setAssigning(false);
        }
    };

    useEffect(() => { fetchTrips(); }, [fetchTrips]);
    useEffect(() => { fetchRoster(); }, [fetchRoster]);

    const clearAllTrips = async () => {
        if (!window.confirm('This will delete ALL trips and reset all driver/vehicle statuses. Continue?')) return;
        setBusy(true);
        try {
            const res = await api.delete('/admin/trips');
            addAlert?.({ type: 'OK', message: res.data?.message || 'All trips cleared.' });
            await fetchTrips();
            await fetchRoster();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Failed to clear trips.' });
        } finally {
            setBusy(false);
        }
    };

    const deleteTrip = async (tripId) => {
        if (!window.confirm('Delete this trip and reset the driver/vehicle?')) return;
        try {
            await api.delete(`/admin/trips/${tripId}`);
            addAlert?.({ type: 'OK', message: 'Trip deleted.' });
            setTrips((prev) => prev.filter((t) => t.id !== tripId));
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Failed to delete trip.' });
        }
    };

    const generate = async (regenerate) => {
        if (regenerate && !window.confirm(t('schedule.regenerateConfirm'))) {
            return;
        }
        setBusy(true);
        try {
            const res = await api.post(`/admin/rotations/generate?regenerate=${regenerate}`);
            const { message, count } = res.data || {};
            if (count === 0) {
                addAlert?.({ type: 'WARN', message: message || t('schedule.noRotationsGenerated') });
            } else {
                addAlert?.({ type: 'OK', message: message || t('schedule.scheduleGenerated') });
            }
            await fetchTrips();
            await fetchRoster();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || t('schedule.generationFailed') });
        } finally {
            setBusy(false);
        }
    };

    const { matrix, totals } = useMemo(() => {
        const driverIds = Array.from(new Set(rotations.map((r) => r.driver_id)));
        const grid = driverIds.map((id) => {
            const row = weekDays.map(() => new Set());
            return { driver_id: id, row };
        });
        const idToIdx = Object.fromEntries(driverIds.map((id, i) => [id, i]));
        // Index lookup by local YYYY-MM-DD to avoid the UTC-vs-local
        // off-by-one that shifts Monday rotations into Tuesday in
        // east-of-UTC timezones (e.g. Africa/Cairo).
        const isoToIdx = Object.fromEntries(weekDays.map((d, i) => [fmtDateISO(d), i]));
        for (const r of rotations) {
            const isoStr = typeof r.shift_date === 'string'
                ? r.shift_date.slice(0, 10)
                : fmtDateISO(new Date(r.shift_date));
            const dayIdx = isoToIdx[isoStr];
            if (dayIdx != null && idToIdx[r.driver_id] != null) {
                grid[idToIdx[r.driver_id]].row[dayIdx].add(r.shift_type);
            }
        }
        let filled = 0;
        const capacity = driverIds.length * 7;
        for (const { row } of grid) {
            for (const cell of row) if (cell.size > 0) filled += 1;
        }
        return {
            matrix: grid,
            totals: {
                drivers: driverIds.length,
                filled,
                capacity,
                unfilled: capacity - filled,
                totalShifts: rotations.length,
            },
        };
    }, [rotations, weekDays]);

    const driverMap = useMemo(
        () => Object.fromEntries(drivers.map((d) => [d.id, d])),
        [drivers],
    );

    const shiftCellLabel = (shifts) => {
        if (!shifts.size) return 'OFF';
        if (shifts.has('MORNING') && shifts.has('EVENING')) return 'M+E';
        if (shifts.has('MORNING')) return '06–14';
        if (shifts.has('EVENING')) return '14–22';
        return Array.from(shifts)[0];
    };

    const cellStyle = (shifts) => {
        if (!shifts.size) {
            return { background: 'var(--line-softer, #ece9e1)', color: 'var(--ink-4, #7c7b74)' };
        }
        if (shifts.has('MORNING') && shifts.has('EVENING')) {
            return { background: 'var(--crit)', color: 'var(--bg)' };
        }
        if (shifts.has('MORNING')) {
            return { background: 'var(--ink)', color: 'var(--bg)' };
        }
        return { background: 'var(--ink-3, #2d2b26)', color: 'var(--bg)' };
    };

    const shiftWeek = (weeks) => {
        const next = new Date(weekStart);
        next.setDate(weekStart.getDate() + weeks * 7);
        setWeekStart(startOfWeek(next));
    };

    const todayLabel = new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
    });

    const currentWeekStart = useMemo(() => startOfWeek(new Date()), []);
    const weekRel = useMemo(() => {
        const diffDays = Math.round(
            (weekStart.getTime() - currentWeekStart.getTime()) / (24 * 3600 * 1000),
        );
        if (diffDays === 0) return 'CURRENT';
        if (diffDays < 0) return 'PAST';
        return 'FUTURE';
    }, [weekStart, currentWeekStart]);

    return (
        <>
            <PageHeader
                title={t('schedule.title')}
                sub={tab === 'ROSTER'
                    ? `${t('schedule.weeklyRoster')} · ${rangeLabel}`
                    : `${t('schedule.tripsCount', { n: trips.length })} · ${todayLabel}`}
                actions={(
                    <>
                        <button className="btn danger" onClick={clearAllTrips} disabled={busy}>
                            <Icon name="trash" />{busy ? t('shell.working') : 'Clear All Trips'}
                        </button>
                        <button className="btn" onClick={() => generate(true)} disabled={busy}>
                            <Icon name="reroute" />{busy ? t('shell.working') : t('schedule.regenerate')}
                        </button>
                        <button className="btn primary" onClick={() => generate(false)} disabled={busy}>
                            <Icon name="plus" />{busy ? t('shell.working') : t('schedule.generateSafe')}
                        </button>
                    </>
                )}
            />

            <Filterbar>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        className={`btn ${tab === 'ROSTER' ? 'primary' : ''}`}
                        onClick={() => setTab('ROSTER')}
                    >
                        {t('schedule.weeklyRoster')}
                    </button>
                    <button
                        className={`btn ${tab === 'TRIPS' ? 'primary' : ''}`}
                        onClick={() => setTab('TRIPS')}
                    >
                        {t('schedule.todaysTrips')}
                    </button>
                </div>
                {tab === 'ROSTER' ? (
                    <>
                        <div className="sep" />
                        <button
                            className={`btn ${weekRel === 'PAST' ? 'primary' : ''}`}
                            onClick={() => shiftWeek(-1)}
                        >
                            <Icon name="arrow-left" />{t('schedule.prevWeek')}
                        </button>
                        <button
                            className={`btn ${weekRel === 'CURRENT' ? 'primary' : ''}`}
                            onClick={() => setWeekStart(startOfWeek(new Date()))}
                        >
                            {t('schedule.thisWeek')}
                        </button>
                        <button
                            className={`btn ${weekRel === 'FUTURE' ? 'primary' : ''}`}
                            onClick={() => shiftWeek(1)}
                        >
                            {t('schedule.nextWeek')}<Icon name="arrow-right" />
                        </button>
                        <span className="mono text-xs muted" style={{ marginInlineStart: 'auto' }}>
                            {rangeLabel}
                        </span>
                    </>
                ) : null}
            </Filterbar>

            <div className="main-body">
                {tab === 'ROSTER' ? (
                    <>
                        <div className="grid-4 mb-4">
                            <Stat label={t('schedule.driversRostered')} value={rotationLoading ? '—' : String(totals.drivers)} />
                            <Stat
                                label={t('schedule.shiftsFilled')}
                                value={rotationLoading
                                    ? '—'
                                    : `${totals.filled} / ${totals.capacity || 0}`}
                            />
                            <Stat
                                label={t('schedule.totalShifts')}
                                value={rotationLoading ? '—' : String(totals.totalShifts)}
                            />
                            <Stat
                                label={t('schedule.unfilled')}
                                value={rotationLoading ? '—' : String(Math.max(totals.unfilled, 0))}
                            />
                        </div>

                        <Panel
                            title={t('schedule.roster')}
                            action={(
                                <span className="mono text-xs muted" style={{ letterSpacing: '.04em' }}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            width: 10,
                                            height: 10,
                                            background: 'var(--ink)',
                                            marginInlineEnd: 4,
                                            verticalAlign: 'middle',
                                        }}
                                    />
                                    {t('schedule.morning')}
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            width: 10,
                                            height: 10,
                                            background: 'var(--ink-3, #2d2b26)',
                                            marginInlineStart: 12,
                                            marginInlineEnd: 4,
                                            verticalAlign: 'middle',
                                        }}
                                    />
                                    {t('schedule.evening')}
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            width: 10,
                                            height: 10,
                                            background: 'var(--crit)',
                                            marginInlineStart: 12,
                                            marginInlineEnd: 4,
                                            verticalAlign: 'middle',
                                        }}
                                    />
                                    {t('schedule.double')}
                                </span>
                            )}
                            flush
                        >
                            {rotationLoading ? (
                                <LoadingState />
                            ) : matrix.length === 0 ? (
                                <div style={{ padding: 28 }}>
                                    <Empty>
                                        {t('schedule.noRotationsThisWeek')}
                                    </Empty>
                                </div>
                            ) : (
                                <table className="tbl">
                                    <thead>
                                        <tr>
                                            <th style={{ minWidth: 180 }}>{t('shell.driver')}</th>
                                            {weekDays.map((d, i) => (
                                                <th key={i} style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: 11, fontWeight: 600 }}>{DAYS_LABEL[i]}</div>
                                                    <div
                                                        className="mono muted text-xs"
                                                        style={{ letterSpacing: '.04em', marginTop: 2 }}
                                                    >
                                                        {d.getDate().toString().padStart(2, '0')}
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="num" style={{ width: 70 }}>{t('schedule.hours')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matrix.map(({ driver_id, row }) => {
                                            const driver = driverMap[driver_id];
                                            const shiftCount = row.reduce((acc, cell) => acc + cell.size, 0);
                                            return (
                                                <tr key={driver_id}>
                                                    <td>
                                                        <div>
                                                            {driver?.user?.full_name || driver?.full_name || `Driver #${driver_id}`}
                                                        </div>
                                                        <div className="mono text-xs muted" style={{ marginTop: 2 }}>
                                                            D-{String(driver_id).padStart(4, '0')}
                                                        </div>
                                                    </td>
                                                    {row.map((shifts, i) => (
                                                        <td key={i} style={{ textAlign: 'center', padding: 4 }}>
                                                            <div
                                                                style={{
                                                                    ...cellStyle(shifts),
                                                                    padding: '10px 0',
                                                                    fontFamily: 'JetBrains Mono, monospace',
                                                                    fontSize: 11,
                                                                    letterSpacing: '.05em',
                                                                    minWidth: 64,
                                                                }}
                                                                title={Array.from(shifts).join(' + ') || 'OFF'}
                                                            >
                                                                {shiftCellLabel(shifts)}
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td className="num mono text-xs">{shiftCount * 8}h</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </Panel>
                    </>
                ) : (
                    <Panel title={t('schedule.todaysTrips')} flush>
                        {tripsLoading ? (
                            <LoadingState />
                        ) : trips.length === 0 ? (
                            <div style={{ padding: 28 }}><Empty>{t('schedule.noTripsToday')}</Empty></div>
                        ) : (
                            <table className="tbl">
                                <thead>
                                    <tr>
                                        <th style={{ width: 90 }}>{t('schedule.tripNumber')}</th>
                                        <th>{t('shell.route')}</th>
                                        <th className="num">{t('shell.start')}</th>
                                        <th className="num">{t('shell.end')}</th>
                                        <th>{t('shell.driver')}</th>
                                        <th>{t('shell.vehicle')}</th>
                                        <th>{t('common.status')}</th>
                                        <th style={{ width: 160 }}>{t('shell.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trips.map((trip) => (
                                        <tr key={trip.id}>
                                            <td className="mono text-sm">#{trip.trip_number}</td>
                                            <td>
                                                <div>
                                                    {trip.origin} → {trip.destination}
                                                </div>
                                                <div className="muted text-xs mono" style={{ marginTop: 2 }}>
                                                    {trip.route_name} · {trip.direction}
                                                </div>
                                            </td>
                                            <td className="num mono text-xs">
                                                {trip.start_time
                                                    ? new Date(trip.start_time).toLocaleTimeString('en-GB', {
                                                          hour: '2-digit',
                                                          minute: '2-digit',
                                                      })
                                                    : '—'}
                                            </td>
                                            <td className="num mono text-xs">
                                                {trip.end_time
                                                    ? new Date(trip.end_time).toLocaleTimeString('en-GB', {
                                                          hour: '2-digit',
                                                          minute: '2-digit',
                                                      })
                                                    : '—'}
                                            </td>
                                            <td>{trip.driver_name}</td>
                                            <td className="mono text-xs">{trip.vehicle_plate}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                    <Tag status={trip.status || 'SCHEDULED'} />
                                                    {trip.is_late && (
                                                        <span className="tag crit" style={{ fontWeight: 700 }}>
                                                            <span className="dot" />LATE
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    <button
                                                        className="btn ghost"
                                                        onClick={() => navigate(`/admin/trips/${trip.id}`)}
                                                    >
                                                        {t('shell.details')}
                                                    </button>
                                                    <button
                                                        className="btn ghost"
                                                        onClick={() => openAssign(trip)}
                                                        title="Reassign driver / vehicle"
                                                    >
                                                        <Icon name="user-edit" />
                                                    </button>
                                                    <button
                                                        className="btn ghost"
                                                        onClick={() => deleteTrip(trip.id)}
                                                        title="Delete trip"
                                                        style={{ color: 'var(--crit)' }}
                                                    >
                                                        <Icon name="trash" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Panel>
                )}
            </div>

        {assignModal && (
            <div style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}>
                <div style={{
                    background: 'var(--bg)', borderRadius: 12, padding: 28,
                    minWidth: 360, maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,.3)',
                }}>
                    <h3 style={{ margin: '0 0 4px' }}>Assign Trip #{assignModal.trip_number}</h3>
                    <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--ink-4, #7c7b74)' }}>
                        {assignModal.route_name} · {assignModal.origin} → {assignModal.destination}
                    </p>

                    <label style={{ display: 'block', marginBottom: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Driver</span>
                        <select
                            value={assignForm.driver_id}
                            onChange={(e) => setAssignForm((f) => ({ ...f, driver_id: e.target.value }))}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line, #e5e3dc)', background: 'var(--bg)', fontSize: 14 }}
                        >
                            <option value="">— select driver —</option>
                            {drivers
                                .filter((d) => d.status !== 'ON_TRIP')
                                .map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.user?.full_name || `Driver #${d.id}`} — {d.status}
                                    </option>
                                ))}
                        </select>
                    </label>

                    <label style={{ display: 'block', marginBottom: 24 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Vehicle <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>(auto-select if blank)</span></span>
                        <select
                            value={assignForm.vehicle_id}
                            onChange={(e) => setAssignForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line, #e5e3dc)', background: 'var(--bg)', fontSize: 14 }}
                        >
                            <option value="">— auto-select —</option>
                            {vehicles
                                .filter((v) => v.status === 'FREE' || v.id === assignModal.vehicle_id)
                                .map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.plate_number} — {v.status}
                                    </option>
                                ))}
                        </select>
                    </label>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn ghost" onClick={() => setAssignModal(null)} disabled={assigning}>
                            Cancel
                        </button>
                        <button className="btn primary" onClick={submitAssign} disabled={assigning}>
                            {assigning ? 'Assigning…' : 'Confirm Assignment'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default Schedule;
