'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Avatar,
  AvatarGroup,
  Chip,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Groups as GroupsIcon, ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import type { TeamWithMembers } from '@/types/project';

export default function TeamsPage() {
  const router = useRouter();
  const theme = useTheme();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Failed to load teams');
      const data = await response.json();
      setTeams(data.teams || []);
      setError(null);
    } catch (err) {
      setError('Failed to load teams');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: theme.palette.text.primary,
              mb: 1,
            }}
          >
            Teams
          </Typography>
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
            View team workloads and tasks across all projects
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {teams.length === 0 ? (
          <Paper
            sx={{
              p: 6,
              textAlign: 'center',
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <GroupsIcon sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 1 }}>
              No teams yet
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Teams can be created by company admins from the Admin Dashboard.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {teams.map((team) => (
              <Grid item xs={12} sm={6} md={4} key={team.id}>
                <Paper
                  onClick={() => router.push(`/teams/${team.id}`)}
                  sx={{
                    p: 3,
                    cursor: 'pointer',
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: team.color,
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 12px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'}`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        backgroundColor: team.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <GroupsIcon sx={{ color: '#fff', fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: theme.palette.text.primary,
                          fontSize: '1rem',
                        }}
                      >
                        {team.name}
                      </Typography>
                      <Chip
                        label={`${team.member_count} member${team.member_count !== 1 ? 's' : ''}`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          backgroundColor: theme.palette.action.hover,
                        }}
                      />
                    </Box>
                    <ArrowForwardIcon sx={{ color: theme.palette.text.secondary }} />
                  </Box>

                  {team.description && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.secondary,
                        mb: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {team.description}
                    </Typography>
                  )}

                  {team.members && team.members.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AvatarGroup
                        max={5}
                        sx={{
                          '& .MuiAvatar-root': {
                            width: 28,
                            height: 28,
                            fontSize: '0.75rem',
                            border: `2px solid ${theme.palette.background.paper}`,
                          },
                        }}
                      >
                        {team.members.map((member) => (
                          <Tooltip
                            key={member.id}
                            title={member.user?.name || member.user?.email || 'Unknown'}
                          >
                            <Avatar sx={{ bgcolor: team.color }}>
                              {(member.user?.name || member.user?.email || '?')[0].toUpperCase()}
                            </Avatar>
                          </Tooltip>
                        ))}
                      </AvatarGroup>
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}

