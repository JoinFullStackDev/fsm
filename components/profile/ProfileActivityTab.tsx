'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
} from '@mui/material';
import {
  Create as CreateIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  AutoAwesome as AIIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { ActivityLog } from '@/types/project';

export default function ProfileActivityTab() {
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (!userData) {
      setLoading(false);
      return;
    }

    const { data: activityData, error: activityError } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (activityError) {
      setError(activityError.message);
      setLoading(false);
      return;
    }

    setActivities((activityData as ActivityLog[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const getActivityIcon = (actionType: string) => {
    if (actionType.includes('project')) return <CreateIcon />;
    if (actionType.includes('export')) return <DownloadIcon />;
    if (actionType.includes('ai')) return <AIIcon />;
    return <CheckCircleIcon />;
  };

  const formatActionType = (actionType: string) => {
    return actionType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600, mb: 3 }}>
        Activity History
      </Typography>

      <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
        <CardContent>
          {activities.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
              No activity yet. Your actions will appear here.
            </Typography>
          ) : (
            <List>
              {activities.map((activity, index) => (
                <Box key={activity.id}>
                  <ListItem>
                    <ListItemIcon sx={{ color: 'primary.main' }}>
                      {getActivityIcon(activity.action_type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                            {formatActionType(activity.action_type)}
                          </Typography>
                          <Chip
                            label={activity.resource_type || 'General'}
                            size="small"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        </Box>
                      }
                      secondary={new Date(activity.created_at).toLocaleString()}
                    />
                  </ListItem>
                  {index < activities.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

