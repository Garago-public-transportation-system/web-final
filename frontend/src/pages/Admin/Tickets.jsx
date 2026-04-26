import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Tag, Stat, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';
import { useTranslation } from '../../hooks/useTranslation';

const Tickets = () => {
    const { t } = useTranslation();
    const addAlert = useAlertStore((s) => s.addAlert);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [exporting, setExporting] = useState(null);

    const exportAs = async (format) => {
        setExporting(format);
        try {
            const res = await api.get('/admin/tickets/export', {
                params: { format, status_filter: statusFilter },
                responseType: 'blob',
            });
            const mime = format === 'pdf' ? 'application/pdf' : 'text/csv';
            const ext = format === 'pdf' ? 'pdf' : 'csv';
            const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
            const link = document.createElement('a');
            const stamp = new Date().toISOString().split('T')[0];
            link.href = url;
            link.download = `tickets_${statusFilter}_${stamp}.${ext}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            addAlert?.({ type: 'OK', message: t('tickets.exportOk', { f: format.toUpperCase() }) });
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || t('tickets.exportFail') });
        } finally {
            setExporting(null);
        }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await api.get('/admin/tickets/');
                if (!cancelled) setTickets(res.data || []);
            } catch {
                if (!cancelled) addAlert?.({ type: 'ERROR', message: t('tickets.failedFetch') });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [addAlert]);

    const stats = useMemo(() => {
        const total = tickets.length;
        const revenue = tickets.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
        const issued = tickets.filter((t) => t.status === 'ISSUED').length;
        const used = tickets.filter((t) => t.status === 'USED').length;
        return { total, revenue, issued, used };
    }, [tickets]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return tickets.filter((t) => {
            if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
            if (!q) return true;
            return (
                String(t.ticket_code || '').toLowerCase().includes(q) ||
                String(t.passenger_name || '').toLowerCase().includes(q) ||
                String(t.id).includes(q) ||
                String(t.trip_id || '').includes(q)
            );
        });
    }, [tickets, query, statusFilter]);

    return (
        <>
            <PageHeader
                title={t('sidebar.tickets')}
                sub={t('tickets.subTitle', {
                    n: stats.total,
                    rev: stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                })}
                actions={(
                    <>
                        <button
                            className="btn"
                            onClick={() => exportAs('csv')}
                            disabled={!!exporting || tickets.length === 0}
                        >
                            <Icon name="download" />{exporting === 'csv' ? t('shell.exporting') : t('shell.exportCsv')}
                        </button>
                        <button
                            className="btn"
                            onClick={() => exportAs('pdf')}
                            disabled={!!exporting || tickets.length === 0}
                        >
                            <Icon name="download" />{exporting === 'pdf' ? t('shell.exporting') : t('shell.exportPdf')}
                        </button>
                    </>
                )}
            />
            <div className="main-body">
                <div className="grid-4 mb-4">
                    <Stat label={t('tickets.totalTickets')} value={loading ? '—' : stats.total.toLocaleString()} />
                    <Stat label={t('tickets.issued')} value={loading ? '—' : stats.issued.toLocaleString()} />
                    <Stat label={t('tickets.used')} value={loading ? '—' : stats.used.toLocaleString()} />
                    <Stat
                        label={t('tickets.revenue')}
                        value={loading ? '—' : stats.revenue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    />
                </div>

                <Filterbar>
                    <div className="field" style={{ minWidth: 260 }}>
                        <Icon name="search" />
                        <input
                            placeholder={t('tickets.searchPh')}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <div className="field">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="ALL">{t('shell.allStatuses')}</option>
                            <option value="ISSUED">{t('tickets.issued')}</option>
                            <option value="USED">{t('tickets.used')}</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="VOIDED">Voided</option>
                            <option value="REFUNDED">Refunded</option>
                        </select>
                    </div>
                    <div className="sep" />
                    <span className="mono text-xs muted">{filtered.length} {t('shell.results')}</span>
                </Filterbar>

                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>{t('tickets.noMatch')}</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>{t('common.id')}</th>
                                    <th>{t('tickets.code')}</th>
                                    <th>{t('tickets.passenger')}</th>
                                    <th className="num">{t('tickets.trip')}</th>
                                    <th>{t('tickets.seat')}</th>
                                    <th className="num">{t('tickets.price')}</th>
                                    <th>{t('common.status')}</th>
                                    <th className="num">{t('tickets.purchased')}</th>
                                    <th className="num">{t('tickets.validated')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((t) => (
                                    <tr key={t.id}>
                                        <td className="mono text-sm">{t.id}</td>
                                        <td className="mono text-sm">{t.ticket_code}</td>
                                        <td>{t.passenger_name || '—'}</td>
                                        <td className="num mono text-xs">{t.trip_id}</td>
                                        <td className="mono text-xs">{t.seat_number || '—'}</td>
                                        <td className="num mono">{Number(t.price || 0).toFixed(2)}</td>
                                        <td><Tag status={t.status || 'ISSUED'} /></td>
                                        <td className="num mono text-xs muted">
                                            {t.purchase_time
                                                ? new Date(t.purchase_time).toLocaleString('en-GB', {
                                                      day: '2-digit',
                                                      month: 'short',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                  })
                                                : '—'}
                                        </td>
                                        <td className="num mono text-xs muted">
                                            {t.validation_time
                                                ? new Date(t.validation_time).toLocaleString('en-GB', {
                                                      day: '2-digit',
                                                      month: 'short',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                  })
                                                : '—'}
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

export default Tickets;
