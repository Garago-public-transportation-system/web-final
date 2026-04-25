# Data Store & Socket Memory
> **Cross-Reference**: See `PRD-v2.0.md` Technical Requirements (React/Zustand stack).

## Store Allocation Rule
1. **Context API**: Reserved ONLY for the JWT Auth wrapper. Auth states rarely mutate (once per hour typically).
2. **Zustand**: Must be used for the active WebSocket arrays. Pushing arrays into standard React `useState` triggers massive catastrophic un-optimized re-renders across the dashboard layout.

## Zustand Alert Bus Implementation
```typescript
import { create } from 'zustand'

export interface AppAlert {
  id: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  timestamp: Date;
}

interface AlertStore {
  alerts: AppAlert[];
  addAlert: (alert: AppAlert) => void;
  clearAlerts: () => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],
  addAlert: (alert) => set((state) => ({ 
     alerts: [alert, ...state.alerts].slice(0, 50) // High-performance circular array
  })),
  clearAlerts: () => set({ alerts: [] })
}))
```\n