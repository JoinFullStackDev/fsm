'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00E5FF',
      light: '#5DFFFF',
      dark: '#00B2CC',
      contrastText: '#000',
    },
    secondary: {
      main: '#E91E63',
      light: '#FF6090',
      dark: '#B0003A',
      contrastText: '#fff',
    },
    success: {
      main: '#00FF88',
      light: '#5DFFB3',
      dark: '#00CC6A',
      contrastText: '#000',
    },
    warning: {
      main: '#FF6B35',
      light: '#FF9A6B',
      dark: '#CC5500',
      contrastText: '#000',
    },
    error: {
      main: '#FF1744',
      light: '#FF5F7A',
      dark: '#CC0012',
      contrastText: '#fff',
    },
    info: {
      main: '#2196F3',
      light: '#64B5F6',
      dark: '#1976D2',
      contrastText: '#fff',
    },
    background: {
      default: '#000',
      paper: '#000',
    },
    text: {
      primary: '#E0E0E0',
      secondary: '#B0B0B0',
    },
    divider: 'rgba(0, 229, 255, 0.12)',
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 700,
      color: '#00E5FF',
    },
    h2: {
      fontWeight: 700,
      color: '#00E5FF',
    },
    h3: {
      fontWeight: 600,
      color: '#E0E0E0',
    },
    h4: {
      fontWeight: 600,
      color: '#E0E0E0',
    },
    h5: {
      fontWeight: 600,
      color: '#E0E0E0',
    },
    h6: {
      fontWeight: 600,
      color: '#E0E0E0',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1A1F3A',
          borderRadius: 12,
          border: '2px solid rgba(0, 229, 255, 0.2)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: 'rgba(0, 229, 255, 0.4)',
            boxShadow: '0 6px 30px rgba(0, 229, 255, 0.2)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 24px',
          transition: 'all 0.3s ease',
        },
        contained: {
          boxShadow: '0 4px 15px rgba(0, 229, 255, 0.3)',
          '&:hover': {
            boxShadow: '0 6px 25px rgba(0, 229, 255, 0.5)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            },
            '&.Mui-focused': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '& fieldset': {
                borderColor: '#00E5FF',
                borderWidth: 2,
              },
            },
            '& fieldset': {
              borderColor: 'rgba(0, 229, 255, 0.3)',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#B0B0B0',
            '&.Mui-focused': {
              color: '#00E5FF',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          backgroundColor: 'rgba(0, 229, 255, 0.15)',
          color: '#00E5FF',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          '&:hover': {
            backgroundColor: 'rgba(0, 229, 255, 0.25)',
            borderColor: 'rgba(0, 229, 255, 0.5)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#000',
          borderBottom: '2px solid rgba(0, 229, 255, 0.2)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: '#1A1F3A',
          border: '2px solid rgba(0, 229, 255, 0.2)',
          borderRadius: '8px !important',
          marginBottom: 2,
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            margin: '16px 0',
            borderColor: 'rgba(0, 229, 255, 0.4)',
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(0, 229, 255, 0.05)',
          borderRadius: '8px 8px 0 0',
          '&.Mui-expanded': {
            borderRadius: '8px 8px 0 0',
          },
        },
      },
    },
  },
});

export default theme;
