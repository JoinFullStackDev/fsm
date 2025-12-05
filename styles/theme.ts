'use client';

import { PaletteMode, ThemeOptions } from '@mui/material';

// Design tokens generator for light and dark modes
export const getDesignTokens = (mode: PaletteMode): ThemeOptions => {
  const isDark = mode === 'dark';

  return {
    palette: {
      mode,
      primary: {
        main: isDark ? '#FFFFFF' : '#1a1a1a',
        light: isDark ? '#FFFFFF' : '#333333',
        dark: isDark ? '#CCCCCC' : '#000000',
        contrastText: isDark ? '#000000' : '#FFFFFF',
      },
      secondary: {
        main: isDark ? '#FFFFFF' : '#1a1a1a',
        light: isDark ? '#FFFFFF' : '#333333',
        dark: isDark ? '#CCCCCC' : '#000000',
        contrastText: isDark ? '#000000' : '#FFFFFF',
      },
      success: {
        main: isDark ? '#4CAF50' : '#2E7D32',
        light: isDark ? '#81C784' : '#4CAF50',
        dark: isDark ? '#388E3C' : '#1B5E20',
        contrastText: '#FFFFFF',
      },
      warning: {
        main: isDark ? '#FF9800' : '#ED6C02',
        light: isDark ? '#FFB74D' : '#FF9800',
        dark: isDark ? '#F57C00' : '#E65100',
        contrastText: isDark ? '#000000' : '#FFFFFF',
      },
      error: {
        main: isDark ? '#F44336' : '#D32F2F',
        light: isDark ? '#E57373' : '#EF5350',
        dark: isDark ? '#D32F2F' : '#C62828',
        contrastText: '#FFFFFF',
      },
      info: {
        main: isDark ? '#2196F3' : '#0288D1',
        light: isDark ? '#64B5F6' : '#03A9F4',
        dark: isDark ? '#1976D2' : '#01579B',
        contrastText: '#FFFFFF',
      },
      background: {
        default: isDark ? '#000' : '#FAFAFA',
        paper: isDark ? '#101010' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#FFFFFF' : '#1a1a1a',
        secondary: isDark ? '#A1A1AA' : '#666666',
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      action: {
        hover: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
        selected: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        disabled: isDark ? 'rgba(255,255,255,0.26)' : 'rgba(0,0,0,0.26)',
        disabledBackground: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      },
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
      },
      h2: {
        fontFamily: 'var(--font-rubik), Rubik, sans-serif',
        fontWeight: 700,
      },
      h3: {
        fontFamily: 'var(--font-rubik), Rubik, sans-serif',
        fontWeight: 600,
      },
      h4: {
        fontFamily: 'var(--font-rubik), Rubik, sans-serif',
        fontWeight: 600,
        fontSize: '1.25rem',
      },
      h5: {
        fontFamily: 'var(--font-rubik), Rubik, sans-serif',
        fontWeight: 600,
      },
      h6: {
        fontFamily: 'var(--font-rubik), Rubik, sans-serif',
        fontWeight: 600,
      },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: 'background-color 0.3s ease, color 0.3s ease',
          },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            backgroundImage: 'none',
            borderRadius: 4,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.08)',
            transition: 'all 0.3s ease',
            '&:hover': {
              borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)',
              boxShadow: isDark ? '0 6px 30px rgba(0,0,0,0.5)' : '0 6px 30px rgba(0,0,0,0.12)',
            },
            '&::before': {
              backgroundImage: 'none',
            },
          }),
        },
      },

      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            textTransform: 'none' as const,
            fontWeight: 600,
            padding: '5px 20px',
            transition: 'all 0.3s ease',
          },
          // Text buttons use text.primary color
          text: ({ theme }) => ({
            color: theme.palette.text.primary,
          }),
          // Outlined buttons use text.primary color
          outlined: ({ theme }) => ({
            color: theme.palette.text.primary,
            borderColor: theme.palette.divider,
            '&:hover': {
              borderColor: theme.palette.text.secondary,
              backgroundColor: theme.palette.action.hover,
            },
          }),
          // Contained default (not primary/secondary) buttons
          contained: ({ theme }) => ({
            backgroundColor: isDark ? '#1a1a1a' : '#1a1a1a',
            color: '#FFFFFF',
            boxShadow: isDark ? '0 4px 15px rgba(0,0,0,0.4)' : '0 4px 15px rgba(0,0,0,0.1)',
            '&:hover': {
              backgroundColor: isDark ? '#2A2A2D' : '#333333',
              boxShadow: isDark ? '0 6px 25px rgba(0,0,0,0.6)' : '0 6px 25px rgba(0,0,0,0.15)',
              transform: 'translateY(-2px)',
            },
          }),
          // Contained primary buttons - ensure proper contrast
          containedPrimary: ({ theme }) => ({
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
            },
          }),
          // Contained secondary buttons
          containedSecondary: ({ theme }) => ({
            backgroundColor: theme.palette.secondary.main,
            color: theme.palette.secondary.contrastText,
            '&:hover': {
              backgroundColor: theme.palette.secondary.dark,
            },
          }),
        },
      },

      MuiTextField: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            '& .MuiOutlinedInput-root': {
              borderRadius: 4,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              transition: 'all 0.3s ease',
              backgroundImage: 'none',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              },
              '&.Mui-focused': {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                '& fieldset': {
                  borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.24)',
                  borderWidth: 2,
                },
              },
              '& fieldset': {
                borderColor: theme.palette.divider,
              },
            },
            '& .MuiInputLabel-root': {
              color: theme.palette.text.secondary,
              '&.Mui-focused': {
                color: theme.palette.text.primary,
              },
            },
          }),
        },
      },

      MuiChip: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 4,
            fontWeight: 500,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            color: theme.palette.text.primary,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)'}`,
            backgroundImage: 'none',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              borderColor: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.2)',
            },
          }),
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            borderBottom: `1px solid ${theme.palette.divider}`,
            boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.06)',
            backgroundImage: 'none',
          }),
        },
      },

      MuiAccordion: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: isDark ? '#111113' : '#FAFAFA',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: '4px !important',
            marginBottom: 2,
            backgroundImage: 'none',
            '&:before': { display: 'none' },
            '&.Mui-expanded': {
              margin: '16px 0',
              borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)',
            },
          }),
        },
      },

      MuiAccordionSummary: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            borderRadius: '4px 4px 0 0',
            backgroundImage: 'none',
            '&.Mui-expanded': {
              borderRadius: '4px 4px 0 0',
            },
          }),
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },

      MuiDialog: {
        styleOverrides: {
          root: {
            '& .MuiPaper-root': {
              backgroundImage: 'none',
            },
          },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          root: {
            '& .MuiPaper-root': {
              backgroundImage: 'none',
            },
          },
        },
      },

      MuiPopover: {
        styleOverrides: {
          root: {
            '& .MuiPaper-root': {
              backgroundImage: 'none',
            },
          },
        },
      },

      MuiMenu: {
        styleOverrides: {
          root: {
            '& .MuiPaper-root': {
              backgroundImage: 'none',
            },
          },
        },
      },

      MuiSelect: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },

      MuiInputBase: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },

      MuiTypography: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.primary,
          }),
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderColor: theme.palette.divider,
          }),
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderColor: theme.palette.divider,
          }),
        },
      },

      MuiSwitch: {
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiSwitch-switchBase.Mui-checked': {
              color: theme.palette.text.primary,
            },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
              backgroundColor: theme.palette.text.secondary,
            },
          }),
        },
      },

      MuiTab: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.secondary,
            '&.Mui-selected': {
              color: theme.palette.text.primary,
            },
          }),
        },
      },

      MuiTabs: {
        styleOverrides: {
          indicator: ({ theme }) => ({
            backgroundColor: theme.palette.text.primary,
          }),
        },
      },

      MuiListItemIcon: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.primary,
          }),
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.primary,
          }),
        },
      },
    },
  };
};

// Default export for backward compatibility (dark theme)
const theme = getDesignTokens('dark');
export default theme;
