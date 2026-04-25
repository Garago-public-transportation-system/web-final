import React, { useState } from 'react';
import {
    Dialog, DialogContent, IconButton, Typography, Box, Divider, Avatar, Chip,
    TextField, Button, Collapse, Alert, CircularProgress
} from '@mui/material';
import { Close, Email, Badge, Phone, Shield, Lock, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import api from '../../api/axios';

const ProfileModal = ({ open, onClose }) => {
    const { user } = useAuth();
    const { t } = useTranslation();

    const [pwOpen, setPwOpen] = useState(false);
    const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
    const [pwStatus, setPwStatus] = useState(null); // { type: 'success'|'error', message: string }
    const [pwLoading, setPwLoading] = useState(false);

    if (!user) return null;

    const handlePwChange = async () => {
        if (pwForm.new_password !== pwForm.confirm) {
            setPwStatus({ type: 'error', message: t('profile.passwordMismatch') });
            return;
        }
        setPwLoading(true);
        setPwStatus(null);
        try {
            await api.post('/auth/change-password', {
                current_password: pwForm.current_password,
                new_password: pwForm.new_password,
            });
            setPwStatus({ type: 'success', message: t('profile.passwordChanged') });
            setPwForm({ current_password: '', new_password: '', confirm: '' });
        } catch (error) {
            const msg = error.response?.data?.detail || t('profile.passwordChangeFailed');
            setPwStatus({ type: 'error', message: msg });
        } finally {
            setPwLoading(false);
        }
    };

    const roleColor = {
        ADMIN: 'error',
        MANAGER: 'warning',
        DRIVER: 'info',
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
            {/* Header gradient */}
            <Box sx={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
                pt: 4, pb: 5, px: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
            }}>
                <IconButton
                    onClick={onClose}
                    sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.7)' }}
                >
                    <Close />
                </IconButton>
                <Avatar sx={{
                    width: 80, height: 80,
                    bgcolor: 'secondary.main',
                    fontSize: '2rem',
                    fontWeight: 700,
                    mb: 1.5,
                    border: '3px solid rgba(255,255,255,0.2)',
                }}>
                    {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                    {user.full_name || 'User'}
                </Typography>
                <Chip
                    label={user.role}
                    color={roleColor[user.role] || 'default'}
                    size="small"
                    sx={{ mt: 1, fontWeight: 600 }}
                />
            </Box>

            {/* Profile details */}
            <DialogContent sx={{ pt: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Email sx={{ color: 'text.secondary' }} />
                        <Box>
                            <Typography variant="caption" color="text.secondary">{t('profile.email')}</Typography>
                            <Typography variant="body2" fontWeight={500}>{user.email}</Typography>
                        </Box>
                    </Box>

                    {user.phone && (
                        <>
                            <Divider />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Phone sx={{ color: 'text.secondary' }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary">{t('profile.phone')}</Typography>
                                    <Typography variant="body2" fontWeight={500}>{user.phone}</Typography>
                                </Box>
                            </Box>
                        </>
                    )}

                    <Divider />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Badge sx={{ color: 'text.secondary' }} />
                        <Box>
                            <Typography variant="caption" color="text.secondary">{t('profile.userId')}</Typography>
                            <Typography variant="body2" fontWeight={500}>#{user.id}</Typography>
                        </Box>
                    </Box>

                    <Divider />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Shield sx={{ color: 'text.secondary' }} />
                        <Box>
                            <Typography variant="caption" color="text.secondary">{t('profile.accessLevel')}</Typography>
                            <Typography variant="body2" fontWeight={500}>{user.role} {t('profile.portalSuffix')}</Typography>
                        </Box>
                    </Box>

                    <Divider />

                    {/* Change Password section */}
                    <Box>
                        <Box
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 0.5 }}
                            onClick={() => { setPwOpen((v) => !v); setPwStatus(null); }}
                        >
                            <Lock sx={{ color: 'text.secondary', fontSize: 20 }} />
                            <Typography variant="body2" fontWeight={500} sx={{ flexGrow: 1 }}>
                                {t('profile.changePassword')}
                            </Typography>
                            {pwOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                        </Box>

                        <Collapse in={pwOpen}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1.5 }}>
                                {pwStatus && (
                                    <Alert severity={pwStatus.type} sx={{ py: 0.5 }}>
                                        {pwStatus.message}
                                    </Alert>
                                )}
                                <TextField
                                    label={t('profile.currentPassword')}
                                    type="password"
                                    size="small"
                                    fullWidth
                                    value={pwForm.current_password}
                                    onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))}
                                    autoComplete="current-password"
                                />
                                <TextField
                                    label={t('profile.newPassword')}
                                    type="password"
                                    size="small"
                                    fullWidth
                                    value={pwForm.new_password}
                                    onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))}
                                    autoComplete="new-password"
                                />
                                <TextField
                                    label={t('profile.confirmPassword')}
                                    type="password"
                                    size="small"
                                    fullWidth
                                    value={pwForm.confirm}
                                    onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                                    error={pwForm.confirm.length > 0 && pwForm.confirm !== pwForm.new_password}
                                    helperText={pwForm.confirm.length > 0 && pwForm.confirm !== pwForm.new_password ? t('profile.passwordMismatch') : ''}
                                    autoComplete="new-password"
                                />
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handlePwChange}
                                    disabled={pwLoading || !pwForm.current_password || !pwForm.new_password || !pwForm.confirm}
                                    startIcon={pwLoading ? <CircularProgress size={14} color="inherit" /> : null}
                                >
                                    {pwLoading ? t('profile.saving') : t('profile.changePassword')}
                                </Button>
                            </Box>
                        </Collapse>
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default ProfileModal;
