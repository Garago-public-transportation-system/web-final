import React from 'react';
import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';

const NAV = {
  ADMIN: [
    {
      section: 'Overview',
      items: [
        { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { to: '/admin/reports', label: 'Reports', icon: 'report' },
      ],
    },
    {
      section: 'Operations',
      items: [
        { to: '/admin/drivers', label: 'Drivers', icon: 'users' },
        { to: '/admin/vehicles', label: 'Vehicles', icon: 'bus' },
        { to: '/admin/routes', label: 'Routes', icon: 'route' },
        { to: '/admin/schedule', label: 'Schedule', icon: 'schedule' },
        { to: '/admin/rotations', label: 'Rotations', icon: 'reroute' },
      ],
    },
    {
      section: 'Revenue & Assets',
      items: [
        { to: '/admin/tickets', label: 'Tickets', icon: 'ticket' },
        { to: '/admin/maintenance', label: 'Maintenance', icon: 'wrench' },
      ],
    },
    {
      section: 'Admin',
      items: [
        { to: '/admin/users', label: 'Users', icon: 'users' },
        { to: '/admin/audit-logs', label: 'Audit logs', icon: 'audit' },
      ],
    },
  ],
  MANAGER: [
    {
      section: 'Live Ops',
      items: [
        { to: '/manager/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { to: '/manager/fleet', label: 'Fleet map', icon: 'fleet' },
      ],
    },
    {
      section: 'Control',
      items: [
        { to: '/manager/reroutes', label: 'Reroutes', icon: 'reroute' },
        { to: '/manager/maintenance', label: 'Maintenance', icon: 'wrench' },
        { to: '/manager/notifications', label: 'Notifications', icon: 'bell' },
      ],
    },
    {
      section: 'Analytics',
      items: [
        { to: '/manager/reports', label: 'Reports', icon: 'report' },
      ],
    },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const role = user?.role || 'ADMIN';
  const sections = NAV[role] || [];

  return (
    <aside className="sidebar">
      {sections.map((sec) => (
        <div key={sec.section} className="sidebar-section">
          <div className="sidebar-section-title">{sec.section}</div>
          {sec.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
      <div className="sidebar-footer">
        <div className="label">Account</div>
        <div className="flex items-center gap-2">
          <div style={{ width: 28, height: 28, background: 'var(--ink)', color: 'var(--bg)', display: 'grid', placeItems: 'center', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700 }}>
            {(user?.full_name || user?.email || '?').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.full_name || user?.email || 'Signed in'}
            </div>
            <div className="mono text-xs muted" style={{ letterSpacing: '.04em', textTransform: 'uppercase' }}>{role}</div>
          </div>
        </div>
        <button className="btn ghost" onClick={logout} style={{ justifyContent: 'flex-start' }}>
          <Icon name="logout" /> Sign out
        </button>
      </div>
    </aside>
  );
}
