import React from 'react';
import { Alert, Box, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { CircleAlert } from 'lucide-react';

/**
 * A reusable component to display form validation errors from the backend.
 * @param {string | string[]} errors - A string or an array of error messages.
 */
const FormError = ({ errors, sx }) => {
    if (!errors || (Array.isArray(errors) && errors.length === 0)) {
        return null;
    }

    return (
        <Box sx={{ width: '100%', mb: 2, ...sx }}>
            <Alert severity="error" variant="filled">
                {Array.isArray(errors) ? (
                    <List dense disablePadding>
                        {errors.map((err, index) => (
                            <ListItem key={index} disableGutters sx={{ py: 0 }}>
                                <ListItemIcon sx={{ minWidth: 28 }}>
                                    <CircleAlert size={16} color="white" />
                                </ListItemIcon>
                                <ListItemText primary={err} primaryTypographyProps={{ variant: 'body2' }} />
                            </ListItem>
                        ))}
                    </List>
                ) : (
                    <span style={{ fontSize: '0.875rem' }}>{errors}</span>
                )}
            </Alert>
        </Box>
    );
};

export default FormError;
