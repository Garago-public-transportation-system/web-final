import React from 'react';
import {
    Dialog, DialogContent, IconButton, Typography, Box, Divider, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import { Close, Language } from '@mui/icons-material';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../hooks/useTranslation';
import api from '../../api/axios';

const SettingsModal = ({ open, onClose }) => {
    const language = useSettingsStore((s) => s.language);
    const setLanguage = useSettingsStore((s) => s.setLanguage);
    const { t } = useTranslation();

    const handleLanguageChange = async (val) => {
        if (!val) return;
        setLanguage(val);
        // Persist to backend — fire-and-forget; localStorage is already updated by setLanguage
        try {
            await api.patch('/auth/me', { preferred_language: val });
        } catch {
            // Non-critical: UI language is already changed via localStorage
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            slotProps={{
                backdrop: {
                    sx: {
                        backdropFilter: 'blur(8px)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    }
                }
            }}
            PaperProps={{
                sx: {
                    borderRadius: 4,
                    overflow: 'hidden',
                }
            }}
        >
            {/* Header */}
            <Box sx={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
                py: 2.5, px: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                    {t('settings.title')}
                </Typography>
                <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    <Close />
                </IconButton>
            </Box>

            <DialogContent sx={{ pt: 3 }}>
                {/* Language Toggle — switching language automatically sets direction */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                        {t('settings.language')}
                    </Typography>
                    <ToggleButtonGroup
                        value={language}
                        exclusive
                        onChange={(e, val) => handleLanguageChange(val)}
                        fullWidth
                        size="small"
                        sx={{
                            '& .MuiToggleButton-root': {
                                borderRadius: '10px !important',
                                textTransform: 'none',
                                fontWeight: 600,
                                py: 1.2,
                                '&.Mui-selected': {
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    '&:hover': { bgcolor: 'primary.dark' },
                                },
                            },
                        }}
                    >
                        <ToggleButton value="en">
                            <Language sx={{ mr: 1 }} /> {t('settings.english')}
                        </ToggleButton>
                        <ToggleButton value="ar">
                            <Language sx={{ mr: 1 }} /> {t('settings.arabic')}
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                    {t('settings.savedNote')}
                </Typography>
            </DialogContent>
        </Dialog>
    );
};

export default SettingsModal;
