import { create } from 'zustand';

// Read initial values from localStorage, with sensible defaults
const getInitial = (key, fallback) => {
    try {
        const stored = localStorage.getItem(key);
        return stored !== null ? JSON.parse(stored) : fallback;
    } catch {
        return fallback;
    }
};

// Direction is derived from language — no separate toggle
const directionFromLang = (lang) => lang === 'ar' ? 'rtl' : 'ltr';

const initialLang = getInitial('app_language', 'en');

export const useSettingsStore = create((set) => ({
    language: initialLang,
    direction: directionFromLang(initialLang),
    sidebarOpen: getInitial('app_sidebar_open', true),

    setLanguage: (lang) => set(() => {
        const dir = directionFromLang(lang);
        localStorage.setItem('app_language', JSON.stringify(lang));
        document.documentElement.dir = dir;
        return { language: lang, direction: dir };
    }),

    toggleSidebar: () => set((state) => {
        const next = !state.sidebarOpen;
        localStorage.setItem('app_sidebar_open', JSON.stringify(next));
        return { sidebarOpen: next };
    }),
}));
