import React from 'react';
import Icon from '../../garago/Icon';
import { useTranslation } from '../../hooks/useTranslation';
import { SESSION_CONFIG } from '../../config/session';

const IdleWarningDialog = ({ open, countdown, onStayActive, onLogout }) => {
    const { t } = useTranslation();
    if (!open) return null;
    const progress = Math.max(0, Math.min(1, countdown / SESSION_CONFIG.IDLE_WARNING_SECONDS));
    const critical = countdown <= 10;

    return (
        <div
            role="dialog"
            aria-modal="true"
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
            <div className="panel" style={{ width: 360, padding: 0 }}>
                <div className="panel-head" style={{ color: critical ? 'var(--crit)' : 'var(--warn)' }}>
                    <strong style={{ color: 'inherit' }}>{t('idle.title') || 'Session expiring'}</strong>
                    <Icon name="clock" />
                </div>
                <div className="panel-body" style={{ textAlign: 'center' }}>
                    <div className="muted text-sm mb-4">
                        {t('idle.message') || 'You will be signed out soon due to inactivity.'}
                    </div>
                    <div
                        className="mono"
                        style={{
                            fontSize: 48,
                            fontWeight: 500,
                            letterSpacing: '-0.02em',
                            color: critical ? 'var(--crit)' : 'var(--ink)',
                        }}
                    >
                        {countdown}
                    </div>
                    <div className="mono text-xs muted" style={{ letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4 }}>
                        {t('idle.seconds') || 'seconds'}
                    </div>
                    <div className={`bar ${critical ? 'crit' : 'warn'}`} style={{ marginTop: 16 }}>
                        <span style={{ width: `${progress * 100}%` }} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid var(--line)' }}>
                    <button className="btn" onClick={onLogout}>
                        {t('idle.logoutNow') || 'Sign out'}
                    </button>
                    <button className="btn primary flex-1 justify-center" onClick={onStayActive} autoFocus style={{ justifyContent: 'center' }}>
                        {t('idle.stayLoggedIn') || 'Stay signed in'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IdleWarningDialog;
