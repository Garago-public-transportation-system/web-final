import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useAlertStore } from '../../store/alertStore';
import { PageHeader, Panel, Tag, Bar, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';

const COLORS = { green: '#15803d', yellow: '#a16207', red: '#b91c1c' };

const vehicleColor = (v) => {
    if (v.status === 'MAINTENANCE') return 'red';
    const c = Number(v.crowding_score || 0);
    if (c >= 0.9) return 'red';
    if (c >= 0.7) return 'yellow';
    return 'green';
};

const Fleet = () => {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const alerts = useAlertStore((s) => s.alerts);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/manager/vehicles');
                if (!cancelled) setVehicles(res.data || []);
            } catch {
                if (!cancelled) setVehicles([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const gateLogs = useMemo(() => (
        (alerts || [])
            .filter((a) => a.type === 'gate_auth')
            .map((a) => ({
                ...a,
                time: a.timestamp ? new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
            }))
    ), [alerts]);

    return (
        <>
            <PageHeader
                title="Fleet & gate monitoring"
                sub={`${vehicles.length} vehicles`}
            />

            <div className="main-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
                    <Panel
                        title="Fleet"
                        action={<span className="mono text-xs muted">{vehicles.length}</span>}
                        flush
                    >
                        {loading ? (
                            <LoadingState />
                        ) : vehicles.length === 0 ? (
                            <div style={{ padding: 28 }}><Empty>No vehicles.</Empty></div>
                        ) : (
                            <div style={{ maxHeight: 620, overflow: 'auto' }}>
                                {vehicles.map((v) => (
                                    <BusCard
                                        key={v.id}
                                        v={v}
                                        selected={v.id === selectedId}
                                        onSelect={() => setSelectedId(v.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </Panel>

                    <Panel
                        title="Live gate activity"
                        action={<PulseDot />}
                        flush
                    >
                        {gateLogs.length === 0 ? (
                            <div style={{ padding: 28 }}><Empty>Waiting for ANPR events.</Empty></div>
                        ) : (
                            <div style={{ maxHeight: 620, overflow: 'auto' }}>
                                {gateLogs.map((log) => (
                                    <GateRow key={log.id} log={log} />
                                ))}
                            </div>
                        )}
                    </Panel>
                </div>

                <div style={{ height: 16 }} />

                <Panel title="Fleet roster" flush>
                    {loading ? (
                        <LoadingState />
                    ) : vehicles.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No vehicles.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>ID</th>
                                    <th>Plate</th>
                                    <th>Model</th>
                                    <th>Status</th>
                                    <th className="num">Crowding</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehicles.map((v) => (
                                    <tr
                                        key={v.id}
                                        onClick={() => setSelectedId(v.id)}
                                        style={{
                                            cursor: 'pointer',
                                            background: v.id === selectedId ? 'var(--line-softer)' : 'transparent',
                                        }}
                                    >
                                        <td className="mono text-sm">{v.id}</td>
                                        <td className="mono text-sm">{v.plate_number}</td>
                                        <td>{v.model}</td>
                                        <td><Tag status={v.status === 'EN_ROUTE' ? 'ON_TRIP' : v.status || 'FREE'} /></td>
                                        <td className="num mono text-xs">
                                            {v.crowding_score != null ? `${Math.round(v.crowding_score * 100)}%` : '—'}
                                        </td>
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

const BusCard = ({ v, selected, onSelect }) => {
    const load = Number(v.crowding_score || 0);
    const loadPct = Math.round(load * 100);
    const color = vehicleColor(v);
    const pinColor = COLORS[color];

    return (
        <button
            type="button"
            onClick={onSelect}
            className="reset"
            style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderBottom: '1px solid var(--line)',
                borderLeft: selected ? '3px solid var(--ink)' : '3px solid transparent',
                background: selected ? 'var(--line-softer)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 120ms ease',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                    <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: pinColor, flexShrink: 0,
                    }} />
                    <strong className="mono text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.plate_number}
                    </strong>
                </div>
                <Tag status={v.status === 'EN_ROUTE' ? 'ON_TRIP' : v.status || 'FREE'} />
            </div>

            <div className="text-xs muted" style={{ marginTop: 2 }}>{v.model || '—'}</div>

            <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="mono text-xs muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>
                            Load
                        </span>
                        <span className="mono text-xs">{loadPct}%</span>
                    </div>
                    <Bar value={load} />
                </div>
            </div>
        </button>
    );
};

const PulseDot = () => (
    <span
        style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--crit)',
            display: 'inline-block',
            boxShadow: '0 0 0 0 color-mix(in oklab, var(--crit) 50%, transparent)',
            animation: 'garago-pulse 1.5s infinite',
        }}
    />
);

const GateRow = ({ log }) => {
    const isGranted = log.event === 'GATE_AUTH_GRANTED';
    const isUnauthorized = log.event === 'UNAUTHORIZED_VEHICLE';
    const iconName = isGranted ? 'check' : isUnauthorized ? 'x' : 'alert';
    const color = isGranted ? 'var(--ok)' : isUnauthorized ? 'var(--crit)' : 'var(--warn)';
    return (
        <div
            style={{
                display: 'flex',
                gap: 10,
                padding: '10px 14px',
                borderBottom: '1px solid var(--line)',
                alignItems: 'flex-start',
            }}
        >
            <span style={{ color }}><Icon name={iconName} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span className="mono text-sm">{log.plate_number || '—'}</span>
                    <span className="mono text-xs muted">{log.time}</span>
                </div>
                <div className="text-xs" style={{ color, marginTop: 2 }}>
                    {log.message || log.event || 'Unknown event'}
                </div>
            </div>
        </div>
    );
};

export default Fleet;
