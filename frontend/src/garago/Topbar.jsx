import React from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { useSettingsStore } from '../store/settingsStore';

function useClock() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Topbar() {
  const { user } = useAuth();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const location = useLocation();
  const now = useClock();

  const parts = location.pathname.replace(/^\//, '').split('/').filter(Boolean);
  const role = parts[0] || 'app';
  const page = parts[1] || 'dashboard';

  const toggleLang = () => setLanguage(language === 'ar' ? 'en' : 'ar');
  const timeStr = now.toTimeString().slice(0, 5);

  return (
    <div className="topbar">
      <div className="topbar-brand">
        <div className="brand-mark">G</div>
        <span>GARAGO</span>
        <span className="mono text-xs muted" style={{ marginInlineStart: 8 }}>/ v2.1.0</span>
      </div>
      <div className="topbar-breadcrumb">
        <span>{role}</span>
        <span>/</span>
        <strong>{page}</strong>
      </div>
      <div className="topbar-actions">
        <div className="flex items-center gap-2">
          <span className="livedot" />
          <span className="mono">LIVE · {timeStr}</span>
        </div>
        <button onClick={toggleLang} title="Toggle language">
          <Icon name="globe" />
          <span>{language === 'ar' ? 'AR' : 'EN'}</span>
        </button>
        <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, background: 'var(--ink)', color: 'var(--bg)', display: 'grid', placeItems: 'center', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700 }}>
            {(user?.full_name || user?.email || '?').slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.full_name || user?.email || 'User'}
          </span>
        </div>
      </div>
    </div>
  );
}
