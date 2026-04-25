import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Stat, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

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
            addAlert?.({ type: 'ERROR', message: 'Failed to fetch trips.' });
        } finally {
            setTripsLoading(false);
        }
    }, [addAlert]);

    const fetchRoster = useCallback(async () => {
        setRotationLoading(true);
        try {
            const [rot, drv] = await Promise.all([
                api.get('/admin/rotations', {
                    params: {
                        start_date: fmtDateISO(weekDays[0]),
                        end_date: fmtDateISO(weekDays[6]),
                    },
                }).catch(() => ({ data: [] })),
                api.get('/admin/drivers').catch(() => ({ data: [] })),
            ]);
            setRotations(rot.data || []);
            setDrivers(drv.data || []);
        } catch {
            addAlert?.({ type: 'ERROR', message: 'Failed to load roster.' });
        } finally {
            setRotationLoading(false);
        }
    }, [weekDays, addAlert]);

    useEffect(() => { fetchTrips(); }, [fetchTrips]);
    useEffect(() => { fetchRoster(); }, [fetchRoster]);

    const generate = async (regenerate) => {
        if (regenerate && !window.confirm('This will delete the current schedule and create a new one. Continue?')) {
            return;
        }
        setBusy(true);
        try {
            const res = await api.post(`/admin/rotations/generate?regenerate=${regenerate}`);
            const { message, count } = res.data || {};
            if (count === 0) {
                addAlert?.({ type: 'WARN', message: message || 'No rotations generated.' });
            } else {
                addAlert?.({ type: 'OK', message: message || 'Schedule generated.' });
            }
            await fetchTrips();
            await fetchRoster();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Generation failed.' });
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
        const weekStartMs = weekDays[0].getTime();
        for (const r of rotations) {
            const d = new Date(r.shift_date);
            const dayDiff = Math.floor((d.getTime() - weekStartMs) / (24 * 3600 * 1000));
            if (dayDiff >= 0 && dayDiff < 7 && idToIdx[r.driver_id] != null) {
                grid[idToIdx[r.driver_id]].row[dayDiff].add(r.shift_type);
            }
        }
        let filled = 0;
        let capacity = driverIds.length * 7;
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

    return (
        <>
            <PageHeader
                title="Schedule"
                sub={tab === 'ROSTER' ? `Week of ${rangeLabel}` : `${trips.length} trips · ${todayLabel}`}
                actions={(
                    <>
                        <button className="btn" onClick={() => generate(true)} disabled={busy}>
                            <Icon name="reroute" />{busy ? 'Working…' : 'Regenerate'}
                        </button>
                        <button className="btn primary" onClick={() => generate(false)} disabled={busy}>
                            <Icon name="plus" />{busy ? 'Working…' : 'Generate safe'}
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
                        Weekly roster
                    </button>
                    <button
                        className={`btn ${tab === 'TRIPS' ? 'primary' : ''}`}
                        onClick={() => setTab('TRIPS')}
                    >
                        Today's trips
                    </button>
                </div>
                {tab === 'ROSTER' ? (
                    <>
                        <div className="sep" />
                        <button className="btn" onClick={() => shiftWeek(-1)}>
                            <Icon name="arrow-left" />Prev week
                        </button>
                        <button className="btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>
                            This week
                        </button>
                        <button className="btn" onClick={() => shiftWeek(1)}>
                            Next week<Icon name="arrow-right" />
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
                            <Stat label="Drivers rostered" value={rotationLoading ? '—' : String(totals.drivers)} />
                            <Stat
                                label="Shifts filled"
                                value={rotationLoading
                                    ? '—'
                                    : `${totals.filled} / ${totals.capacity || 0}`}
                            />
                            <Stat
                                label="Total shift assignments"
                                value={rotationLoading ? '—' : String(totals.totalShifts)}
                            />
                            <Stat
                                label="Unfilled day-slots"
                                value={rotationLoading ? '—' : String(Math.max(totals.unfilled, 0))}
                            />
                        </div>

                        <Panel
                            title="Roster"
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
                                    Morning
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
                                    Evening
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
                                    Double
                                </span>
                            )}
                            flush
                        >
                            {rotationLoading ? (
                                <LoadingState />
                            ) : matrix.length === 0 ? (
                                <div style={{ padding: 28 }}>
                                    <Empty>
                                        No rotations for this week. Use “Generate safe” to build the schedule.
                                    </Empty>
                                </div>
                            ) : (
                                <table className="tbl">
                                    <thead>
                                        <tr>
                                            <th style={{ minWidth: 180 }}>Driver</th>
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
                                            <th className="num" style={{ width: 70 }}>Hours</th>
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
                    <Panel title="Today's trips" flush>
                        {tripsLoading ? (
                            <LoadingState />
                        ) : trips.length === 0 ? (
                            <div style={{ padding: 28 }}><Empty>No trips generated for today.</Empty></div>
                        ) : (
                            <table className="tbl">
                                <thead>
                                    <tr>
                                        <th style={{ width: 90 }}>Trip #</th>
                                        <th>Route</th>
                                        <th className="num">Start</th>
                                        <th className="num">End</th>
                                        <th>Driver</th>
                                        <th>Vehicle</th>
                                        <th>Status</th>
                                        <th style={{ width: 110 }}>Action</th>
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
                                            <td><Tag status={trip.status || 'SCHEDULED'} /></td>
                                            <td>
                                                <button
                                                    className="btn ghost"
                                                    onClick={() => navigate(`/admin/trips/${trip.id}`)}
                                                >
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Panel>
                )}
            </div>
        </>
    );
};

export default Schedule;
