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
  Skeleton,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { Comment as CommentIcon } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface RecentComment {
  id: string;
  content: string;
  created_at: string;
  task_id: string;
  commenter: {
    id: string;
    name: string | null;
    email: string;
    avatar_url?: string | null;
  } | null;
  task: {
    id: string;
    title: string;
    project_id: string;
  } | null;
  project: {
    id: string;
    name: string;
  } | null;
}

interface RecentCommentsCardProps {
  initialComments?: RecentComment[];
}

/**
 * RecentCommentsCard Component
 * Displays recent comments on tasks assigned to the current user
 */
export default function RecentCommentsCard({ initialComments }: RecentCommentsCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const [comments, setComments] = useState<RecentComment[]>(initialComments || []);
  const [loading, setLoading] = useState(!initialComments);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialComments) return;

    const fetchComments = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/dashboard/recent-comments?limit=10');
        if (response.ok) {
          const data = await response.json();
          setComments(data.comments || []);
        } else {
          setError('Failed to load comments');
        }
      } catch (err) {
        setError('Failed to load comments');
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [initialComments]);

  const stripHtml = (html: string): string => {
    return html.replace(/<[^>]*>/g, '');
  };

  const truncateText = (text: string, maxLength: number): string => {
    const stripped = stripHtml(text);
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
  };

  const handleCommentClick = (comment: RecentComment) => {
    if (comment.task?.project_id && comment.task_id) {
      router.push(`/project-management/${comment.task.project_id}?taskId=${comment.task_id}`);
    }
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
        <Skeleton variant="text" width={150} height={32} />
        <Box sx={{ mt: 2 }}>
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="80%" />
              </Box>
            </Box>
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <CommentIcon sx={{ color: theme.palette.text.secondary }} />
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Recent Comments
        </Typography>
      </Box>

      {comments.length === 0 ? (
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
            No recent comments on your tasks.
          </Typography>
        </Box>
      ) : (
        <List disablePadding sx={{ flexGrow: 1, overflow: 'auto' }}>
          {comments.map((comment) => (
            <ListItem
              key={comment.id}
              onClick={() => handleCommentClick(comment)}
              alignItems="flex-start"
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
              <ListItemAvatar sx={{ minWidth: 48 }}>
                <Avatar
                  src={comment.commenter?.avatar_url || undefined}
                  alt={comment.commenter?.name || comment.commenter?.email || 'User'}
                  sx={{ width: 36, height: 36 }}
                >
                  {(comment.commenter?.name || comment.commenter?.email || '?')
                    .charAt(0)
                    .toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {comment.commenter?.name || comment.commenter?.email || 'Unknown'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.secondary,
                        mb: 0.5,
                      }}
                    >
                      {truncateText(comment.content, 100)}
                    </Typography>
                    {comment.task && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: theme.palette.text.disabled,
                          display: 'block',
                        }}
                      >
                        on &quot;{comment.task.title}&quot;
                        {comment.project && ` • ${comment.project.name}`}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}

