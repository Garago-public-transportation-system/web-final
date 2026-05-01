import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Panel, Tag, Stat, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

const TripDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const addAlert = useAlertStore((s) => s.addAlert);
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);
    const pollRef = useRef(null);

    const fetchTrip = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const url = user?.role === 'ADMIN' ? `/admin/trips/${id}` : `/drivers/me/trips/${id}`;
            const res = await api.get(url);
            setTrip(res.data);
        } catch {
            if (!silent) addAlert?.({ type: 'ERROR', message: 'Failed to fetch trip.' });
        } finally {
            if (!silent) setLoading(false);
        }
    }, [id, user, addAlert]);

    useEffect(() => {
        if (!user) return;
        fetchTrip();
        // Poll every 5 s so occupancy and tickets stay live
        pollRef.current = setInterval(() => fetchTrip(true), 5000);
        return () => clearInterval(pollRef.current);
    }, [user, fetchTrip]);



    const { origin, destination, capacity, sold, occupancy } = useMemo(() => {
        if (!trip) return { origin: '—', destination: '—', capacity: 0, sold: 0, occupancy: 0 };
        const isOutbound = trip.direction === 'OUTBOUND';
        const o = isOutbound ? trip.route?.start_location : trip.route?.end_location;
        const d = isOutbound ? trip.route?.end_location : trip.route?.start_location;
        const cap = trip.vehicle?.capacity || 50;
        // Use passenger_count (updated by camera) as the primary source; fall back to ticket count
        const s = trip.passenger_count ?? trip.tickets?.length ?? 0;
        return {
            origin: o || '—',
            destination: d || '—',
            capacity: cap,
            sold: s,
            occupancy: cap ? Math.round((s / cap) * 100) : 0,
        };
    }, [trip]);

    const orderedStops = useMemo(() => {
        if (!trip?.route_stops) return [];
        const stops = [...trip.route_stops].sort((a, b) => a.sequence_order - b.sequence_order);
        return trip.direction === 'INBOUND' ? stops.reverse() : stops;
    }, [trip]);

    if (loading) {
        return (
            <>
                <PageHeader title="Trip" />
                <div className="main-body"><Panel><LoadingState /></Panel></div>
            </>
        );
    }

    if (!trip) {
        return (
            <>
                <PageHeader title="Trip not found" />
                <div className="main-body"><Panel><Empty>Trip does not exist.</Empty></Panel></div>
            </>
        );
    }

    return (
        <>
            <PageHeader
                title={`Trip #${trip.trip_number}`}
                sub={`${trip.route?.name || 'Route'} · ${trip.direction}`}
                actions={(
                    <>
                        <button className="btn" onClick={() => navigate(-1)}>
                            <Icon name="arrow-left" />Back
                        </button>
                        <Tag status={trip.status || 'SCHEDULED'} />
                        {(trip.is_late || trip.is_late_now) && (
                            <span className="tag crit" style={{ animation: 'pulse 2s infinite', fontWeight: 700 }}>
                                <span className="dot" />LATE
                            </span>
                        )}
                    </>
                )}
            />

            <div className="main-body">
                <div className="grid-4 mb-4">
                    <Stat label="Seats sold" value={`${sold}/${capacity}`} />
                    <Stat label="Occupancy" value={`${occupancy}%`} />
                    <Stat
                        label="Start"
                        value={trip.scheduled_start
                            ? new Date(trip.scheduled_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                    />
                    <Stat
                        label="End"
                        value={trip.scheduled_end
                            ? new Date(trip.scheduled_end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
                    <div style={{ display: 'grid', gap: 16 }}>
                        <Panel title="Route" action={<span className="mono text-xs muted">{trip.direction}</span>}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <div className="text-xs muted mono" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>
                                        Departure
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{origin}</div>
                                </div>
                                <Icon name="arrow-right" />
                                <div style={{ flex: 1, textAlign: 'right' }}>
                                    <div className="text-xs muted mono" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>
                                        Arrival
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{destination}</div>
                                </div>
                            </div>
                            <div className="rule" style={{ margin: '14px 0' }} />
                            <div className="muted text-sm">
                                {trip.route?.distance_km ? `${trip.route.distance_km} km · ` : ''}
                                {trip.route?.estimated_time_minutes
                                    ? `${trip.route.estimated_time_minutes} min est.`
                                    : ''}
                            </div>
                        </Panel>

                        <Panel title="Assignment">
                            <div style={{ display: 'grid', gap: 12 }}>
                                <Row label="Driver" value={trip.driver?.full_name || 'Unassigned'} />
                                <Row label="Vehicle" value={trip.vehicle?.plate_number || '—'} mono />
                                <Row label="Model" value={trip.vehicle?.model || '—'} />
                                <Row label="Capacity" value={String(trip.vehicle?.capacity || '—')} mono />
                            </div>
                        </Panel>
                    </div>

                    <Panel title="Stops" action={<span className="mono text-xs muted">{orderedStops.length}</span>}>
                        {orderedStops.length === 0 ? (
                            <Empty>No stops configured.</Empty>
                        ) : (
                            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 0 }}>
                                {orderedStops.map((s, i) => {
                                    const isFirst = i === 0;
                                    const isLast = i === orderedStops.length - 1;
                                    return (
                                        <li key={s.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 10 }}>
                                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{
                                                    width: 10, height: 10, borderRadius: '50%',
                                                    background: isFirst || isLast ? 'var(--ink)' : 'var(--bg)',
                                                    border: '2px solid var(--ink)',
                                                    marginTop: 4,
                                                }} />
                                                {!isLast && (
                                                    <div style={{ flex: 1, width: 2, background: 'var(--line)', marginTop: 2 }} />
                                                )}
                                            </div>
                                            <div style={{ paddingBottom: isLast ? 0 : 18 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                                                    {s.stop_name}
                                                </div>
                                                <div className="mono text-xs muted" style={{ marginTop: 2 }}>
                                                    #{String(s.sequence_order).padStart(2, '0')} · {s.dwell_time_minutes}m dwell
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </Panel>
                </div>

                <div style={{ height: 16 }} />

                <Panel
                    title="Passenger manifest"
                    action={
                        <span className="mono text-xs muted">{trip.tickets?.length || 0} issued</span>
                    }
                    flush
                >
                    {!trip.tickets || trip.tickets.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No tickets issued yet.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 50 }}>#</th>
                                    <th style={{ width: 70 }}>DB ID</th>
                                    <th>Code</th>
                                    <th>Passenger</th>
                                    <th>Seat</th>
                                    <th className="num">Price</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trip.tickets.map((t, idx) => (
                                    <tr key={t.id}>
                                        <td className="mono text-sm">{idx + 1}</td>
                                        <td className="mono text-xs muted">{t.id}</td>
                                        <td className="mono text-sm">{t.ticket_code}</td>
                                        <td>{t.passenger_name || t.passenger || '—'}</td>
                                        <td className="mono text-xs">{t.seat_number || t.seat || '—'}</td>
                                        <td className="num mono">{Number(t.price || 0).toFixed(2)}</td>
                                        <td><Tag status={t.status || 'ISSUED'} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Panel>
            </div>

        </>
    );
};

const Row = ({ label, value, mono }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span className="muted text-sm">{label}</span>
        <span className={mono ? 'mono text-sm' : 'text-sm'} style={{ fontWeight: 600 }}>{value}</span>
    </div>
);

export default TripDetails;
