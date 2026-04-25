import { create } from 'zustand';

// Creates a high-performance circular array store for alerts
export const useAlertStore = create((set) => ({
    alerts: [],
    addAlert: (alert) => set((state) => ({
        // Keep only the most recent 50 alerts in memory
        alerts: [alert, ...state.alerts].slice(0, 50)
    })),
    clearAlerts: () => set({ alerts: [] }),
}));
