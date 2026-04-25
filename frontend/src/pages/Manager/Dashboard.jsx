import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Panel, Stat, Bar, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useWebSocket } from '../../context/WebSocketContext';

const crowdingKind = (score) => {
    if (score >= 0.9) return 'crit';
    if (score >= 0.7) return 'warn';
    return 'ok';
};

const crowdingLabel = (score) => {
    if (score >= 0.9) return 'Critical';
    if (score >= 0.7) return 'Heavy';
    return 'Normal';
};

const ManagerDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTrips, setActiveTrips] = useState([]);
    const [tripsLoading, setTripsLoading] = useState(true);
    const { lastNotification } = useWebSocket() || {};

    const fetchStats = useCallback(async () => {
        try {
            const res = await api.get('/manager/dashboard/stats');
            setStats(res.data);
        } catch {
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchActiveTrips = useCallback(async () => {
        setTripsLoading(true);
        try {
            const res = await api.get('/manager/trips/active');
            setActiveTrips(res.data || []);
        } catch {
            setActiveTrips([]);
        } finally {
            setTripsLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); fetchActiveTrips(); }, [fetchStats, fetchActiveTrips]);

    useEffect(() => {
        if (!lastNotification) return;
        if (lastNotification.type === 'crowding_alert' || lastNotification.type === 'trip_status') {
            fetchActiveTrips();
        }
    }, [lastNotification, fetchActiveTrips]);

    const todayLabel = new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
    });

    const revenue = Number(stats?.total_revenue || 0);
    const critical = useMemo(
        () => activeTrips.filter((t) => (t.crowding_score || 0) >= 0.9).length,
        [activeTrips],
    );

    return (
        <>
            <PageHeader
                title="Live operations"
                sub={`${todayLabel} · real-time fleet status`}
                actions={(
                    <button className="btn" onClick={() => { fetchStats(); fetchActiveTrips(); }}>
                        <Icon name="reroute" />Refresh
                    </button>
                )}
            />

            <div className="main-body">
                <div className="grid-4 mb-4">
                    <Stat label="Trips today" value={loading ? '—' : (stats?.trips_today ?? 0).toLocaleString()} />
                    <Stat
                        label="Revenue (EGP)"
                        value={loading ? '—' : revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    />
                    <Stat label="Pending maintenance" value={loading ? '—' : String(stats?.pending_maintenance ?? 0)} />
                    <Stat label="Crowding alerts" value={loading ? '—' : String(stats?.crowding_alerts ?? critical)} />
                </div>

                <div className="grid-3">
                    <div style={{ gridColumn: 'span 2' }}>
                        <Panel
                            title="Live crowding radar"
                            action={<span className="mono text-xs muted">{activeTrips.length} active</span>}
                            flush
                        >
                            {tripsLoading ? (
                                <LoadingState />
                            ) : activeTrips.length === 0 ? (
                                <div style={{ padding: 28 }}><Empty>No active trips right now.</Empty></div>
                            ) : (
                                <div>
                                    {activeTrips.map((trip) => {
                                        const score = Number(trip.crowding_score || 0);
                                        const pct = Math.round(score * 100);
                                        return (
                                            <div
                                                key={trip.id}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderBottom: '1px solid var(--line)',
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <span className="mono text-sm">
                                                        Trip #{trip.trip_number || trip.id}
                                                        {trip.route?.name ? ` · ${trip.route.name}` : ''}
                                                    </span>
                                                    <Tag status={score >= 0.9 ? 'CRIT' : score >= 0.7 ? 'WARN' : 'OK'}>
                                                        {pct}% · {crowdingLabel(score)}
                                                    </Tag>
                                                </div>
                                                <Bar value={score} kind={crowdingKind(score)} />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Panel>
                    </div>

                    <Panel title="Ops signal">
                        <div style={{ display: 'grid', gap: 12 }}>
                            <SignalRow
                                label="Critical crowding"
                                value={critical}
                                kind={critical > 0 ? 'crit' : 'ok'}
                            />
                            <SignalRow
                                label="Pending maintenance"
                                value={stats?.pending_maintenance ?? 0}
                                kind={(stats?.pending_maintenance ?? 0) > 3 ? 'warn' : ''}
                            />
                            <SignalRow
                                label="Active trips"
                                value={activeTrips.length}
                                kind=""
                            />
                            <div className="rule" style={{ margin: '6px 0' }} />
                            <div className="muted text-xs mono" style={{ letterSpacing: '.08em' }}>
                                Updates via WebSocket · last event
                            </div>
                            <div className="text-sm mono">
                                {lastNotification?.type
                                    ? `${lastNotification.type}`
                                    : 'Waiting for events…'}
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>
        </>
    );
};

const SignalRow = ({ label, value, kind }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted text-sm">{label}</span>
        <Tag status={kind === 'crit' ? 'CRIT' : kind === 'warn' ? 'WARN' : 'OK'}>
            {value}
        </Tag>
    </div>
);

export default ManagerDashboard;
