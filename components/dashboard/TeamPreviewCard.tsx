'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  AvatarGroup,
  Button,
  Skeleton,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { People as PeopleIcon } from '@mui/icons-material';
import { useUser } from '@/components/providers/UserProvider';

interface TeamMember {
  id: string;
  user_id: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar_url?: string | null;
  } | null;
}

interface Team {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  members?: TeamMember[];
  team_members?: TeamMember[];
  member_count?: number;
}

interface TeamPreviewCardProps {
  initialTeams?: Team[];
}

/**
 * TeamPreviewCard Component
 * Displays teams that the current user is a member of
 */
export default function TeamPreviewCard({ initialTeams }: TeamPreviewCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const [teams, setTeams] = useState<Team[]>(initialTeams || []);
  const [loading, setLoading] = useState(!initialTeams);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTeams) return;

    const fetchTeams = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/teams');
        if (response.ok) {
          const data = await response.json();
          setTeams(data.teams || []);
        } else {
          setError('Failed to load teams');
        }
      } catch (err) {
        setError('Failed to load teams');
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [initialTeams]);

  // Filter teams to only those the current user is a member of
  const userTeams = teams.filter((team) => {
    const members = team.members || team.team_members || [];
    return members.some((member) => {
      const memberUser = member.user;
      return member.user_id === user?.id || memberUser?.id === user?.id;
    });
  });

  const getTeamColor = (team: Team): string => {
    if (team.color) return team.color;
    // Generate a consistent color based on team name
    const colors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.info.main,
    ];
    const index = team.name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          height: '100%',
        }}
      >
        <Skeleton variant="text" width={120} height={32} />
        <Box sx={{ mt: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
          ))}
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          height: '100%',
        }}
      >
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: 3,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleIcon sx={{ color: theme.palette.text.secondary }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            My Teams
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={() => router.push('/teams')}
          sx={{ color: theme.palette.text.secondary }}
        >
          View All
        </Button>
      </Box>

      {userTeams.length === 0 ? (
        <Box
          sx={{
            py: 4,
            textAlign: 'center',
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            You are not a member of any teams yet.
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {userTeams.slice(0, 5).map((team) => {
            const members = team.members || team.team_members || [];
            const teamColor = getTeamColor(team);

            return (
              <ListItem
                key={team.id}
                onClick={() => router.push(`/teams/${team.id}`)}
                sx={{
                  px: 0,
                  py: 1.5,
                  cursor: 'pointer',
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                    mx: -2,
                    px: 2,
                  },
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      backgroundColor: teamColor + '20',
                      color: teamColor,
                      width: 40,
                      height: 40,
                    }}
                  >
                    {team.name.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {team.name}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {team.member_count || members.length} member
                      {(team.member_count || members.length) !== 1 ? 's' : ''}
                    </Typography>
                  }
                />
                {members.length > 0 && (
                  <AvatarGroup
                    max={3}
                    sx={{
                      '& .MuiAvatar-root': {
                        width: 24,
                        height: 24,
                        fontSize: '0.75rem',
                        border: `2px solid ${theme.palette.background.paper}`,
                      },
                    }}
                  >
                    {members.slice(0, 4).map((member) => {
                      const memberUser = member.user;
                      return (
                        <Avatar
                          key={member.id}
                          src={memberUser?.avatar_url || undefined}
                          alt={memberUser?.name || memberUser?.email || ''}
                        >
                          {(memberUser?.name || memberUser?.email || '?').charAt(0).toUpperCase()}
                        </Avatar>
                      );
                    })}
                  </AvatarGroup>
                )}
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
}

