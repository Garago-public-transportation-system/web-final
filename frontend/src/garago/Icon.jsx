import React from 'react';

const ICONS = {
  dashboard: (<><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></>),
  bus: (<><rect x="2" y="3" width="12" height="9" rx="1"/><rect x="3" y="5" width="4" height="3" fill="currentColor" opacity=".2"/><rect x="9" y="5" width="4" height="3" fill="currentColor" opacity=".2"/><circle cx="5" cy="13.5" r="1"/><circle cx="11" cy="13.5" r="1"/></>),
  users: (<><circle cx="5.5" cy="6" r="2.5"/><path d="M1.5 13c0-2.2 1.8-4 4-4s4 1.8 4 4"/><circle cx="11" cy="6.5" r="2"/><path d="M10 10.5c2.2 0 4 1.4 4 3"/></>),
  route: (<><circle cx="4" cy="3.5" r="1.5"/><circle cx="12" cy="12.5" r="1.5"/><path d="M4 5v3a3 3 0 0 0 3 3h2a3 3 0 0 1 3 3"/></>),
  ticket: (<><path d="M2 5h12v2a1.5 1.5 0 0 0 0 3v2H2v-2a1.5 1.5 0 0 0 0-3V5z"/><path d="M6 5v7" strokeDasharray="1 1.5"/></>),
  schedule: (<><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M2 6h12M5 2v2M11 2v2"/></>),
  report: (<><path d="M3 2h7l3 3v9H3z"/><path d="M10 2v3h3"/><path d="M5 8h6M5 10h6M5 12h4"/></>),
  audit: (<><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></>),
  wrench: (<><path d="M10 2a3 3 0 0 0-2.83 4L2 11.17V14h2.83L10 8.83A3 3 0 1 0 10 2z"/></>),
  fleet: (<><rect x="1" y="5" width="6" height="7" rx="1"/><rect x="9" y="4" width="6" height="8" rx="1"/><circle cx="3" cy="13" r=".8"/><circle cx="5" cy="13" r=".8"/><circle cx="11" cy="13" r=".8"/><circle cx="13" cy="13" r=".8"/></>),
  bell: (<><path d="M8 2a4 4 0 0 0-4 4v3l-1.5 2h11L12 9V6a4 4 0 0 0-4-4z"/><path d="M6.5 13a1.5 1.5 0 0 0 3 0"/></>),
  pause: (<><rect x="4" y="3" width="2.5" height="10"/><rect x="9.5" y="3" width="2.5" height="10"/></>),
  chevron: (<path d="M5 3l5 5-5 5"/>),
  search: (<><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></>),
  plus: (<><path d="M8 3v10M3 8h10"/></>),
  filter: (<path d="M2 3h12l-4.5 5v4l-3 2V8z"/>),
  download: (<><path d="M8 2v8M4 7l4 4 4-4M2 14h12"/></>),
  dot: (<circle cx="8" cy="8" r="2" fill="currentColor"/>),
  arrow: (<path d="M3 8h10M9 4l4 4-4 4"/>),
  arrowUp: (<path d="M8 13V3M4 7l4-4 4 4"/>),
  arrowDown: (<path d="M8 3v10M4 9l4 4 4-4"/>),
  'arrow-left': (<path d="M13 8H3M7 4L3 8l4 4"/>),
  'arrow-right': (<path d="M3 8h10M9 4l4 4-4 4"/>),
  'alert-octagon': (<><path d="M5 1.5h6L14.5 5v6L11 14.5H5L1.5 11V5z"/><path d="M8 5v3.5"/><circle cx="8" cy="11" r=".7" fill="currentColor"/></>),
  'alert-triangle': (<><path d="M8 1.5L14.5 13.5h-13z"/><path d="M8 6v3.5"/><circle cx="8" cy="11.5" r=".7" fill="currentColor"/></>),
  check: (<path d="M3 8l3 3 7-7"/>),
  x: (<path d="M3 3l10 10M13 3L3 13"/>),
  gear: (<><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/></>),
  logout: (<><path d="M6 3H2v10h4"/><path d="M9 5l3 3-3 3M12 8H5"/></>),
  play: (<path d="M4 3l9 5-9 5z"/>),
  nfc: (<><path d="M3 3c3 0 5 2 5 5s-2 5-5 5"/><path d="M5.5 5.5c1.5 0 2.5 1 2.5 2.5s-1 2.5-2.5 2.5"/><circle cx="8" cy="8" r="1"/></>),
  globe: (<><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"/></>),
  battery: (<><rect x="1" y="5" width="12" height="6" rx="1"/><rect x="14" y="7" width="1" height="2"/><rect x="2.5" y="6.5" width="7" height="3" fill="currentColor"/></>),
  location: (<><path d="M8 14s-5-4.5-5-8a5 5 0 1 1 10 0c0 3.5-5 8-5 8z"/><circle cx="8" cy="6" r="1.8"/></>),
  clock: (<><circle cx="8" cy="8" r="6"/><path d="M8 4v4l3 2"/></>),
  shield: (<path d="M8 1l6 2v5c0 3.5-2.5 6-6 7-3.5-1-6-3.5-6-7V3z"/>),
  flash: (<path d="M9 1L3 9h4l-1 6 6-8H8z"/>),
  reroute: (<><path d="M2 5h8a3 3 0 0 1 0 6H6"/><path d="M4 3L2 5l2 2M8 9l-2 2 2 2"/></>),
};

export default function Icon({ name, size = 14, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] || null}
    </svg>
  );
}
