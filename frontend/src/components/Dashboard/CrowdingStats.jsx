import React, { useEffect, useState } from 'react';
import {
    Box, Typography, Paper, LinearProgress, List, ListItem, ListItemText, Chip, IconButton, CircularProgress
} from '@mui/material';
import { Refresh as RefreshIcon, DirectionsBus } from '@mui/icons-material';
import api from '../../api/axios';
import { useWebSocket } from '../../context/WebSocketContext';

const CrowdingStats = () => {
    const [activeTrips, setActiveTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const { lastNotification } = useWebSocket();

    const fetchActiveTrips = async () => {
        try {
            setLoading(true);
            const response = await api.get('/manager/trips/active');
            setActiveTrips(response.data);
        } catch (error) {
            console.error("Error fetching active trips:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveTrips();
    }, []);

    // Listen for WebSocket crowding updates
    useEffect(() => {
        if (lastNotification && (lastNotification.type === 'crowding_alert' || lastNotification.type === 'trip_status')) {
            // Re-fetch trips if there's a crowding alert or a trip starts/ends
            fetchActiveTrips();
        }
    }, [lastNotification]);

    const getCrowdingColor = (score) => {
        if (score >= 0.9) return 'error';
        if (score >= 0.7) return 'warning';
        return 'success';
    };

    const getCrowdingLabel = (score) => {
        if (score >= 0.9) return 'CRITICAL';
        if (score >= 0.7) return 'HEAVY';
        return 'NORMAL';
    };

    return (
        <Paper sx={{ p: 3, pt: 2, height: '100%', minHeight: 350, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>Live Crowding Radar</Typography>
                <IconButton onClick={fetchActiveTrips} disabled={loading} size="small">
                    <RefreshIcon />
                </IconButton>
            </Box>

            {loading ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress size={30} />
                </Box>
            ) : activeTrips.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="textSecondary" variant="body2">No active trips currently.</Typography>
                </Box>
            ) : (
                <List disablePadding>
                    {activeTrips.map(trip => {
                        const score = trip.crowding_score || 0;
                        const pct = Math.round(score * 100);
                        const color = getCrowdingColor(score);

                        return (
                            <ListItem key={trip.id} sx={{ px: 0, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center' }}>
                                                <DirectionsBus sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                                                Trip #{trip.trip_number || trip.id}
                                            </Typography>
                                            <Chip
                                                label={`${pct}% - ${getCrowdingLabel(score)}`}
                                                color={color}
                                                size="small"
                                                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }}
                                            />
                                        </Box>
                                    }
                                    secondary={
                                        <LinearProgress
                                            variant="determinate"
                                            value={pct}
                                            color={color}
                                            sx={{ height: 6, borderRadius: 3, mt: 1, bgcolor: 'background.paper' }}
                                        />
                                    }
                                />
                            </ListItem>
                        );
                    })}
                </List>
            )}
        </Paper>
    );
};

export default CrowdingStats;
