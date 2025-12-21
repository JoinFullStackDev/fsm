'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Collapse,
  Chip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Campaign as CampaignIcon,
  NewReleases as NewReleasesIcon,
  Info as InfoIcon,
  Build as BuildIcon,
} from '@mui/icons-material';

interface PlatformUpdate {
  id: string;
  type: 'feature' | 'announcement' | 'maintenance' | 'tip';
  title: string;
  message: string;
  date: string;
}

// Sample platform updates - in production, fetch from API
const PLATFORM_UPDATES: PlatformUpdate[] = [
  {
    id: 'update-2024-12-21-1',
    type: 'feature',
    title: 'New Task Management Features',
    message: 'We\'ve added bulk task actions and improved filtering options in the Task Management view.',
    date: '2024-12-21',
  },
  {
    id: 'update-2024-12-20-1',
    type: 'announcement',
    title: 'Holiday Support Hours',
    message: 'Our support team will have limited availability from Dec 24-26. Response times may be longer than usual.',
    date: '2024-12-20',
  },
];

const DISMISSED_KEY = 'fsm_dismissed_platform_updates';

function getIcon(type: PlatformUpdate['type']) {
  switch (type) {
    case 'feature':
      return <NewReleasesIcon fontSize="small" />;
    case 'announcement':
      return <CampaignIcon fontSize="small" />;
    case 'maintenance':
      return <BuildIcon fontSize="small" />;
    case 'tip':
      return <InfoIcon fontSize="small" />;
    default:
      return <InfoIcon fontSize="small" />;
  }
}

function getTypeLabel(type: PlatformUpdate['type']) {
  switch (type) {
    case 'feature':
      return 'New Feature';
    case 'announcement':
      return 'Announcement';
    case 'maintenance':
      return 'Maintenance';
    case 'tip':
      return 'Pro Tip';
    default:
      return 'Update';
  }
}

/**
 * PlatformUpdatesSection Component
 * Displays dismissible platform updates and announcements on the dashboard
 */
export default function PlatformUpdatesSection() {
  const theme = useTheme();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load dismissed updates from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(newDismissed));
    } catch {
      // Ignore localStorage errors
    }
  };

  // Filter out dismissed updates
  const visibleUpdates = PLATFORM_UPDATES.filter(
    (update) => !dismissedIds.includes(update.id)
  );

  // Don't render anything until mounted (to avoid hydration mismatch)
  if (!mounted || visibleUpdates.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="subtitle2"
        sx={{
          color: theme.palette.text.secondary,
          fontWeight: 600,
          mb: 2,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <CampaignIcon sx={{ fontSize: '1rem' }} />
        Platform Updates
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {visibleUpdates.map((update) => (
          <Collapse key={update.id} in={!dismissedIds.includes(update.id)}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  borderColor: alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                  flexShrink: 0,
                }}
              >
                {getIcon(update.type)}
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                      lineHeight: 1.3,
                    }}
                  >
                    {update.title}
                  </Typography>
                  <Chip
                    label={getTypeLabel(update.type)}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      '& .MuiChip-label': {
                        px: 1,
                      },
                    }}
                  />
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                  }}
                >
                  {update.message}
                </Typography>
              </Box>

              {/* Dismiss Button */}
              <IconButton
                size="small"
                onClick={() => handleDismiss(update.id)}
                sx={{
                  color: theme.palette.text.secondary,
                  opacity: 0.6,
                  flexShrink: 0,
                  '&:hover': {
                    opacity: 1,
                    backgroundColor: alpha(theme.palette.text.primary, 0.08),
                  },
                }}
                aria-label="Dismiss update"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Paper>
          </Collapse>
        ))}
      </Box>
    </Box>
  );
}

