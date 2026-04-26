import { useSettingsStore } from '../store/settingsStore';
import translations from '../i18n/translations';

export const useTranslation = () => {
    const language = useSettingsStore((s) => s.language);

    const t = (key, vars) => {
        const raw =
            translations[language]?.[key] ?? translations['en']?.[key] ?? key;
        if (!vars) return raw;
        return raw.replace(/\{(\w+)\}/g, (_, k) =>
            (vars[k] ?? `{${k}}`).toString(),
        );
    };

    return { t, language };
};
