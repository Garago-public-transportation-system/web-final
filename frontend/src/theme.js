import { createTheme } from '@mui/material/styles';

const getDesignTokens = (mode, direction) => ({
    direction,
    palette: {
        mode,
        ...(mode === 'light'
            ? {
                  // Light Mode Palette: Sapphire & Rose
                  primary: {
                      main: '#0284c7',    // Sky 600 (Sapphire)
                      light: '#38bdf8',   // Sky 400
                      dark: '#0369a1',    // Sky 700
                      contrastText: '#ffffff',
                  },
                  secondary: {
                      main: '#f43f5e',    // Rose 500 (Coral/Rose)
                      light: '#fb7185',   // Rose 400
                      dark: '#be123c',    // Rose 700
                      contrastText: '#ffffff',
                  },
                  background: {
                      default: '#f8fafc', // Slate 50
                      paper: '#ffffff',
                  },
                  text: {
                      primary: '#0f172a',  // Slate 900
                      secondary: '#475569', // Slate 600
                  },
                  divider: '#e2e8f0', // Slate 200
              }
            : {
                  // Dark Mode Palette
                  primary: {
                      main: '#38bdf8',    // Sky 400
                      light: '#7dd3fc',   // Sky 300
                      dark: '#0284c7',    // Sky 600
                      contrastText: '#0f172a',
                  },
                  secondary: {
                      main: '#fb7185',    // Rose 400
                      light: '#fda4af',   // Rose 300
                      dark: '#e11d48',    // Rose 600
                      contrastText: '#0f172a',
                  },
                  background: {
                      default: '#0f172a', // Slate 900
                      paper: '#1e293b',   // Slate 800
                  },
                  text: {
                      primary: '#f8fafc',  // Slate 50
                      secondary: '#94a3b8', // Slate 400
                  },
                  divider: '#334155', // Slate 700
              }),
        error: { main: '#ef4444' },
        success: { main: '#10b981' },
        info: { main: '#3b82f6' },
        warning: { main: '#f59e0b' },
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
});

const getThemedComponents = (theme) => ({
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    textTransform: 'none',
                    padding: '8px 20px',
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: theme.palette.mode === 'light' 
                            ? '0 2px 8px rgba(0,0,0,0.15)' 
                            : '0 2px 8px rgba(0,0,0,0.4)',
                    },
                    transition: 'box-shadow 0.2s ease, background-color 0.2s ease, transform 0.1s ease',
                    '&:active': {
                        transform: 'scale(0.98)',
                    }
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
                elevation1: {
                    boxShadow: theme.palette.mode === 'light' 
                        ? '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' 
                        : '0 4px 6px -1px rgba(0,0,0,0.3)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: theme.palette.mode === 'light' 
                        ? '0 1px 3px rgba(0,0,0,0.06)' 
                        : '0 4px 6px rgba(0,0,0,0.3)',
                    backgroundColor: theme.palette.background.paper,
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: theme.palette.mode === 'light' ? '#f1f5f9' : '#0f172a',
                    color: theme.palette.text.secondary,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 700,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                },
                body: {
                    fontSize: '0.875rem',
                    color: theme.palette.text.primary,
                },
                root: {
                    borderBottom: `1px solid ${theme.palette.divider}`,
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    transition: 'background-color 0.2s ease',
                    '&:hover': {
                        backgroundColor: theme.palette.mode === 'light' ? '#f8fafc' : '#334155',
                    },
                },
            },
        },
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    boxShadow: 'none',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 12,
                    backgroundColor: theme.palette.background.paper,
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 10,
                        backgroundColor: theme.palette.mode === 'light' ? '#f1f5f9' : '#0f172a',
                        transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                        '& fieldset': {
                            borderColor: theme.palette.divider,
                        },
                        '&:hover fieldset': {
                            borderColor: theme.palette.primary.light,
                        },
                        '&.Mui-focused': {
                            backgroundColor: theme.palette.background.paper,
                            boxShadow: `0 0 0 2px ${theme.palette.primary.main}33`,
                            '& fieldset': {
                                borderWidth: '1px',
                                borderColor: theme.palette.primary.main,
                            }
                        }
                    },
                },
            },
        },
    },
});

const createAppTheme = (direction = 'ltr') => {
    const tokens = getDesignTokens('light', direction);
    const theme = createTheme(tokens);
    return createTheme(theme, getThemedComponents(theme));
};

const createDarkTheme = (direction = 'ltr') => {
    const tokens = getDesignTokens('dark', direction);
    const theme = createTheme(tokens);
    return createTheme(theme, getThemedComponents(theme));
};

export { createAppTheme, createDarkTheme };
export default createAppTheme;
