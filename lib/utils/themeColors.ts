/**
 * Theme color utilities
 * Provides consistent color mappings for replacing hardcoded colors
 */

import type { Theme } from '@mui/material/styles';

/**
 * Common color replacements based on theme.ts
 * Use these mappings when replacing hardcoded colors
 */
export const getThemeColors = (theme: Theme) => ({
  // Text colors
  textPrimary: theme.palette.text.primary,      // '#FFFFFF' - white text
  textSecondary: theme.palette.text.secondary,  // '#A1A1AA' - gray text
  
  // Background colors
  backgroundDefault: '#101010 !important',  // '#000' - deep black
  backgroundPaper: '#101010 !important',      // '#101010 ' - darker grey cards
  
  // Border/divider
  divider: theme.palette.divider,  // 'rgba(255,255,255,0.08)'
  
  // Common replacements for colorful values
  // Old colorful values -> New monochrome theme values
  primary: theme.palette.text.primary,        // #C9354A -> white
  secondary: theme.palette.text.primary,     // #E91E63 -> white
  accent: theme.palette.text.secondary,       // Various -> gray
  error: theme.palette.text.primary,          // #FF1744 -> white (or keep as error)
  success: theme.palette.text.primary,       // #4CAF50 -> white (or keep as success)
});

/**
 * Helper to get rgba color with opacity using theme colors
 */
export const getThemeRgba = (theme: Theme, opacity: number = 0.08) => {
  return `rgba(255, 255, 255, ${opacity})`;
};

