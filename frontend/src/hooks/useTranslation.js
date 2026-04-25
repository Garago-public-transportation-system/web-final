import { useSettingsStore } from '../store/settingsStore';
import translations from '../i18n/translations';

export const useTranslation = () => {
    const language = useSettingsStore((s) => s.language);

    const t = (key) => {
        return translations[language]?.[key] || translations['en']?.[key] || key;
    };

    return { t, language };
};
