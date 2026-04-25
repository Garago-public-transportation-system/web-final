import React from 'react';
import Icon from './Icon';

export const Sparkline = ({ data = [], width = 80, height = 24, className }) => {
  if (!Array.isArray(data) || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / (max - min || 1)) * height;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
};

export const Stat = ({ label, value, delta, trend, spark, onClick }) => {
  const clickable = typeof onClick === 'function';
  const commonProps = {
    className: `stat${clickable ? ' stat-clickable' : ''}`,
  };
  const body = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {delta ? (
        <div className={`stat-delta ${trend === 'up' ? 'up' : trend === 'down' ? 'down' : ''}`}>
          {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'} {delta}
        </div>
      ) : null}
      {spark ? <Sparkline className="stat-spark" data={spark} /> : null}
    </>
  );
  if (clickable) {
    return (
      <button
        type="button"
        {...commonProps}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } }}
      >
        {body}
      </button>
    );
  }
  return <div {...commonProps}>{body}</div>;
};

export const Panel = ({ title, action, children, flush, style, className = '' }) => (
  <div className={`panel ${className}`} style={style}>
    {title ? (
      <div className="panel-head">
        <strong>{title}</strong>
        {action}
      </div>
    ) : null}
    <div className={`panel-body ${flush ? 'flush' : ''}`}>{children}</div>
  </div>
);

const STATUS_MAP = {
  ON_TRIP: { cls: 'ok', label: 'On trip' },
  BREAK: { cls: 'warn', label: 'On break' },
  ON_BREAK: { cls: 'warn', label: 'On break' },
  FREE: { cls: '', label: 'Free' },
  OFF: { cls: '', label: 'Off' },
  OFF_DUTY: { cls: '', label: 'Off duty' },
  EN_ROUTE: { cls: 'ok', label: 'En route' },
  ASSIGNED: { cls: 'accent', label: 'Assigned' },
  OUT_OF_SERVICE: { cls: 'crit', label: 'Out of service' },
  CANCELLED: { cls: 'crit', label: 'Cancelled' },
  USED: { cls: '', label: 'Used' },
  ISSUED: { cls: 'accent', label: 'Issued' },
  EXPIRED: { cls: 'warn', label: 'Expired' },
  MAINT: { cls: 'crit', label: 'Maintenance' },
  MAINTENANCE: { cls: 'crit', label: 'Maintenance' },
  GARAGE: { cls: '', label: 'Garage' },
  PAID: { cls: 'ok', label: 'Paid' },
  VOID: { cls: 'crit', label: 'Void' },
  VOIDED: { cls: 'crit', label: 'Void' },
  REFUNDED: { cls: 'warn', label: 'Refunded' },
  ACTIVE: { cls: 'ok', label: 'Active' },
  INACTIVE: { cls: '', label: 'Inactive' },
  PENDING: { cls: 'accent', label: 'Pending' },
  APPROVED: { cls: 'ok', label: 'Approved' },
  REJECTED: { cls: 'crit', label: 'Rejected' },
  COMPLETED: { cls: 'ok', label: 'Completed' },
  IN_PROGRESS: { cls: 'accent', label: 'In progress' },
  SCHEDULED: { cls: '', label: 'Scheduled' },
  OK: { cls: 'ok', label: 'OK' },
  WARN: { cls: 'warn', label: 'Warn' },
  CRIT: { cls: 'crit', label: 'Crit' },
  HIGH: { cls: 'crit', label: 'High' },
  MED: { cls: 'warn', label: 'Med' },
  LOW: { cls: '', label: 'Low' },
};

export const Tag = ({ status, children, variant }) => {
  if (status && STATUS_MAP[status]) {
    const info = STATUS_MAP[status];
    return (
      <span className={`tag ${info.cls}`}>
        <span className="dot" />
        {info.label}
      </span>
    );
  }
  const fallback = children ?? (status ? String(status).replace(/_/g, ' ').toLowerCase() : '—');
  return <span className={`tag ${variant || ''}`}>{fallback}</span>;
};

