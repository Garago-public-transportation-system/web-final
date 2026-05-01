/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useAlertStore } from '../store/alertStore';

const WebSocketContext = createContext(null);

const HEARTBEAT_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;
const REFRESH_LEEWAY_SECONDS = 60;

// Decode JWT payload without verifying — used only to inspect `exp` client-side.
const decodeJwtExp = (token) => {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const claims = JSON.parse(json);
        return typeof claims.exp === 'number' ? claims.exp : null;
    } catch {
        return null;
    }
};

export const WebSocketProvider = ({ children }) => {
    const { user, token, refreshAccessToken, logout } = useAuth();
    const ws = useRef(null);
    const heartbeatTimer = useRef(null);
    const reconnectTimer = useRef(null);
    const didRefreshAfterAuthFail = useRef(false);
    const addAlert = useAlertStore((state) => state.addAlert);
    const [lastNotification, setLastNotification] = useState(null);
    const [gpsByVehicle, setGpsByVehicle] = useState({});

    const clearTimers = () => {
        if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    const connect = async (userRef, tokenRef) => {
        if (ws.current && ws.current.readyState <= WebSocket.OPEN) {
            ws.current.close();
        }

        // Refresh proactively if the access token is expired or near expiry.
        let activeToken = tokenRef;
        const exp = decodeJwtExp(activeToken);
        const nowSec = Math.floor(Date.now() / 1000);
        if (exp !== null && exp - nowSec <= REFRESH_LEEWAY_SECONDS) {
            try {
                activeToken = await refreshAccessToken();
            } catch {
                logout();
                return;
            }
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';
        const wsUrl = `${protocol}//${host}:8000/ws?token=${activeToken}`;

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            didRefreshAfterAuthFail.current = false;
            heartbeatTimer.current = setInterval(() => {
                if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                    ws.current.send(JSON.stringify({ type: 'ping' }));
                }
            }, HEARTBEAT_INTERVAL_MS);
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'pong') return;
                if (data.type === 'gps_update' && data.vehicle_id != null) {
                    setGpsByVehicle((prev) => ({
                        ...prev,
                        [data.vehicle_id]: { ...data, receivedAt: Date.now() },
                    }));
                    setLastNotification({ ...data, receivedAt: Date.now() });
                    return;
                }
                setLastNotification({ ...data, receivedAt: Date.now() });
                addAlert({
                    id: Date.now().toString() + Math.random().toString(),
                    timestamp: new Date(),
                    ...data
                });
            } catch (e) {
                // ignore malformed frames
            }
        };

        ws.current.onclose = async (event) => {
            clearInterval(heartbeatTimer.current);
            if (!userRef) return;

            // 4401 → token expired: refresh once and reconnect immediately.
            if (event.code === 4401 && !didRefreshAfterAuthFail.current) {
                didRefreshAfterAuthFail.current = true;
                try {
                    const fresh = await refreshAccessToken();
                    connect(userRef, fresh);
                    return;
                } catch {
                    logout();
                    return;
                }
            }

            // 4003 → invalid token: do not reconnect, force re-auth.
            if (event.code === 4003) {
                logout();
                return;
            }

            reconnectTimer.current = setTimeout(() => connect(userRef, activeToken), RECONNECT_DELAY_MS);
        };
    };

    useEffect(() => {
        if (user && token) {
            connect(user, token);
        }

        return () => {
            clearTimers();
            if (ws.current) {
                ws.current.onclose = null;
                ws.current.close();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, token]);

    return (
        <WebSocketContext.Provider value={{ lastNotification, gpsByVehicle }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);
