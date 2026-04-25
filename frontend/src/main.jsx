import { StrictMode } from 'react';
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DirectionSync>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </DirectionSync>
  </StrictMode>,
);
