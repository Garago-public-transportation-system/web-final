import { createTheme } from '@mui/material/styles';

const createAppTheme = (direction = 'ltr') => createTheme({
    direction,
    palette: {
        mode: 'light',
        primary: {
            main: '#4f46e5',    // Indigo 600
            light: '#818cf8',   // Indigo 400
            dark: '#3730a3',    // Indigo 800
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#6366f1',    // Indigo 500
            light: '#a5b4fc',   // Indigo 300
            dark: '#4338ca',    // Indigo 700
            contrastText: '#ffffff',
        },
        background: {
            default: '#fafafa', // Warm white
            paper: '#ffffff',
        },
        text: {
            primary: '#09090b',  // Zinc 950
            secondary: '#71717a', // Zinc 500
        },
        error: {
            main: '#ef4444',
        },
        success: {
            main: '#10b981',
        },
        info: {
            main: '#0ea5e9',
        },
        warning: {
            main: '#f59e0b',
        },
    },
    typography: {
        fontFamily: '"Tajawal", "Plus Jakarta Sans", "Inter", sans-serif',
        h1: { fontWeight: 700 },
        h2: { fontWeight: 700 },
        h3: { fontWeight: 700 },
        h4: { fontWeight: 700, letterSpacing: '-0.02em' },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
        subtitle1: { fontWeight: 500 },
        button: { fontWeight: 600 },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    textTransform: 'none',
                    padding: '8px 20px',
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                    },
                    transition: 'box-shadow 0.15s ease, background-color 0.15s ease',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
                elevation1: {
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                },
                elevation2: {
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    backgroundColor: '#ffffff',
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: '#f4f4f5',
                    color: '#52525b',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 700,
                    borderBottom: '1px solid #e4e4e7',
                },
                body: {
                    fontSize: '0.875rem',
                    color: '#27272a',
                },
                root: {
                    borderBottom: '1px solid #f4f4f5',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    transition: 'background-color 0.15s ease',
                    '&:hover': {
                        backgroundColor: '#f5f3ff',
                    },
                },
            },
        },
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    boxShadow: 'none',
                    border: '1px solid #e4e4e7',
                    borderRadius: 10,
                    backgroundColor: '#ffffff',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 10,
                        backgroundColor: '#f4f4f5',
                        transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                        '&.Mui-focused': {
                            backgroundColor: '#ffffff',
                            boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
                        }
                    },
                },
            },
        },
    },
});

export default createAppTheme;
