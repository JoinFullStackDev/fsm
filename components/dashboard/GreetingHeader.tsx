'use client';

import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { useUser } from '@/components/providers/UserProvider';

/**
 * Get time of day greeting based on current hour
 */
function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * GreetingHeader Component
 * Displays today's date and a personalized greeting based on time of day
 */
export default function GreetingHeader() {
  const theme = useTheme();
  const { user } = useUser();

  const today = new Date();
  const formattedDate = format(today, 'EEEE, MMMM d, yyyy');
  const greeting = getTimeOfDayGreeting();
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="body2"
        sx={{
          color: theme.palette.text.secondary,
          fontSize: { xs: '0.875rem', md: '1rem' },
          mb: 0.5,
        }}
      >
        {formattedDate}
      </Typography>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          fontWeight: 700,
          color: theme.palette.text.primary,
          fontSize: { xs: '1.5rem', md: '2.125rem' },
        }}
      >
        {greeting}, {userName}
      </Typography>
    </Box>
  );
}

