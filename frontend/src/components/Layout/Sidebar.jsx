import React from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar, Typography, Box, useMediaQuery, useTheme } from '@mui/material';
import {
    Dashboard as DashboardIcon,
    DirectionsBus,
    People,
    Settings,
    Map,
    Build,
    Schedule,
    Notifications,
    ConfirmationNumber,
    SwapHoriz,
    Assessment,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettingsStore } from '../../store/settingsStore';

const drawerWidth = 240;

const Sidebar = ({ open = true }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { t } = useTranslation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

    const menuItems = {
        ADMIN: [
            { text: t('sidebar.dashboard'), icon: <DashboardIcon />, path: '/admin/dashboard' },
            { text: t('sidebar.users'), icon: <People />, path: '/admin/users' },
            { text: t('sidebar.vehicles'), icon: <DirectionsBus />, path: '/admin/vehicles' },
            { text: t('sidebar.drivers'), icon: <People />, path: '/admin/drivers' },
            { text: t('sidebar.routes'), icon: <Map />, path: '/admin/routes' },
            { text: t('sidebar.schedule'), icon: <Schedule />, path: '/admin/schedule' },
            { text: t('sidebar.rotations'), icon: <SwapHoriz />, path: '/admin/rotations' },
            { text: t('sidebar.adminMaintenance'), icon: <Build />, path: '/admin/maintenance' },
            { text: t('sidebar.reports'), icon: <Assessment />, path: '/admin/reports' },
            { text: t('sidebar.tickets'), icon: <ConfirmationNumber />, path: '/admin/tickets' },
            { text: t('sidebar.auditLogs'), icon: <Settings />, path: '/admin/audit-logs' },
        ],
        MANAGER: [
            { text: t('sidebar.dashboard'), icon: <DashboardIcon />, path: '/manager/dashboard' },
            { text: t('sidebar.maintenance'), icon: <Build />, path: '/manager/maintenance' },
            { text: t('sidebar.fleet'), icon: <DirectionsBus />, path: '/manager/fleet' },
            { text: t('sidebar.notifications'), icon: <Notifications />, path: '/manager/notifications' },
        ],
        DRIVER: [
            { text: t('sidebar.dashboard'), icon: <DashboardIcon />, path: '/driver/dashboard' },
            { text: t('sidebar.myTrips'), icon: <DirectionsBus />, path: '/driver/trips' },
            { text: t('sidebar.breaks'), icon: <Schedule />, path: '/driver/breaks' },
            { text: t('sidebar.notifications'), icon: <Notifications />, path: '/driver/notifications' },
        ]
    };

    const roleItems = user ? menuItems[user.role] : [];

    return (
        <Drawer
            variant={isMobile ? "temporary" : "permanent"}
            open={open}
            onClose={toggleSidebar}
            sx={{
                width: open ? drawerWidth : 0,
                flexShrink: 0,
                transition: 'width 0.2s ease',
                overflow: 'hidden',
                [`& .MuiDrawer-paper`]: {
                    width: drawerWidth,
                    boxSizing: 'border-box',
                    backgroundColor: '#18181b',
                    color: '#ffffff',
                    borderRight: 'none',
                    transform: open ? 'translateX(0)' : `translateX(-${drawerWidth}px)`,
                    transition: 'transform 0.2s ease',
                },
            }}
        >
            <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3, mb: 2 }}>
                <Typography variant="h5" component="div" sx={{ fontWeight: 800, letterSpacing: '0.05em', color: '#818cf8' }}>
                    SMART<Box component="span" sx={{ color: '#ffffff' }}>BUS</Box>
                </Typography>
            </Toolbar>
            <List sx={{ px: 2 }}>
                {roleItems && roleItems.map((item) => {
                    const isSelected = location.pathname === item.path;
                    return (
                        <ListItem
                            key={item.text}
                            button
                            onClick={() => navigate(item.path)}
                            selected={isSelected}
                            sx={{
                                mx: 1,
                                mb: 0.5,
                                width: 'auto',
                                borderRadius: 2,
                                borderLeft: isSelected ? '3px solid #6366f1' : '3px solid transparent',
                                '&.Mui-selected': {
                                    backgroundColor: 'rgba(99,102,241,0.15)',
                                    color: 'white',
                                    '& .MuiListItemIcon-root': {
                                        color: '#818cf8',
                                    },
                                    '&:hover': {
                                        backgroundColor: 'rgba(99,102,241,0.2)',
                                    },
                                },
                                '&:hover': {
                                    backgroundColor: 'rgba(255,255,255,0.06)',
                                },
                                transition: 'background-color 0.15s ease',
                            }}
                        >
                            <ListItemIcon sx={{ color: isSelected ? '#818cf8' : '#71717a', minWidth: 40 }}>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{
                                    fontSize: '0.9rem',
                                    fontWeight: isSelected ? 600 : 400,
                                    color: isSelected ? '#ffffff' : '#a1a1aa',
                                }}
                            />
                        </ListItem>
                    );
                })}
            </List>
        </Drawer>
    );
};

export default Sidebar;
