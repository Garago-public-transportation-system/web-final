import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Button, Box, Tooltip } from '@mui/material';
import { Menu as MenuIcon, MenuOpen, AccountCircle, Settings as SettingsIcon } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../hooks/useTranslation';
import ProfileModal from '../Modals/ProfileModal';
import SettingsModal from '../Modals/SettingsModal';

const Header = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
    const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
    const { t } = useTranslation();

    const [profileOpen, setProfileOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <>
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <Tooltip title={sidebarOpen ? t('header.hideSidebar') : t('header.showSidebar')}>
                        <IconButton
                            color="inherit"
                            aria-label="toggle sidebar"
                            edge="start"
                            onClick={toggleSidebar}
                            sx={{ mr: 2 }}
                        >
                            {sidebarOpen ? <MenuOpen /> : <MenuIcon />}
                        </IconButton>
                    </Tooltip>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        Smart Bus Garage - {user?.role} {t('header.portal')}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body1" sx={{ mr: 1 }}>
                            {user?.full_name || user?.email}
                        </Typography>
                        <Tooltip title={t('header.profile')}>
                            <IconButton color="inherit" onClick={() => setProfileOpen(true)}>
                                <AccountCircle />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={t('header.settings')}>
                            <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                        <Button color="inherit" onClick={handleLogout} sx={{ ml: 1 }}>{t('header.logout')}</Button>
                    </Box>
                </Toolbar>
            </AppBar>

            <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
            <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </>
    );
};

export default Header;
