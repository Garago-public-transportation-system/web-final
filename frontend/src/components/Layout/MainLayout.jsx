import React, { useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../../garago/Sidebar';
import Topbar from '../../garago/Topbar';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuth } from '../../context/AuthContext';
import { useAlertStore } from '../../store/alertStore';
import useIdleTimer from '../../hooks/useIdleTimer';
import IdleWarningDialog from '../Modals/IdleWarningDialog';

const MainLayout = () => {
    const direction = useSettingsStore((state) => state.direction);
    const alerts = useAlertStore((state) => state.alerts);
    const clearAlerts = useAlertStore((state) => state.clearAlerts);
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleIdle = useCallback(() => {
        logout();
        navigate('/login?session_expired=true');
    }, [logout, navigate]);

    const { isWarning, countdown, stayActive } = useIdleTimer({ onIdle: handleIdle, enabled: true });

    const [toast, setToast] = React.useState(null);
    React.useEffect(() => {
        if (alerts.length > 0) {
            const next = alerts[0];
            setToast(next);
            const id = setTimeout(() => {
                setToast(null);
                clearAlerts?.();
            }, 5000);
            return () => clearTimeout(id);
        }
    }, [alerts, clearAlerts]);

    return (
        <div className="app" dir={direction}>
            <Topbar />
            <Sidebar />
            <main className="main">
                <Outlet />
            </main>
            {toast ? (
                <div
                    className="panel"
                    style={{
                        position: 'fixed',
                        bottom: 16,
                        insetInlineEnd: 16,
                        padding: '10px 14px',
                        zIndex: 120,
                        maxWidth: 320,
                        boxShadow: '0 8px 24px rgba(0,0,0,.08)',
                    }}
                >
                    <div className="mono text-xs muted" style={{ letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {toast.type || 'ALERT'}
                    </div>
                    <div className="text-sm" style={{ marginTop: 4 }}>
                        {toast.title ? <strong>{toast.title}: </strong> : null}
                        {toast.message}
                    </div>
                </div>
            ) : null}

            <IdleWarningDialog
                open={isWarning}
                countdown={countdown}
                onStayActive={stayActive}
                onLogout={handleIdle}
            />
        </div>
    );
};

export default MainLayout;
