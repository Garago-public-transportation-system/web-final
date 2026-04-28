import { useCallback } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import translations from '../i18n/translations';

export const useTranslation = () => {
    const language = useSettingsStore((s) => s.language);

    // CRITICAL: `t` MUST be stable across renders within the same language.
    // Several admin pages put `t` in useCallback dependency arrays for
    // their data fetchers; an unstable `t` makes the fetcher reference
    // change every render, which makes `useEffect(..., [fetcher])` refire
    // on every render, which triggers loading state updates, which re-render,
    // which… → render loop firing the same network request many times.
    const t = useCallback(
        (key, vars) => {
            const raw =
                translations[language]?.[key] ?? translations['en']?.[key] ?? key;
            if (!vars) return raw;
            return raw.replace(/\{(\w+)\}/g, (_, k) =>
                (vars[k] ?? `{${k}}`).toString(),
            );
        },
        [language],
    );

    return { t, language };
};
