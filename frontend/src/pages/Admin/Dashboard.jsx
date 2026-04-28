import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Stat, Panel, PageHeader, Bar, LoadingState, Empty, Tag } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useTranslation } from '../../hooks/useTranslation';

const Dashboard = () => {
    const navigate = useNavigate();
    const { t, language } = useTranslation();
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
                const [statsRes, auditRes, tripsRes, ticketsRes] = await Promise.all([
                    api.get('/admin/dashboard/stats'),
                    api.get('/admin/audit-logs').catch(() => ({ data: [] })),
                    api.get('/admin/trips').catch(() => ({ data: [] })),
                    api.get('/admin/tickets/').catch(() => ({ data: [] })),
                ]);
                if (cancelled) return;
                setStats(statsRes.data);
                setAudit(Array.isArray(auditRes.data) ? auditRes.data.slice(0, 20) : []);
                setTrips(Array.isArray(tripsRes.data) ? tripsRes.data : []);
                setTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : []);
            } catch {
                if (!cancelled) setError(t('admin.dash.errorLoad'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const today = useMemo(
        () => new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', {
            weekday: 'long',
            day: '2-digit',
            month: 'short',
        }),
        [language],
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
                title={t('admin.dash.title')}
                sub={`${t('admin.dash.today')} · ${today}`}
                actions={(
                    <>
                        <button className="btn" onClick={() => navigate('/admin/reports')}>
                            <Icon name="download" />{t('admin.dash.reports')}
                        </button>
                        <button className="btn primary" onClick={() => navigate('/admin/schedule')}>
                            <Icon name="plus" />{t('admin.dash.newShift')}
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
                        label={t('admin.dash.totalUsers')}
                        value={loading ? '—' : (stats?.total_users ?? 0).toLocaleString()}
                        onClick={() => navigate('/admin/users')}
                    />
                    <Stat
                        label={t('admin.dash.onDutyDrivers')}
                        value={loading ? '—' : (stats?.total_drivers ?? 0).toLocaleString()}
                        onClick={() => navigate('/admin/drivers')}
                    />
                    <Stat
                        label={t('admin.dash.activeVehicles')}
                        value={loading ? '—' : (stats?.total_vehicles ?? 0).toLocaleString()}
                        onClick={() => navigate('/admin/vehicles')}
                    />
                    <Stat
                        label={t('admin.dash.activeTrips')}
                        value={loading ? '—' : (stats?.active_trips ?? 0).toLocaleString()}
                        spark={tripsSpark}
                        onClick={() => navigate('/admin/schedule')}
                    />
                </div>

                <Panel
                    title={t('admin.dash.systemAlerts')}
                    action={(
                        <a
                            className="mono text-xs"
                            onClick={() => navigate('/admin/audit-logs')}
                            style={{ cursor: 'pointer' }}
                        >
                            {t('admin.dash.viewAll')}
                        </a>
                    )}
                    flush
                >
                    <div className="mb-4">
                        {loading ? (
                            <LoadingState />
                        ) : audit.length === 0 ? (
                            <div style={{ padding: 28 }}><Empty>{t('admin.dash.noActivity')}</Empty></div>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                                    gap: 0,
                                }}
                            >
                                {audit.slice(0, 8).map((a) => <AlertRow key={a.id} a={a} />)}
                            </div>
                        )}
                    </div>
                </Panel>
                <div style={{ height: 16 }} />

                <div className="grid-3 mb-4">
                    <Panel
                        title={t('admin.dash.ridership')}
                        action={<span className="mono text-xs muted">00:00 – 23:00 · {t('admin.dash.today')}</span>}
                    >
                        <Heatstrip
                            data={hourlyRidership}
                            loading={loading}
                            activeTrips={stats?.active_trips ?? 0}
                            t={t}
                        />
                    </Panel>
                    <Panel
                        title={t('admin.dash.tripsPerRoute')}
                        action={<span className="mono text-xs muted">{t('admin.dash.share')}</span>}
                    >
                        {loading ? (
                            <LoadingState />
                        ) : tripsPerRoute.length === 0 ? (
                            <Empty>{t('admin.dash.noRoutesData')}</Empty>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {tripsPerRoute.slice(0, 6).map((r, i) => {
                                    const share = totalRouteTrips ? r.trips / totalRouteTrips : 0;
                                    const kind = share >= 0.45 ? 'crit' : share >= 0.30 ? 'warn' : 'ok';
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
                        title={t('admin.dash.ticketStatus')}
                        action={<span className="mono text-xs muted">{t('admin.dash.today')}</span>}
                    >
                        <TicketStatusBreakdown data={ticketStatus} loading={loading} t={t} />
                    </Panel>
                </div>
            </div>
        </>
    );
};

const SEVERITY = {
    crit: {
        bar: 'var(--crit)',
        bg: 'color-mix(in oklab, var(--crit) 14%, transparent)',
        chipBg: 'var(--crit)',
        chipFg: 'var(--bg)',
        label: 'CRITICAL',
        icon: 'alert-octagon',
    },
    warn: {
        bar: 'var(--warn)',
        bg: 'color-mix(in oklab, var(--warn) 14%, transparent)',
        chipBg: 'var(--warn)',
        chipFg: 'var(--ink)',
        label: 'WARN',
        icon: 'alert-triangle',
    },
    ok: {
        bar: 'var(--ok)',
        bg: 'color-mix(in oklab, var(--ok) 12%, transparent)',
        chipBg: 'var(--ok)',
        chipFg: 'var(--bg)',
        label: 'OK',
        icon: 'check',
    },
};

const AlertRow = ({ a }) => {
    const sev = a.action?.includes('DELETE') || a.action?.includes('REJECT')
        ? 'crit'
        : a.action?.includes('CREATE') || a.action?.includes('APPROVE')
            ? 'ok'
            : 'warn';
    const cfg = SEVERITY[sev];
    const at = a.timestamp
        ? new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '—';
    const date = a.timestamp
        ? new Date(a.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : '';
    return (
        <div
            style={{
                position: 'relative',
                padding: '14px 16px 14px 24px',
                borderBottom: '1px solid var(--line-soft)',
                background: cfg.bg,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
            }}
        >
            <span
                style={{
                    position: 'absolute',
                    insetInlineStart: 0,
                    top: 0,
                    bottom: 0,
                    width: 6,
                    background: cfg.bar,
                }}
            />
            <span
                style={{
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 9.5,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    padding: '4px 8px',
                    background: cfg.chipBg,
                    color: cfg.chipFg,
                    borderRadius: 2,
                }}
            >
                <Icon name={cfg.icon} />
                {cfg.label}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 500 }}>
                    {a.action || 'EVENT'}
                    {a.target_type ? (
                        <span className="muted mono text-xs" style={{ marginLeft: 6 }}>
                            · {a.target_type}{a.target_id != null ? ` #${a.target_id}` : ''}
                        </span>
                    ) : null}
                </div>
                <div
                    className="mono"
                    style={{
                        fontSize: 11,
                        marginTop: 4,
                        color: 'var(--ink-4)',
                        letterSpacing: '.02em',
                    }}
                >
                    {a.actor_email || 'system'} · {date} {at}
                </div>
            </div>
        </div>
    );
};

const Heatstrip = ({ data, loading, activeTrips = 0, t }) => {
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
        return <Empty>{t ? t('admin.dash.noRoutesData') : 'No ridership data for today.'}</Empty>;
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
                {t ? t('admin.dash.peak') : 'Peak'} · {peakIdx.toString().padStart(2, '0')}:00 · {peakValue}
            </div>
        </div>
    );
};

const TicketStatusBreakdown = ({ data, loading, t }) => {
    if (loading) return <LoadingState />;
    const { rows, total } = data;
    if (!total || rows.length === 0) {
        return <Empty>{t ? t('admin.dash.noTickets') : 'No tickets yet.'}</Empty>;
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
