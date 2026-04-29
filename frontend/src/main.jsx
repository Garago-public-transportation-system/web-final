import { createRoot } from 'react-dom/client';
import React from 'react';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { useSettingsStore } from './store/settingsStore';

const DirectionSync = ({ children }) => {
  const direction = useSettingsStore((s) => s.direction);
  React.useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);
  return children;
};

// StrictMode intentionally double-invokes effects in dev to surface bugs.
// Disabled here because it causes every API call to appear twice in the
// backend log during development, which was confusing during debugging.
// Production builds are unaffected — StrictMode only does anything in dev.
createRoot(document.getElementById('root')).render(
  <DirectionSync>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </DirectionSync>,
);
