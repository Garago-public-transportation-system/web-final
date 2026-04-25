import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Stat, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

const today = new Date().toISOString().split('T')[0];
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const EXPORTS_KEY = 'garago.report_exports';
const loadHistory = () => {
    try {
        const raw = localStorage.getItem(EXPORTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
    } catch {
        return [];
    }
};

const REPORT_CARDS = [
    {
        key: 'DAILY',
        icon: 'dashboard',
        label: 'Daily operations',
        desc: 'Trips, revenue, crowding — last 24h snapshot.',
        range: 1,
    },
    {
        key: 'REVENUE',
        icon: 'ticket',
        label: 'Revenue breakdown',
        desc: 'Route × shift × payment status.',
        range: 7,
    },
    {
        key: 'ROUTE',
        icon: 'route',
        label: 'Route performance',
        desc: 'Trip count, on-time %, average revenue per route.',
        range: 14,
    },
    {
        key: 'SHIFT',
        icon: 'schedule',
        label: 'Shift performance',
        desc: 'Morning vs. evening yield and occupancy.',
        range: 14,
    },
    {
        key: 'MAINTENANCE',
        icon: 'wrench',
        label: 'Maintenance log',
        desc: 'Vehicle downtime, work orders, cost by month.',
        range: 30,
    },
    {
        key: 'AUDIT',
        icon: 'audit',
        label: 'Audit activity',
        desc: 'Admin and manager actions across the system.',
        range: 30,
    },
];

const AdminReports = () => {
    const addAlert = useAlertStore((s) => s.addAlert);
    const [startDate, setStartDate] = useState(sevenDaysAgo);
    const [endDate, setEndDate] = useState(today);
    const [breakdown, setBreakdown] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(null);
    const [tab, setTab] = useState('ROUTE');
    const [history, setHistory] = useState(loadHistory);

    useEffect(() => {
        try {
            localStorage.setItem(EXPORTS_KEY, JSON.stringify(history.slice(0, 20)));
        } catch {
            /* storage full or blocked */
        }
    }, [history]);

    const generate = useCallback(async (overrideStart, overrideEnd) => {
        const s = overrideStart || startDate;
        const e = overrideEnd || endDate;
        if (!s || !e) return;
        if (s > e) {
            addAlert?.({ type: 'WARN', message: 'Start date must be before end date.' });
            return;
        }
        setLoading(true);
        setBreakdown(null);
        try {
            const res = await api.get('/admin/reports/breakdown', { params: { start: s, end: e } });
            setBreakdown(res.data);
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Failed to load report.' });
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, addAlert]);

    const pickCard = (card) => {
        const end = today;
        const start = new Date(Date.now() - card.range * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        if (card.key === 'ROUTE' || card.key === 'SHIFT' || card.key === 'REVENUE') {
            setTab(card.key === 'SHIFT' ? 'SHIFT' : 'ROUTE');
            generate(start, end);
        } else if (card.key === 'DAILY') {
            setTab('ROUTE');
            generate(start, end);
        } else if (card.key === 'MAINTENANCE') {
            addAlert?.({ type: 'INFO', message: 'Maintenance report uses the Maintenance page exports.' });
        } else if (card.key === 'AUDIT') {
            addAlert?.({ type: 'INFO', message: 'Audit log export is available on the Audit logs page.' });
        }
    };

    const exportAs = async (format) => {
        setExporting(format);
        try {
            const res = await api.get('/admin/reports/export', {
                params: { format, start: startDate, end: endDate },
                responseType: 'blob',
            });
            const mime = format === 'pdf' ? 'application/pdf' : 'text/csv';
            const ext = format === 'pdf' ? 'pdf' : 'csv';
            const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `report_${startDate}_to_${endDate}.${ext}`;
            link.click();
            window.URL.revokeObjectURL(url);
            addAlert?.({ type: 'OK', message: `${format.toUpperCase()} exported.` });
            setHistory((prev) => [
                {
                    id: `${Date.now()}`,
                    format: format.toUpperCase(),
                    start: startDate,
                    end: endDate,
                    exported_at: new Date().toISOString(),
                    kind: tab,
                },
                ...prev,
            ].slice(0, 20));
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Export failed.' });
        } finally {
            setExporting(null);
        }
    };

    const routeTotals = breakdown?.by_route || [];
    const shiftTotals = breakdown?.by_shift || [];

    const { revenue, trips } = useMemo(() => {
        const rev = routeTotals.reduce((s, r) => s + (r.total_revenue || 0), 0);
        const tr = routeTotals.reduce((s, r) => s + (r.trip_count || 0), 0);
        return { revenue: rev, trips: tr };
    }, [routeTotals]);

    return (
        <>
            <PageHeader
                title="Reports"
                sub={breakdown ? `${startDate} → ${endDate}` : 'Pick a report to run'}
                actions={breakdown ? (
                    <>
                        <button className="btn" onClick={() => exportAs('csv')} disabled={!!exporting}>
                            <Icon name="download" />{exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
                        </button>
                        <button className="btn" onClick={() => exportAs('pdf')} disabled={!!exporting}>
                            <Icon name="download" />{exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
                        </button>
                    </>
                ) : null}
            />

            <div className="main-body">
                <Panel
                    title="Report library"
                    action={<span className="mono text-xs muted">{REPORT_CARDS.length} templates</span>}
                >
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 10,
                    }}>
                        {REPORT_CARDS.map((c) => (
                            <button
                                key={c.key}
                                className="reset"
                                onClick={() => pickCard(c)}
                                style={{
                                    textAlign: 'left',
                                    padding: 14,
                                    border: '1px solid var(--line)',
                                    background: 'var(--bg)',
                                    display: 'grid',
                                    gap: 6,
                                    cursor: 'pointer',
                                    transition: 'border-color 120ms ease, transform 120ms ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--ink)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--line)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Icon name={c.icon} />
                                    <strong style={{ fontSize: 13 }}>{c.label}</strong>
                                </div>
                                <div className="text-xs muted" style={{ lineHeight: 1.4 }}>{c.desc}</div>
                                <div
                                    className="mono text-xs"
                                    style={{
                                        marginTop: 4,
                                        textTransform: 'uppercase',
                                        letterSpacing: '.08em',
                                        color: 'var(--ink-3)',
                                    }}
                                >
                                    Last {c.range}d
                                </div>
                            </button>
                        ))}
                    </div>
                </Panel>

                <div style={{ height: 16 }} />

                <Filterbar>
                    <div className="field">
                        <label className="muted text-xs mono" style={{ marginRight: 6 }}>Start</label>
                        <input type="date" value={startDate} max={endDate || today} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="field">
                        <label className="muted text-xs mono" style={{ marginRight: 6 }}>End</label>
                        <input type="date" value={endDate} min={startDate} max={today} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <button className="btn primary" onClick={() => generate()} disabled={loading}>
                        <Icon name="search" />{loading ? 'Generating…' : 'Generate'}
                    </button>
                    <div className="sep" />
                    {breakdown ? (
                        <span className="mono text-xs muted">{routeTotals.length} routes · {shiftTotals.length} shifts</span>
                    ) : null}
                </Filterbar>

                {loading ? (
                    <Panel><LoadingState /></Panel>
                ) : !breakdown ? (
                    <Panel>
                        <div style={{ padding: 28 }}>
                            <Empty>Pick a report template above or set a date range and generate.</Empty>
                        </div>
                    </Panel>
                ) : (
                    <>
                        <div className="grid-4 mb-4">
                            <Stat label="Total revenue (EGP)" value={revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                            <Stat label="Total trips" value={trips.toLocaleString()} />
                            <Stat label="Routes covered" value={String(routeTotals.length)} />
                            <Stat
                                label="Avg per trip"
                                value={trips > 0 ? (revenue / trips).toFixed(2) : '—'}
                            />
                        </div>

                        <Filterbar>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    className={`btn ${tab === 'ROUTE' ? 'primary' : ''}`}
                                    onClick={() => setTab('ROUTE')}
                                >
                                    By route
                                </button>
                                <button
                                    className={`btn ${tab === 'SHIFT' ? 'primary' : ''}`}
                                    onClick={() => setTab('SHIFT')}
                                >
                                    By shift
                                </button>
                            </div>
                        </Filterbar>

                        <Panel flush>
                            {tab === 'ROUTE' ? (
                                <RouteTable rows={routeTotals} />
                            ) : (
                                <ShiftTable rows={shiftTotals} />
                            )}
                        </Panel>
                    </>
                )}

                <div style={{ height: 16 }} />

                <Panel
                    title="Recent exports"
                    action={
                        history.length > 0 ? (
                            <button className="btn ghost" onClick={() => setHistory([])}>
                                <Icon name="x" />Clear
                            </button>
                        ) : (
                            <span className="mono text-xs muted">{history.length}</span>
                        )
                    }
                    flush
                >
                    {history.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No exports yet.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th>Kind</th>
                                    <th>Range</th>
                                    <th>Format</th>
                                    <th>Exported</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.id}>
                                        <td className="mono text-xs" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                            {h.kind || 'ROUTE'}
                                        </td>
                                        <td className="mono text-xs">{h.start} → {h.end}</td>
                                        <td>
                                            <span className="mono text-xs" style={{
                                                padding: '2px 6px',
                                                border: '1px solid var(--line)',
                                                letterSpacing: '.06em',
                                            }}>
                                                {h.format}
                                            </span>
                                        </td>
                                        <td className="mono text-xs muted">
                                            {new Date(h.exported_at).toLocaleString('en-GB', {
                                                day: '2-digit', month: 'short',
                                                hour: '2-digit', minute: '2-digit',
                                            })}
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

const RouteTable = ({ rows }) => {
    if (!rows.length) return <div style={{ padding: 28 }}><Empty>No route data.</Empty></div>;
    const totalTrips = rows.reduce((s, r) => s + (r.trip_count || 0), 0);
    const totalRev = rows.reduce((s, r) => s + (r.total_revenue || 0), 0);
    return (
        <table className="tbl">
            <thead>
                <tr>
                    <th>Route</th>
                    <th className="num">Trips</th>
                    <th className="num">Revenue (EGP)</th>
                    <th className="num">Avg / trip</th>
                    <th className="num">On-time</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((r, i) => (
                    <tr key={i}>
                        <td>{r.route_name || `Route #${r.route_id}`}</td>
                        <td className="num mono text-xs">{r.trip_count ?? 0}</td>
                        <td className="num mono">{(r.total_revenue ?? 0).toFixed(2)}</td>
                        <td className="num mono text-xs muted">
                            {r.trip_count > 0 ? ((r.total_revenue ?? 0) / r.trip_count).toFixed(2) : '—'}
                        </td>
                        <td className="num mono text-xs muted">
                            {r.on_time_percentage != null ? `${r.on_time_percentage.toFixed(1)}%` : '—'}
                        </td>
                    </tr>
                ))}
                <tr style={{ borderTop: '1px solid var(--line)' }}>
                    <td><strong>Total</strong></td>
                    <td className="num mono text-xs"><strong>{totalTrips}</strong></td>
                    <td className="num mono"><strong>{totalRev.toFixed(2)}</strong></td>
                    <td className="num mono text-xs muted">—</td>
                    <td className="num mono text-xs muted">—</td>
                </tr>
            </tbody>
        </table>
    );
};

const ShiftTable = ({ rows }) => {
    if (!rows.length) return <div style={{ padding: 28 }}><Empty>No shift data.</Empty></div>;
    return (
        <table className="tbl">
            <thead>
                <tr>
                    <th>Shift</th>
                    <th className="num">Trips</th>
                    <th className="num">Revenue (EGP)</th>
                    <th className="num">Avg / trip</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((r, i) => (
                    <tr key={i}>
                        <td className="mono text-xs">{r.shift_type}</td>
                        <td className="num mono text-xs">{r.trip_count ?? 0}</td>
                        <td className="num mono">{(r.total_revenue ?? 0).toFixed(2)}</td>
                        <td className="num mono text-xs muted">
                            {r.trip_count > 0 ? ((r.total_revenue ?? 0) / r.trip_count).toFixed(2) : '—'}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default AdminReports;
