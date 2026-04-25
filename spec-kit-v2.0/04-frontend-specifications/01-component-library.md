# React Frontend: Component Definitions
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.5 (Frontend Architecture).

## Tech Constraints
* **React**: Version 19 exclusively.
* **TypeScript**: Strict mode enabled (`noImplicitAny`, `strictNullChecks`).
* **MUI**: Material-UI v5 is the absolute visual foundation. Do not utilize custom CSS/Tailwind unless overriding highly specific complex tables.

## Arabic RTL Enforcement Protocol
The application operates in Cairo. Left-to-Right layout is unacceptable for the baseline.
```typescript
import { createTheme } from '@mui/material/styles';
import rtlPlugin from 'stylis-plugin-rtl';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';

export const cacheRtl = createCache({
  key: 'muirtl',
  stylisPlugins: [rtlPlugin],
});

export const theme = createTheme({
  direction: 'rtl', // Flips all margin, padding, and drawer anchors globally!
  typography: { fontFamily: 'Tajawal, sans-serif' },
  palette: {
    primary: { main: '#1A365D' },
    secondary: { main: '#ED8936' }
  }
});
```
Implementation mandates wrapping the entire `<App />` layer inside `<CacheProvider value={cacheRtl}>`.\n