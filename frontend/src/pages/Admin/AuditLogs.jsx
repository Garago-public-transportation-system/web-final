import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/admin/audit-logs');
                if (!cancelled) setLogs(res.data || []);
            } catch {
                if (!cancelled) setLogs([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return logs;
        return logs.filter(
            (l) =>
                String(l.action || '').toLowerCase().includes(q) ||
                String(l.entity_type || '').toLowerCase().includes(q) ||
                String(l.user_id || '').toLowerCase().includes(q) ||
                String(l.id).includes(q),
        );
    }, [logs, query]);

    return (
        <>
            <PageHeader title="Audit logs" sub={`${logs.length} events`} />
            <Filterbar>
                <div className="field" style={{ minWidth: 260 }}>
                    <Icon name="search" />
                    <input
                        placeholder="Search by action, entity, user"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="sep" />
                <span className="mono text-xs muted">{filtered.length} results</span>
            </Filterbar>

            <div className="main-body">
                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No audit events.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>ID</th>
                                    <th>Action</th>
                                    <th>Entity</th>
                                    <th className="num">Entity ID</th>
                                    <th className="num">User ID</th>
                                    <th>Changes</th>
                                    <th className="num">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((l) => (
                                    <tr key={l.id}>
                                        <td className="mono text-sm">{l.id}</td>
                                        <td className="mono text-xs">{l.action}</td>
                                        <td className="text-sm">{l.entity_type}</td>
                                        <td className="num mono text-xs">{l.entity_id ?? '—'}</td>
                                        <td className="num mono text-xs">{l.user_id ?? '—'}</td>
                                        <td className="mono text-xs muted" style={{ maxWidth: 320 }}>
                                            {l.new_values
                                                ? JSON.stringify(l.new_values).slice(0, 80) +
                                                  (JSON.stringify(l.new_values).length > 80 ? '…' : '')
                                                : '—'}
                                        </td>
                                        <td className="num mono text-xs muted">
                                            {l.created_at
                                                ? new Date(l.created_at).toLocaleString('en-GB', {
                                                      day: '2-digit',
                                                      month: 'short',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                      second: '2-digit',
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

export default AuditLogs;
