import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Tag, Stat, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

const Tickets = () => {
    const addAlert = useAlertStore((s) => s.addAlert);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await api.get('/admin/tickets/');
                if (!cancelled) setTickets(res.data || []);
            } catch {
                if (!cancelled) addAlert?.({ type: 'ERROR', message: 'Failed to fetch tickets.' });
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
                title="Tickets"
                sub={`${stats.total} issued today · EGP ${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} revenue`}
                actions={(
                    <button className="btn"><Icon name="download" />Export CSV</button>
                )}
            />
            <div className="main-body">
                <div className="grid-4 mb-4">
                    <Stat label="Total tickets" value={loading ? '—' : stats.total.toLocaleString()} />
                    <Stat label="Issued" value={loading ? '—' : stats.issued.toLocaleString()} />
                    <Stat label="Used" value={loading ? '—' : stats.used.toLocaleString()} />
                    <Stat
                        label="Revenue (EGP)"
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
                            placeholder="Search code, passenger, trip"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <div className="field">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="ALL">All statuses</option>
                            <option value="ISSUED">Issued</option>
                            <option value="USED">Used</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="VOIDED">Voided</option>
                            <option value="REFUNDED">Refunded</option>
                        </select>
                    </div>
                    <div className="sep" />
                    <span className="mono text-xs muted">{filtered.length} results</span>
                </Filterbar>

                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No tickets match.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>ID</th>
                                    <th>Code</th>
                                    <th>Passenger</th>
                                    <th className="num">Trip</th>
                                    <th>Seat</th>
                                    <th className="num">Price</th>
                                    <th>Status</th>
                                    <th className="num">Purchased</th>
                                    <th className="num">Validated</th>
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
