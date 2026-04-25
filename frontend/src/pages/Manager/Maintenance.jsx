import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Panel, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

const ManagerMaintenance = () => {
    const addAlert = useAlertStore((s) => s.addAlert);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rejectId, setRejectId] = useState(null);
    const [reason, setReason] = useState('');

    const fetchPending = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/manager/maintenance/pending');
            setRequests(res.data || []);
        } catch {
            addAlert?.({ type: 'ERROR', message: 'Failed to fetch requests.' });
        } finally {
            setLoading(false);
        }
    }, [addAlert]);

    useEffect(() => { fetchPending(); }, [fetchPending]);

    const approve = async (id) => {
        try {
            await api.patch(`/manager/maintenance/${id}/approve`);
            addAlert?.({ type: 'OK', message: 'Request approved.' });
            fetchPending();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Approval failed.' });
        }
    };

    const confirmReject = async () => {
        if (!reason.trim()) return;
        try {
            await api.patch(`/manager/maintenance/${rejectId}/reject`, { reason });
            addAlert?.({ type: 'OK', message: 'Request rejected.' });
            setRejectId(null);
            setReason('');
            fetchPending();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Rejection failed.' });
        }
    };

    return (
        <>
            <PageHeader
                title="Maintenance queue"
                sub={`${requests.length} pending ${requests.length === 1 ? 'request' : 'requests'}`}
            />

            <div className="main-body">
                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : requests.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No pending requests.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>ID</th>
                                    <th className="num">Vehicle</th>
                                    <th>Type</th>
                                    <th>Title</th>
                                    <th>Priority</th>
                                    <th className="num">Requested by</th>
                                    <th style={{ width: 220 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((r) => (
                                    <tr key={r.id}>
                                        <td className="mono text-sm">{r.id}</td>
                                        <td className="num mono text-xs">V-{r.vehicle_id}</td>
                                        <td className="mono text-xs">{r.type}</td>
                                        <td>
                                            <div>{r.title}</div>
                                            {r.description ? (
                                                <div className="muted text-xs" style={{ marginTop: 2 }}>
                                                    {r.description.length > 80
                                                        ? r.description.slice(0, 80) + '…'
                                                        : r.description}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td><Tag status={r.priority || 'LOW'} /></td>
                                        <td className="num mono text-xs">#{r.requested_by_id}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn" onClick={() => approve(r.id)}>
                                                    <Icon name="check" />Approve
                                                </button>
                                                <button
                                                    className="btn"
                                                    style={{ color: 'var(--crit)' }}
                                                    onClick={() => { setRejectId(r.id); setReason(''); }}
                                                >
                                                    <Icon name="x" />Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Panel>
            </div>

            {rejectId ? (
                <ModalOverlay onClose={() => setRejectId(null)}>
                    <div className="panel" style={{ width: 480 }}>
                        <div className="panel-head" style={{ color: 'var(--crit)' }}>
                            <strong style={{ color: 'inherit' }}>Reject request #{rejectId}</strong>
                            <button className="btn ghost" onClick={() => setRejectId(null)}>
                                <Icon name="x" />
                            </button>
                        </div>
                        <div className="panel-body">
                            <label>Rejection reason</label>
                            <div className="field" style={{ padding: 0 }}>
                                <textarea
                                    rows={4}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    autoFocus
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
                                Provide a clear reason so the driver understands the next step.
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid var(--line)', justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setRejectId(null)}>Cancel</button>
                            <button
                                className="btn primary"
                                style={{ background: 'var(--crit)', borderColor: 'var(--crit)' }}
                                onClick={confirmReject}
                                disabled={!reason.trim()}
                            >
                                Reject
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

export default ManagerMaintenance;
