import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Stat, Panel, PageHeader, MiniMap, Bar, LoadingState, Empty, Tag } from '../../garago/Shell';
import Icon from '../../garago/Icon';

const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [audit, setAudit] = useState([]);
    const [trips, setTrips] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [s, a, t, k] = await Promise.all([
                    api.get('/admin/dashboard/stats'),
                    api.get('/admin/audit-logs').catch(() => ({ data: [] })),
                    api.get('/admin/trips').catch(() => ({ data: [] })),
                    api.get('/admin/tickets/').catch(() => ({ data: [] })),
                ]);
                if (cancelled) return;
                setStats(s.data);
                setAudit(Array.isArray(a.data) ? a.data.slice(0, 20) : []);
                setTrips(Array.isArray(t.data) ? t.data : []);
                setTickets(Array.isArray(k.data) ? k.data : []);
            } catch {
                if (!cancelled) setError('Unable to load dashboard data.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const today = useMemo(
        () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }),
        [],
    );

    const tripsPerRoute = stats?.trips_per_route || [];
    const totalRouteTrips = tripsPerRoute.reduce((sum, r) => sum + (r.trips || 0), 0);

    const hourlyRidership = useMemo(() => {
        const buckets = Array.from({ length: 24 }, () => 0);
        const todayStr = new Date().toDateString();
        for (const t of trips) {
            const iso = t.start_time || t.actual_start || t.scheduled_start;
            if (!iso) continue;
            const d = new Date(iso);
            if (d.toDateString() !== todayStr) continue;
            const h = d.getHours();
            if (h >= 0 && h < 24) buckets[h] += 1;
        }
        const max = Math.max(...buckets, 1);
        const peakIdx = buckets.indexOf(Math.max(...buckets));
        return { buckets, max, peakIdx, peakValue: buckets[peakIdx] };
    }, [trips]);

    const tripsSpark = useMemo(() => {
        const days = Array.from({ length: 7 }, () => 0);
        const now = new Date();
        for (const t of trips) {
            const iso = t.start_time || t.scheduled_start;
            if (!iso) continue;
            const delta = Math.floor((now - new Date(iso)) / (24 * 3600 * 1000));
            if (delta >= 0 && delta < 7) days[6 - delta] += 1;
        }
        return days.every((v) => v === 0) ? null : days;
    }, [trips]);

    const ticketStatus = useMemo(() => {
        const counts = {};
        let total = 0;
        for (const t of tickets) {
            const k = t.status || 'ISSUED';
            counts[k] = (counts[k] || 0) + 1;
            total += 1;
        }
        const order = ['ISSUED', 'USED', 'EXPIRED', 'VOIDED'];
        const rows = order
            .filter((k) => counts[k])
            .map((k) => ({ k, n: counts[k], v: total ? counts[k] / total : 0 }));
        return { rows, total };
    }, [tickets]);

    return (
        <>
            <PageHeader
                title="Operations overview"
                sub={`Today · ${today}`}
                actions={(
                    <>
                        <button className="btn" onClick={() => navigate('/admin/reports')}>
                            <Icon name="download" />Reports
                        </button>
                        <button className="btn primary" onClick={() => navigate('/admin/schedule')}>
                            <Icon name="plus" />New shift
                        </button>
                    </>
                )}
            />
            <div className="main-body">
                {error ? (
                    <div
                        className="panel mb-4"
                        style={{ borderColor: 'var(--crit)', color: 'var(--crit)', padding: 12 }}
                    >
                        <strong>Error</strong> — {error}
                    </div>
                ) : null}

                <div className="grid-4 mb-4">
                    <Stat
                        label="Total users"
                        value={loading ? '—' : (stats?.total_users ?? 0).toLocaleString()}
                        onClick={() => navigate('/admin/users')}
                    />
                    <Stat
                        label="On-duty drivers"
                        value={loading ? '—' : (stats?.total_drivers ?? 0).toLocaleString()}
                        onClick={() => navigate('/admin/drivers')}
                    />
                    <Stat
                        label="Active vehicles"
                        value={loading ? '—' : (stats?.total_vehicles ?? 0).toLocaleString()}
                        onClick={() => navigate('/admin/vehicles')}
                    />
                    <Stat
                        label="Active trips"
                        value={loading ? '—' : (stats?.active_trips ?? 0).toLocaleString()}
                        spark={tripsSpark}
                        onClick={() => navigate('/admin/schedule')}
                    />
                </div>

                <div className="grid-3 mb-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
                    <Panel
                        title="Live network"
                        action={(
                            <span className="tag ok">
                                <span className="dot" />All systems
                            </span>
                        )}
                    >
                        <MiniMap
                            height={340}
                            pins={tripsPerRoute.slice(0, 6).map((r, i) => ({
                                x: 15 + ((i * 13) % 80),
                                y: 22 + ((i * 17) % 60),
                                label: String(i + 1).padStart(2, '0'),
                                status: r.trips > 50 ? 'crit' : r.trips > 30 ? 'warn' : 'ok',
                            }))}
                        >
                            <div className="map-overlay" style={{ top: 12, insetInlineStart: 12 }}>
                                <div
                                    className="mono text-xs muted mb-2"
                                    style={{ letterSpacing: '.06em', textTransform: 'uppercase' }}
                                >
                                    Legend
                                </div>
                                <div className="flex items-center gap-2 text-xs mb-2">
                                    <span
                                        className="map-pin ok"
                                        style={{ position: 'static', width: 12, height: 12, fontSize: 0 }}
                                    />
                                    Normal
                                </div>
                                <div className="flex items-center gap-2 text-xs mb-2">
                                    <span
                                        className="map-pin warn"
                                        style={{ position: 'static', width: 12, height: 12, fontSize: 0 }}
                                    />
                                    Elevated load
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span
                                        className="map-pin crit"
                                        style={{ position: 'static', width: 12, height: 12, fontSize: 0 }}
                                    />
                                    Crowding
                                </div>
                            </div>
                            <div
                                className="map-overlay"
                                style={{ bottom: 12, insetInlineEnd: 12, minWidth: 180 }}
                            >
                                <div className="flex justify-between">
                                    <span className="muted">Routes</span>
                                    <span className="mono">{stats?.total_routes ?? 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="muted">Active trips</span>
                                    <span className="mono">{stats?.active_trips ?? 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="muted">Maintenance</span>
                                    <span className="mono">{stats?.pending_maintenance ?? 0}</span>
                                </div>
                            </div>
                        </MiniMap>
                    </Panel>

                    <Panel
                        title="Alerts"
                        action={(
                            <a
                                className="mono text-xs"
                                onClick={() => navigate('/admin/audit-logs')}
                                style={{ cursor: 'pointer' }}
                            >
                                view all →
                            </a>
                        )}
                    >
                        <div style={{ margin: -14 }}>
                            {loading ? (
                                <LoadingState />
                            ) : audit.length === 0 ? (
                                <div style={{ padding: 16 }}><Empty>No recent activity</Empty></div>
                            ) : (
                                audit.slice(0, 8).map((a) => {
                                    const sev = a.action?.includes('DELETE') || a.action?.includes('REJECT')
                                        ? 'crit'
                                        : a.action?.includes('CREATE') ? 'ok' : 'warn';
                                    const at = a.timestamp
                                        ? new Date(a.timestamp).toLocaleTimeString('en-GB', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                          })
                                        : '—';
                                    return (
                                        <div
                                            key={a.id}
                                            style={{
                                                padding: 12,
                                                borderBottom: '1px solid var(--line-soft)',
                                                display: 'flex',
                                                gap: 10,
                                            }}
                                        >
                                            <span className={`tag ${sev}`} style={{ flexShrink: 0 }}>{at}</span>
                                            <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                                                {a.action} {a.target_type ? `· ${a.target_type}` : ''}
                                                <div
                                                    className="muted mono text-xs mt-2"
                                                    style={{ fontSize: 10, letterSpacing: '.04em' }}
                                                >
                                                    {a.actor_email || 'system'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </Panel>
                </div>

                <div className="grid-3 mb-4">
                    <Panel
                        title="Ridership · hourly"
                        action={<span className="mono text-xs muted">00:00 – 23:00 · today</span>}
                    >
                        <Heatstrip
                            data={hourlyRidership}
                            loading={loading}
                            activeTrips={stats?.active_trips ?? 0}
                        />
                    </Panel>
                    <Panel
                        title="Trips per route"
                        action={<span className="mono text-xs muted">share</span>}
                    >
                        {loading ? (
                            <LoadingState />
                        ) : tripsPerRoute.length === 0 ? (
                            <Empty>No trip data yet</Empty>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {tripsPerRoute.slice(0, 6).map((r, i) => {
                                    const share = totalRouteTrips ? r.trips / totalRouteTrips : 0;
                                    const kind = share >= 0.3 ? 'warn' : share >= 0.45 ? 'crit' : 'ok';
                                    return (
                                        <div key={`${r.name}-${i}`}>
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="truncate" style={{ maxWidth: 180 }}>
                                                    <span className="mono muted text-xs">{String(i + 1).padStart(2, '0')}</span> · {r.name}
                                                </span>
                                                <span className="mono">{r.trips}</span>
                                            </div>
                                            <Bar value={share} kind={kind} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Panel>
                    <Panel
                        title="Ticket status"
                        action={<span className="mono text-xs muted">today</span>}
                    >
                        <TicketStatusBreakdown data={ticketStatus} loading={loading} />
                    </Panel>
                </div>

                <Panel
                    title="Activity stream"
                    action={<span className="mono text-xs muted">last {audit.length} events</span>}
                    flush
                >
                    {loading ? (
                        <LoadingState />
                    ) : audit.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No recent activity.</Empty></div>
                    ) : (
                        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                            <table className="tbl">
                                <thead>
                                    <tr>
                                        <th style={{ width: 90 }}>Time</th>
                                        <th>Action</th>
                                        <th>Target</th>
                                        <th>Actor</th>
                                        <th style={{ width: 100 }}>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {audit.map((a) => {
                                        const at = a.timestamp
                                            ? new Date(a.timestamp).toLocaleTimeString('en-GB', {
                                                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                                              })
                                            : '—';
                                        const kind = a.action?.includes('DELETE') || a.action?.includes('REJECT')
                                            ? 'CRIT'
                                            : a.action?.includes('CREATE') || a.action?.includes('APPROVE')
                                                ? 'OK'
                                                : 'WARN';
                                        return (
                                            <tr key={a.id}>
                                                <td className="mono text-xs">{at}</td>
                                                <td className="mono text-xs">{a.action || '—'}</td>
                                                <td className="mono text-xs">
                                                    {a.target_type
                                                        ? `${a.target_type}${a.target_id != null ? `#${a.target_id}` : ''}`
                                                        : '—'}
                                                </td>
                                                <td className="text-sm">{a.actor_email || 'system'}</td>
                                                <td><Tag status={kind} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </div>
        </>
    );
};

const Heatstrip = ({ data, loading, activeTrips = 0 }) => {
    if (loading) return <LoadingState />;
    const { buckets, max, peakIdx, peakValue } = data;
    if (!buckets || buckets.every((v) => v === 0)) {
        if (activeTrips > 0) {
            return (
                <Empty>
                    {activeTrips} trip{activeTrips === 1 ? '' : 's'} active now — hourly breakdown unavailable.
                </Empty>
            );
        }
        return <Empty>No ridership data for today.</Empty>;
    }
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
                {buckets.map((v, i) => {
                    const ratio = v / max;
                    const color = ratio >= 0.85
                        ? 'var(--crit)'
                        : ratio >= 0.65 ? 'var(--warn)' : 'var(--ink)';
                    return (
                        <div
                            key={i}
                            style={{
                                flex: 1,
                                height: `${Math.max(ratio * 100, v > 0 ? 6 : 2)}%`,
                                background: v > 0 ? color : 'var(--line)',
                                minHeight: 2,
                            }}
                            title={`${i.toString().padStart(2, '0')}:00 · ${v} trip${v === 1 ? '' : 's'}`}
                        />
                    );
                })}
            </div>
            <div
                style={{
                    display: 'flex',
                    gap: 2,
                    marginTop: 6,
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--ink-4)',
                }}
            >
                {buckets.map((_, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        {i % 3 === 0 ? i.toString().padStart(2, '0') : ''}
                    </div>
                ))}
            </div>
            <div className="rule mt-3">
                Peak · {peakIdx.toString().padStart(2, '0')}:00 · {peakValue} trip{peakValue === 1 ? '' : 's'}
            </div>
        </div>
    );
};

const TicketStatusBreakdown = ({ data, loading }) => {
    if (loading) return <LoadingState />;
    const { rows, total } = data;
    if (!total || rows.length === 0) {
        return <Empty>No tickets yet.</Empty>;
    }
    const shades = ['var(--ink)', 'var(--ink-3)', 'var(--ink-5)', 'var(--crit)'];
    return (
        <div>
            <div style={{ display: 'flex', height: 8, marginBottom: 16, overflow: 'hidden' }}>
                {rows.map((r, i) => (
                    <div
                        key={r.k}
                        style={{ flex: r.v * 100, background: shades[i % shades.length] }}
                        title={`${r.k} · ${Math.round(r.v * 100)}%`}
                    />
                ))}
            </div>
            {rows.map((r, i) => (
                <div
                    key={r.k}
                    className="flex justify-between text-sm"
                    style={{
                        padding: '6px 0',
                        borderBottom: i < rows.length - 1 ? '1px solid var(--line-soft)' : 'none',
                    }}
                >
                    <span className="flex items-center gap-2">
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                background: shades[i % shades.length],
                                display: 'inline-block',
                            }}
                        />
                        {r.k}
                    </span>
                    <span>
                        <span className="mono muted text-xs">{r.n}</span>
                        <span className="mono" style={{ marginInlineStart: 8 }}>
                            {Math.round(r.v * 100)}%
                        </span>
                    </span>
                </div>
            ))}
        </div>
    );
};

export default Dashboard;
