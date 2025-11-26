'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FFFFFF',
      light: '#FFFFFF',
      dark: '#CCCCCC',
      contrastText: '#000000',
    },
    secondary: {
      main: '#FFFFFF',
      light: '#FFFFFF',
      dark: '#CCCCCC',
      contrastText: '#000000',
    },
    success: {
      main: '#FFFFFF',
      light: '#FFFFFF',
      dark: '#CCCCCC',
      contrastText: '#000000',
    },
    warning: {
      main: '#FFFFFF',
      light: '#FFFFFF',
      dark: '#CCCCCC',
      contrastText: '#000000',
    },
    error: {
      main: '#FFFFFF',
      light: '#FFFFFF',
      dark: '#CCCCCC',
      contrastText: '#000000',
    },
    info: {
      main: '#FFFFFF',
      light: '#FFFFFF',
      dark: '#CCCCCC',
      contrastText: '#000000',
    },
    background: {
      default: '#000',  // deep black background like Linear
      paper: '#101010',    // darker grey cards / modals
    },
    text: {
      primary: '#FFFFFF',   // white text everywhere
      secondary: '#A1A1AA', // subtle gray
    },
    divider: 'rgba(255,255,255,0.08)',
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
      fontFamily: 'var(--font-rubik), Rubik, sans-serif',
      fontWeight: 700, 
      color: '#FFFFFF' 
    },
    h2: { 
      fontFamily: 'var(--font-rubik), Rubik, sans-serif',
      fontWeight: 700, 
      color: '#FFFFFF' 
    },
    h3: { 
      fontFamily: 'var(--font-rubik), Rubik, sans-serif',
      fontWeight: 600, 
      color: '#FFFFFF' 
    },
    h4: { 
      fontFamily: 'var(--font-rubik), Rubik, sans-serif',
      fontWeight: 600, 
      color: '#FFFFFF' 
    },
    h5: { 
      fontFamily: 'var(--font-rubik), Rubik, sans-serif',
      fontWeight: 600, 
      color: '#FFFFFF' 
    },
    h6: { 
      fontFamily: 'var(--font-rubik), Rubik, sans-serif',
      fontWeight: 600, 
      color: '#FFFFFF' 
    },
  },

  components: {
    // @ts-ignore - MuiBox is not in the type definition but works at runtime
    MuiBox: {
      styleOverrides: {
        root: {
          backgroundColor: '#101010 !important',
          backgroundImage: 'none !important',
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#010101 !important',
          backgroundImage: 'none !important',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.16)',
            boxShadow: '0 6px 30px rgba(0,0,0,0.5)',
          },
          // Disable Material-UI's default gradient overlay
          '&::before': {
            backgroundImage: 'none !important',
          },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          textTransform: 'none',
          fontWeight: 600,
          padding: '5px 20px',
          color: '#FFFFFF',
          transition: 'all 0.3s ease',
        },
        contained: {
          backgroundColor: '#010101',
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
          '&:hover': {
            backgroundColor: '#2A2A2D',
            boxShadow: '0 6px 25px rgba(0,0,0,0.6)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          backgroundImage: 'none !important',
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.03)',
            transition: 'all 0.3s ease',
            backgroundImage: 'none !important',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.06)',
            },
            '&.Mui-focused': {
              backgroundColor: 'rgba(255,255,255,0.08)',
              '& fieldset': {
                borderColor: 'rgba(255,255,255,0.16)',
                borderWidth: 2,
              },
            },
            '& fieldset': {
              borderColor: 'rgba(255,255,255,0.08)',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#A1A1AA',
            '&.Mui-focused': {
              color: '#FFFFFF',
            },
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 500,
          backgroundColor: 'rgba(255,255,255,0.08)',
          color: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.16)',
          backgroundImage: 'none !important',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderColor: 'rgba(255,255,255,0.24)',
          },
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#101010',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
          backgroundImage: 'none !important',
        },
      },
    },

    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: '#111113',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '4px !important',
          marginBottom: 2,
          backgroundImage: 'none !important',
          '&:before': { display: 'none' },
          '&.Mui-expanded': {
            margin: '16px 0',
            borderColor: 'rgba(255,255,255,0.16)',
          },
        },
      },
    },

    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: '4px 4px 0 0',
          backgroundImage: 'none !important',
          '&.Mui-expanded': {
            borderRadius: '4px 4px 0 0',
          },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none !important',
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        root: {
          '& .MuiPaper-root': {
            backgroundImage: 'none !important',
          },
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        root: {
          '& .MuiPaper-root': {
            backgroundImage: 'none !important',
          },
        },
      },
    },

    MuiPopover: {
      styleOverrides: {
        root: {
          '& .MuiPaper-root': {
            backgroundImage: 'none !important',
          },
        },
      },
    },

    MuiMenu: {
      styleOverrides: {
        root: {
          '& .MuiPaper-root': {
            backgroundImage: 'none !important',
          },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundImage: 'none !important',
        },
      },
    },

    MuiInputBase: {
      styleOverrides: {
        root: {
          backgroundImage: 'none !important',
        },
      },
    },
  },
});

export default theme;