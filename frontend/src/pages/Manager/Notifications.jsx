import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Panel, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';

const iconFor = (n) => {
    const t = (n.title || '').toLowerCase();
    if (t.includes('alert') || t.includes('critical')) return { name: 'alert', color: 'var(--crit)' };
    if (t.includes('warn') || t.includes('reroute')) return { name: 'alert', color: 'var(--warn)' };
    if (t.includes('approv') || t.includes('done') || t.includes('complet')) return { name: 'check', color: 'var(--ok)' };
    return { name: 'bell', color: 'var(--accent)' };
};

const ManagerNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/manager/notifications');
            setNotifications(res.data || []);
        } catch {
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    const markRead = async (id) => {
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, status: 'READ' } : n));
        try {
            await api.patch(`/manager/notifications/${id}/read`);
        } catch {
            setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, status: 'DELIVERED' } : n));
        }
    };

    const markAllRead = async () => {
        const unread = notifications.filter((n) => n.status !== 'READ');
        setNotifications((prev) => prev.map((n) => ({ ...n, status: 'READ' })));
        await Promise.allSettled(unread.map((n) => api.patch(`/manager/notifications/${n.id}/read`)));
    };

    const unreadCount = useMemo(
        () => notifications.filter((n) => n.status !== 'READ').length,
        [notifications],
    );

    return (
        <>
            <PageHeader
                title="Notifications"
                sub={`${notifications.length} total · ${unreadCount} unread`}
                actions={unreadCount > 0 ? (
                    <button className="btn" onClick={markAllRead}>
                        <Icon name="check" />Mark all read
                    </button>
                ) : null}
            />

            <div className="main-body">
                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : notifications.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No notifications yet.</Empty></div>
                    ) : (
                        <div>
                            {notifications.map((n) => {
                                const ic = iconFor(n);
                                const unread = n.status !== 'READ';
                                return (
                                    <div
                                        key={n.id}
                                        onClick={() => unread && markRead(n.id)}
                                        style={{
                                            display: 'flex',
                                            gap: 12,
                                            padding: '14px 16px',
                                            borderBottom: '1px solid var(--line)',
                                            cursor: unread ? 'pointer' : 'default',
                                            background: unread ? 'color-mix(in oklab, var(--accent) 4%, transparent)' : 'transparent',
                                        }}
                                    >
                                        <span style={{ color: ic.color, marginTop: 2 }}>
                                            <Icon name={ic.name} />
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                {unread ? (
                                                    <span
                                                        aria-hidden="true"
                                                        style={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: '50%',
                                                            background: ic.color,
                                                            display: 'inline-block',
                                                            flexShrink: 0,
                                                            boxShadow: `0 0 0 0 ${ic.color}`,
                                                            animation: 'garago-pulse 1.5s infinite',
                                                        }}
                                                    />
                                                ) : null}
                                                <span style={{ fontWeight: unread ? 700 : 500 }}>{n.title}</span>
                                                <Tag status={n.status || 'PENDING'} />
                                            </div>
                                            <div className="text-sm" style={{ marginTop: 4 }}>{n.message}</div>
                                            <div className="mono text-xs muted mt-2" style={{ letterSpacing: '.04em' }}>
                                                {n.created_at ? new Date(n.created_at).toLocaleString('en-GB') : '—'}
                                                {unread ? ' · UNREAD' : ''}
                                            </div>
                                        </div>
                                        {unread ? (
                                            <button
                                                className="btn ghost"
                                                onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                                                title="Mark read"
                                            >
                                                <Icon name="check" />
                                            </button>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Panel>
            </div>
        </>
    );
};

export default ManagerNotifications;
