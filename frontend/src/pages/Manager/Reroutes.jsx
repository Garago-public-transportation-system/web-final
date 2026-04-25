import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Stat, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

const TABS = [
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'ALL', label: 'All' },
];

const ManagerReroutes = () => {
    const addAlert = useAlertStore((s) => s.addAlert);
    const [tab, setTab] = useState('PENDING');
    const [reroutes, setReroutes] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [decisionId, setDecisionId] = useState(null);
    const [decisionKind, setDecisionKind] = useState(null);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    const driverMap = useMemo(
        () => Object.fromEntries((drivers || []).map((d) => [d.id, d])),
        [drivers],
    );
    const routeMap = useMemo(
        () => Object.fromEntries((routes || []).map((r) => [r.id, r])),
        [routes],
    );

    const fetchAll = useCallback(async (activeTab) => {
        setLoading(true);
        try {
            const [r, d, rt] = await Promise.all([
                api.get('/manager/reroute', { params: { status: activeTab } }),
                api.get('/manager/drivers').catch(() => ({ data: [] })),
                api.get('/manager/routes').catch(() => ({ data: [] })),
            ]);
            setReroutes(r.data || []);
            setDrivers(d.data || []);
            setRoutes(rt.data || []);
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Failed to load reroutes.' });
            setReroutes([]);
        } finally {
            setLoading(false);
        }
    }, [addAlert]);

    useEffect(() => { fetchAll(tab); }, [tab, fetchAll]);

    const openDecision = (id, kind) => {
        setDecisionId(id);
        setDecisionKind(kind);
        setReason('');
    };

    const confirmDecision = async () => {
        if (!decisionId || !decisionKind) return;
        setSaving(true);
        try {
            const path = decisionKind === 'APPROVE' ? 'approve' : 'reject';
            await api.patch(`/manager/reroute/${decisionId}/${path}`, { reason: reason || null });
            addAlert?.({ type: 'OK', message: `Reroute ${decisionKind.toLowerCase()}d.` });
            setDecisionId(null);
            setDecisionKind(null);
            setReason('');
            fetchAll(tab);
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Decision failed.' });
        } finally {
            setSaving(false);
        }
    };

    const stats = useMemo(() => {
        const pending = reroutes.filter((r) => r.status === 'PENDING').length;
        const approved = reroutes.filter((r) => r.status === 'APPROVED').length;
        const rejected = reroutes.filter((r) => r.status === 'REJECTED').length;
        return { pending, approved, rejected, total: reroutes.length };
    }, [reroutes]);

    return (
        <>
            <PageHeader
                title="Reroute requests"
                sub={tab === 'PENDING' ? `${stats.pending} pending` : `${stats.total} ${tab.toLowerCase()}`}
                actions={(
                    <button className="btn" onClick={() => fetchAll(tab)}>
                        <Icon name="reroute" />Refresh
                    </button>
                )}
            />

            <Filterbar>
                <div style={{ display: 'flex', gap: 6 }}>
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            className={`btn ${tab === t.key ? 'primary' : ''}`}
                            onClick={() => setTab(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="sep" />
                <span className="mono text-xs muted">{reroutes.length} result{reroutes.length === 1 ? '' : 's'}</span>
            </Filterbar>

            <div className="main-body">
                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : reroutes.length === 0 ? (
                        <div style={{ padding: 28 }}>
                            <Empty>
                                {tab === 'PENDING'
                                    ? 'No pending reroute requests.'
                                    : `No ${tab.toLowerCase()} requests.`}
                            </Empty>
                        </div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 80 }}>ID</th>
                                    <th>Driver</th>
                                    <th>Original route</th>
                                    <th>Suggested route</th>
                                    <th>Reason</th>
                                    <th style={{ width: 110 }}>Submitted</th>
                                    <th style={{ width: 110 }}>Status</th>
                                    <th style={{ width: 180 }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reroutes.map((r) => {
                                    const driver = driverMap[r.driver_id];
                                    const fromRoute = routeMap[r.original_route_id];
                                    const toRoute = routeMap[r.new_route_id];
                                    const submitted = r.requested_at
                                        ? new Date(r.requested_at).toLocaleString('en-GB', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              day: '2-digit',
                                              month: 'short',
                                          })
                                        : '—';
                                    const isPending = r.status === 'PENDING';
                                    return (
                                        <tr key={r.id}>
                                            <td className="mono text-sm">RR-{String(r.id).padStart(4, '0')}</td>
                                            <td>
                                                <div>{driver?.user?.full_name || driver?.full_name || `Driver #${r.driver_id}`}</div>
                                                {r.trip_id ? (
                                                    <div className="muted text-xs mono" style={{ marginTop: 2 }}>
                                                        Trip #{r.trip_id}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="mono text-xs">
                                                {fromRoute?.name || (r.original_route_id ? `R-${r.original_route_id}` : '—')}
                                            </td>
                                            <td className="mono text-xs">
                                                {toRoute?.name || (r.new_route_id ? `R-${r.new_route_id}` : '—')}
                                            </td>
                                            <td className="text-sm">
                                                {r.reason ? (
                                                    <div style={{ maxWidth: 280 }}>{r.reason}</div>
                                                ) : (
                                                    <span className="muted">—</span>
                                                )}
                                            </td>
                                            <td className="mono text-xs muted">{submitted}</td>
                                            <td><Tag status={r.status || 'PENDING'} /></td>
                                            <td>
                                                {isPending ? (
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button
                                                            className="btn primary"
                                                            onClick={() => openDecision(r.id, 'APPROVE')}
                                                        >
                                                            <Icon name="check" />Approve
                                                        </button>
                                                        <button
                                                            className="btn"
                                                            style={{ color: 'var(--crit)' }}
                                                            onClick={() => openDecision(r.id, 'REJECT')}
                                                        >
                                                            <Icon name="x" />Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="muted text-xs mono">Resolved</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </Panel>
            </div>

            {decisionId ? (
                <ModalOverlay onClose={() => setDecisionId(null)}>
                    <div className="panel" style={{ width: 480 }}>
                        <div
                            className="panel-head"
                            style={decisionKind === 'REJECT' ? { color: 'var(--crit)' } : undefined}
                        >
                            <strong style={{ color: 'inherit' }}>
                                {decisionKind === 'APPROVE' ? 'Approve' : 'Reject'} reroute RR-
                                {String(decisionId).padStart(4, '0')}
                            </strong>
                            <button className="btn ghost" onClick={() => setDecisionId(null)}>
                                <Icon name="x" />
                            </button>
                        </div>
                        <div className="panel-body">
                            <label className="text-xs muted mono" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>
                                {decisionKind === 'APPROVE' ? 'Note (optional)' : 'Rejection reason'}
                            </label>
                            <div className="field" style={{ padding: 0, marginTop: 6 }}>
                                <textarea
                                    rows={4}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    autoFocus
                                    placeholder={
                                        decisionKind === 'APPROVE'
                                            ? 'Leave a note for the driver…'
                                            : 'Explain why this reroute was rejected.'
                                    }
                                    style={{
                                        width: '100%',
                                        padding: 10,
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'var(--ink)',
                                        fontFamily: 'inherit',
                                        fontSize: 13,
                                        resize: 'vertical',
                                    }}
                                />
                            </div>
                            <div className="muted text-xs mt-2">
                                {decisionKind === 'APPROVE'
                                    ? 'Driver will be notified the reroute is approved.'
                                    : 'Driver will receive your reason so they know how to proceed.'}
                            </div>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                padding: 14,
                                borderTop: '1px solid var(--line)',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <button className="btn" onClick={() => setDecisionId(null)}>Cancel</button>
                            <button
                                className="btn primary"
                                style={decisionKind === 'REJECT'
                                    ? { background: 'var(--crit)', borderColor: 'var(--crit)' }
                                    : undefined}
                                onClick={confirmDecision}
                                disabled={saving || (decisionKind === 'REJECT' && !reason.trim())}
                            >
                                {saving
                                    ? 'Saving…'
                                    : decisionKind === 'APPROVE' ? 'Approve reroute' : 'Reject reroute'}
                            </button>
                        </div>
                    </div>
                </ModalOverlay>
            ) : null}
        </>
    );
};

const ModalOverlay = ({ children, onClose }) => (
    <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.4)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 200,
        }}
    >
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
);

export default ManagerReroutes;
