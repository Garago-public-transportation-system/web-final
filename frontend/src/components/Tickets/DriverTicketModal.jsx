import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Tabs, Tab,
    Box, TextField, Typography, Alert, CircularProgress, Paper
} from '@mui/material';
import api from '../../api/axios';

const TabPanel = (props) => {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
};

const DriverTicketModal = ({ open, onClose, tripId }) => {
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);

    // Issue State
    const [issueData, setIssueData] = useState({ passenger_name: '', seat_number: '', price: '15.00' });
    const [issueResult, setIssueResult] = useState(null);
    const [issueError, setIssueError] = useState('');

    // Scan State
    const [scanCode, setScanCode] = useState('');
    const [scanResult, setScanResult] = useState(null);
    const [scanError, setScanError] = useState('');

    const handleTabChange = (event, newValue) => {
        setTab(newValue);
        // Reset results on tab switch
        setIssueResult(null); setIssueError('');
        setScanResult(null); setScanError('');
    };

    const handleIssueTicket = async () => {
        try {
            setLoading(true);
            setIssueError('');
            setIssueResult(null);

            // Driver-only endpoint. trip_id comes from the URL; price is set
            // server-side from the route fare (client-supplied price ignored).
            const payload = {
                passenger_name: issueData.passenger_name || 'Walk-in Passenger',
                seat_number: issueData.seat_number ? issueData.seat_number : null,
            };

            const response = await api.post(`/drivers/me/trips/${tripId}/tickets`, payload);
            setIssueResult(response.data);
            setIssueData({ passenger_name: '', seat_number: '', price: '15.00' }); // reset form
        } catch (error) {
            setIssueError(error.response?.data?.detail || "Failed to issue ticket");
        } finally {
            setLoading(false);
        }
    };

    const handleScanTicket = async () => {
        if (!scanCode.trim()) return;

        try {
            setLoading(true);
            setScanError('');
            setScanResult(null);

            const response = await api.post(`/admin/tickets/validate?ticket_code=${encodeURIComponent(scanCode.trim())}`);
            setScanResult(response.data);
            setScanCode(''); // reset input on success
        } catch (error) {
            setScanError(error.response?.data?.detail || "Invalid or already used ticket");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Reset state when closing
        setTab(0);
        setIssueResult(null); setIssueError('');
        setScanResult(null); setScanError('');
        setIssueData({ passenger_name: '', seat_number: '', price: '15.00' });
        setScanCode('');
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Ticketing & Sales - Trip #{tripId}</DialogTitle>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tab} onChange={handleTabChange} variant="fullWidth">
                    <Tab label="Issue Ticket" />
                    <Tab label="Scan Ticket" />
                </Tabs>
            </Box>

            <DialogContent sx={{ minHeight: 400 }}>
                {/* ISSUE TAB */}
                <TabPanel value={tab} index={0}>
                    {issueError && <Alert severity="error" sx={{ mb: 2 }}>{issueError}</Alert>}

                    {issueResult ? (
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                            <Typography variant="h6">Ticket Issued Successfully!</Typography>
                            <Typography variant="h3" sx={{ my: 2, fontFamily: 'monospace', letterSpacing: 4 }}>
                                {issueResult.ticket_code}
                            </Typography>
                            <Typography>Passenger: {issueResult.passenger_name || 'Unknown'}</Typography>
                            <Typography>Seat: {issueResult.seat_number || 'Unassigned'}</Typography>
                            <Button
                                variant="contained"
                                color="inherit"
                                sx={{ mt: 3, color: 'success.main' }}
                                onClick={() => setIssueResult(null)}
                            >
                                Issue Another
                            </Button>
                        </Paper>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                label="Passenger Name (Optional)"
                                value={issueData.passenger_name}
                                onChange={e => setIssueData({ ...issueData, passenger_name: e.target.value })}
                                fullWidth
                            />
                            <TextField
                                label="Seat Number (Optional)"
                                value={issueData.seat_number}
                                onChange={e => setIssueData({ ...issueData, seat_number: e.target.value })}
                                fullWidth
                            />
                            <Alert severity="info" sx={{ mt: 1 }}>
                                Price is determined automatically from the route fare.
                            </Alert>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={handleIssueTicket}
                                disabled={loading}
                                sx={{ py: 1.5, mt: 2 }}
                            >
                                {loading ? <CircularProgress size={24} /> : "Print & Issue Ticket"}
                            </Button>
                        </Box>
                    )}
                </TabPanel>

                {/* SCAN TAB */}
                <TabPanel value={tab} index={1}>
                    {scanError && <Alert severity="error" sx={{ mb: 2 }}>{scanError}</Alert>}

                    <Box sx={{ display: 'flex', gap: 1, mb: 4 }}>
                        <TextField
                            label="Enter 8-Character Ticket Code"
                            value={scanCode}
                            onChange={e => setScanCode(e.target.value.toUpperCase())}
                            fullWidth
                            autoFocus={tab === 1}
                            inputProps={{ maxLength: 8, style: { textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: 2, fontSize: '1.2rem' } }}
                            onKeyPress={(e) => { if (e.key === 'Enter') handleScanTicket(); }}
                        />
                        <Button
                            variant="contained"
                            onClick={handleScanTicket}
                            disabled={loading || scanCode.length < 8}
                            sx={{ minWidth: 100 }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : "Verify"}
                        </Button>
                    </Box>

                    {scanResult && (
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                            <Typography variant="h5" sx={{ mb: 1 }}>VALID TICKET</Typography>
                            <Typography>Code: <strong>{scanResult.ticket_code}</strong></Typography>
                            <Typography>Passenger: {scanResult.passenger_name || 'Unknown'}</Typography>
                            <Typography>Seat: {scanResult.seat_number || 'Unassigned'}</Typography>
                            <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>Marked as USED</Typography>
                        </Paper>
                    )}

                </TabPanel>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} size="large">Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default DriverTicketModal;
