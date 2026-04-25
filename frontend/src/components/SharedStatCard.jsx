import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

/**
 * SharedStatCard - A reusable KPI card used across all dashboards.
 *
 * Props:
 *   title    - The KPI label (e.g., "Active Buses")
 *   value    - The KPI value (number or string)
 *   icon     - A React element (MUI icon)
 *   color    - MUI color string (e.g., 'primary.main', 'success.main')
 *   onClick  - Optional click handler for action-oriented navigation
 */
const SharedStatCard = ({ title, value, icon, color = 'primary.main', onClick }) => (
    <Paper
        onClick={onClick}
        sx={{
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            cursor: onClick ? 'pointer' : 'default',
            border: '1px solid #e5e7eb',
            transition: 'border-color 0.15s ease',
            '&:hover': {
                borderColor: onClick ? '#94a3b8' : '#e5e7eb',
            },
        }}
    >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {title}
            </Typography>
            <Box
                sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                }}
            >
                {icon}
            </Box>
        </Box>
        <Typography component="p" variant="h3" fontWeight={700}>
            {value}
        </Typography>
    </Paper>
);

export default SharedStatCard;
