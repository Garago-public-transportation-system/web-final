import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Stat, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';
import { useTranslation } from '../../hooks/useTranslation';

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

const buildReportCards = (t) => [
    { key: 'DAILY', icon: 'dashboard', label: t('reports.dailyOps'), desc: t('reports.dailyOpsDesc'), range: 1 },
    { key: 'REVENUE', icon: 'ticket', label: t('reports.revenueBreakdown'), desc: t('reports.revenueBreakdownDesc'), range: 7 },
    { key: 'ROUTE', icon: 'route', label: t('reports.routePerf'), desc: t('reports.routePerfDesc'), range: 14 },
    { key: 'SHIFT', icon: 'schedule', label: t('reports.shiftPerf'), desc: t('reports.shiftPerfDesc'), range: 14 },
    { key: 'MAINTENANCE', icon: 'wrench', label: t('reports.maintLog'), desc: t('reports.maintLogDesc'), range: 30 },
    { key: 'AUDIT', icon: 'audit', label: t('reports.auditAct'), desc: t('reports.auditActDesc'), range: 30 },
];

const AdminReports = () => {
    const { t } = useTranslation();
    const REPORT_CARDS = useMemo(() => buildReportCards(t), [t]);
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
            addAlert?.({ type: 'WARN', message: t('reports.dateOrderError') });
            return;
        }
        setLoading(true);
        setBreakdown(null);
        try {
            const res = await api.get('/admin/reports/breakdown', { params: { start: s, end: e } });
            setBreakdown(res.data);
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || t('reports.failedLoad') });
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, addAlert, t]);

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
            addAlert?.({ type: 'INFO', message: t('reports.maintNote') });
        } else if (card.key === 'AUDIT') {
            addAlert?.({ type: 'INFO', message: t('reports.auditNote') });
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
            addAlert?.({ type: 'OK', message: t('reports.exportOk', { f: format.toUpperCase() }) });
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
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || t('reports.exportFailed') });
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
                title={t('sidebar.reports')}
                sub={breakdown ? `${startDate} → ${endDate}` : t('reports.subTitle.pick')}
                actions={breakdown ? (
                    <>
                        <button className="btn" onClick={() => exportAs('csv')} disabled={!!exporting}>
                            <Icon name="download" />{exporting === 'csv' ? t('shell.exporting') : t('shell.exportCsv')}
                        </button>
                        <button className="btn" onClick={() => exportAs('pdf')} disabled={!!exporting}>
                            <Icon name="download" />{exporting === 'pdf' ? t('shell.exporting') : t('shell.exportPdf')}
                        </button>
                    </>
                ) : null}
            />

            <div className="main-body">
                <Panel
                    title={t('reports.library')}
                    action={<span className="mono text-xs muted">{t('reports.templates', { n: REPORT_CARDS.length })}</span>}
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
                                    {t('reports.last', { n: c.range })}
                                </div>
                            </button>
                        ))}
                    </div>
                </Panel>

                <div style={{ height: 16 }} />

                <Filterbar>
                    <div className="field">
                        <label className="muted text-xs mono" style={{ marginRight: 6 }}>{t('shell.start')}</label>
                        <input type="date" value={startDate} max={endDate || today} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="field">
                        <label className="muted text-xs mono" style={{ marginRight: 6 }}>{t('shell.end')}</label>
                        <input type="date" value={endDate} min={startDate} max={today} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <button className="btn primary" onClick={() => generate()} disabled={loading}>
                        <Icon name="search" />{loading ? t('shell.working') : t('reports.generate')}
                    </button>
                    <div className="sep" />
                    {breakdown ? (
                        <span className="mono text-xs muted">{t('reports.routesAndShifts', { r: routeTotals.length, s: shiftTotals.length })}</span>
                    ) : null}
                </Filterbar>

                {loading ? (
                    <Panel><LoadingState /></Panel>
                ) : !breakdown ? (
                    <Panel>
                        <div style={{ padding: 28 }}>
                            <Empty>{t('reports.pickEmpty')}</Empty>
                        </div>
                    </Panel>
                ) : (
                    <>
                        <div className="grid-4 mb-4">
                            <Stat label={t('reports.totalRevenue')} value={revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                            <Stat label={t('reports.totalTrips')} value={trips.toLocaleString()} />
                            <Stat label={t('reports.routesCovered')} value={String(routeTotals.length)} />
                            <Stat
                                label={t('reports.avgPerTrip')}
                                value={trips > 0 ? (revenue / trips).toFixed(2) : '—'}
                            />
                        </div>

                        <Filterbar>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    className={`btn ${tab === 'ROUTE' ? 'primary' : ''}`}
                                    onClick={() => setTab('ROUTE')}
                                >
                                    {t('reports.byRoute')}
                                </button>
                                <button
                                    className={`btn ${tab === 'SHIFT' ? 'primary' : ''}`}
                                    onClick={() => setTab('SHIFT')}
                                >
                                    {t('reports.byShift')}
                                </button>
                            </div>
                        </Filterbar>

                        <Panel flush>
                            {tab === 'ROUTE' ? (
                                <RouteTable rows={routeTotals} t={t} />
                            ) : (
                                <ShiftTable rows={shiftTotals} t={t} />
                            )}
                        </Panel>
                    </>
                )}

                <div style={{ height: 16 }} />

                <Panel
                    title={t('reports.recentExports')}
                    action={
                        history.length > 0 ? (
                            <button className="btn ghost" onClick={() => setHistory([])}>
                                <Icon name="x" />{t('reports.clear')}
                            </button>
                        ) : (
                            <span className="mono text-xs muted">{history.length}</span>
                        )
                    }
                    flush
                >
                    {history.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>{t('reports.noExports')}</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th>{t('reports.kind')}</th>
                                    <th>{t('reports.range')}</th>
                                    <th>{t('reports.format')}</th>
                                    <th>{t('reports.exported')}</th>
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

const RouteTable = ({ rows, t }) => {
    if (!rows.length) return <div style={{ padding: 28 }}><Empty>{t('reports.noData')}</Empty></div>;
    const totalTrips = rows.reduce((s, r) => s + (r.trip_count || 0), 0);
    const totalRev = rows.reduce((s, r) => s + (r.total_revenue || 0), 0);
    return (
        <table className="tbl">
            <thead>
                <tr>
                    <th>{t('rotations.route')}</th>
                    <th className="num">{t('reports.tripCount')}</th>
                    <th className="num">{t('tickets.revenue')}</th>
                    <th className="num">{t('reports.avgPerTrip')}</th>
                    <th className="num">{t('reports.onTime')}</th>
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
                    <td><strong>{t('reports.total')}</strong></td>
                    <td className="num mono text-xs"><strong>{totalTrips}</strong></td>
                    <td className="num mono"><strong>{totalRev.toFixed(2)}</strong></td>
                    <td className="num mono text-xs muted">—</td>
                    <td className="num mono text-xs muted">—</td>
                </tr>
            </tbody>
        </table>
    );
};

const ShiftTable = ({ rows, t }) => {
    if (!rows.length) return <div style={{ padding: 28 }}><Empty>{t('reports.noData')}</Empty></div>;
    return (
        <table className="tbl">
            <thead>
                <tr>
                    <th>{t('reports.shift')}</th>
                    <th className="num">{t('reports.tripCount')}</th>
                    <th className="num">{t('tickets.revenue')}</th>
                    <th className="num">{t('reports.avgPerTrip')}</th>
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