export const Bar = ({ value = 0, kind }) => {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const cls = !kind ? (v >= 0.9 ? 'crit' : v >= 0.7 ? 'warn' : 'ok') : kind;
  return (
    <div className={`bar ${cls}`}>
      <span style={{ width: `${Math.round(v * 100)}%` }} />
    </div>
  );
};

export const PageHeader = ({ title, sub, actions }) => (
  <div className="main-header">
    <div>
      <h1>{title}</h1>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
    {actions ? <div className="main-header-actions">{actions}</div> : null}
  </div>
);

export const Filterbar = ({ children }) => <div className="filterbar">{children}</div>;

export const MiniMap = ({ height = 320, pins = [], children }) => (
  <div className="map-wrap" style={{ height, width: '100%' }}>
    <svg className="map-bg" viewBox="0 0 600 320" preserveAspectRatio="xMidYMid slice">
      <rect width="600" height="320" fill="#e9e7e2" />
      <path
        d="M 180 0 C 200 80, 160 140, 190 220 L 220 220 C 190 140, 230 80, 210 0 Z"
        fill="#d4d0c8"
        opacity="0.8"
      />
      <g fill="#dcd8d0" stroke="#c9c4b8" strokeWidth="0.5">
        <rect x="30" y="30" width="80" height="60" />
        <rect x="30" y="100" width="80" height="50" />
        <rect x="30" y="160" width="80" height="70" />
        <rect x="30" y="240" width="80" height="60" />
        <rect x="120" y="30" width="50" height="90" />
        <rect x="120" y="130" width="50" height="50" />
        <rect x="120" y="190" width="50" height="70" />
        <rect x="120" y="270" width="50" height="40" />
        <rect x="240" y="30" width="70" height="70" />
        <rect x="240" y="110" width="70" height="50" />
        <rect x="240" y="170" width="70" height="40" />
        <rect x="240" y="220" width="70" height="90" />
        <rect x="320" y="30" width="60" height="50" />
        <rect x="320" y="90" width="60" height="80" />
        <rect x="320" y="180" width="60" height="50" />
        <rect x="320" y="240" width="60" height="60" />
        <rect x="390" y="30" width="90" height="60" />
        <rect x="390" y="100" width="90" height="70" />
        <rect x="390" y="180" width="90" height="50" />
        <rect x="390" y="240" width="90" height="60" />
        <rect x="490" y="30" width="80" height="80" />
        <rect x="490" y="120" width="80" height="60" />
        <rect x="490" y="190" width="80" height="50" />
        <rect x="490" y="250" width="80" height="50" />
      </g>
      <g stroke="#c0bbaf" strokeWidth="2" fill="none">
        <path d="M 0 95 H 600" />
        <path d="M 0 175 H 600" />
        <path d="M 0 230 H 600" />
        <path d="M 115 0 V 320" />
        <path d="M 235 0 V 320" />
        <path d="M 315 0 V 320" />
        <path d="M 385 0 V 320" />
        <path d="M 485 0 V 320" />
      </g>
      <path
        d="M 50 250 L 115 250 L 115 175 L 235 175 L 235 95 L 385 95 L 385 50"
        stroke="#0a0a0a"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="4 3"
      />
      <g fill="#fff" stroke="#0a0a0a" strokeWidth="1">
        <circle cx="50" cy="250" r="3" />
        <circle cx="115" cy="250" r="3" />
        <circle cx="115" cy="175" r="3" />
        <circle cx="235" cy="175" r="3" />
        <circle cx="235" cy="95" r="3" />
        <circle cx="385" cy="95" r="3" />
        <circle cx="385" cy="50" r="3" />
      </g>
    </svg>
    {pins.map((p, i) => (
      <div
        key={i}
        className={`map-pin ${p.status || ''}`}
        style={{ left: `${p.x}%`, top: `${p.y}%` }}
      >
        {p.label}
      </div>
    ))}
    {children}
  </div>
);

export const Empty = ({ children = 'No data' }) => <div className="empty">{children}</div>;

export const LoadingState = ({ label = 'Loading…' }) => (
  <div className="flex items-center gap-2" style={{ padding: 20, color: 'var(--ink-4)' }}>
    <span className="spinner" /> <span className="mono text-xs" style={{ letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</span>
  </div>
);

export { Icon };
