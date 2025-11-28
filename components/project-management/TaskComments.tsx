'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Send as SendIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import type { TaskComment, ProjectTask, ProjectTaskExtended } from '@/types/project';
import type { User } from '@/types/project';
import RichTextEditor from './RichTextEditor';

interface TaskCommentsProps {
  taskId: string | null;
  projectMembers?: User[];
  allTasks?: (ProjectTask | ProjectTaskExtended)[];
  currentUserId: string;
  onCommentAdd?: (comment: TaskComment) => void;
  onCommentUpdate?: (commentId: string, content: string) => void;
  onCommentDelete?: (commentId: string) => void;
}

export default function TaskComments({
  taskId,
  projectMembers = [],
  allTasks = [],
  currentUserId,
  onCommentAdd,
  onCommentUpdate,
  onCommentDelete,
}: TaskCommentsProps) {
  const theme = useTheme();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; commentId: string } | null>(null);

  // Extract unique users from task assignees and project members
  const availableUsers = useMemo(() => {
    const userMap = new Map<string, User>();
    
    // Add project members if provided
    projectMembers.forEach((member) => {
      userMap.set(member.id, member);
    });
    
    // Extract assignees from all tasks
    allTasks.forEach((task) => {
      const assignee = (task as ProjectTaskExtended).assignee;
      if (assignee) {
        userMap.set(assignee.id, {
          id: assignee.id,
          auth_id: '',
          email: assignee.email,
          name: assignee.name,
          role: 'pm' as const,
          created_at: '',
          avatar_url: assignee.avatar_url,
        });
      }
    });
    
    // Also extract users from comments
    comments.forEach((comment) => {
      if (comment.user) {
        userMap.set(comment.user.id, {
          id: comment.user.id,
          auth_id: '',
          email: comment.user.email,
          name: comment.user.name,
          role: 'pm' as const,
          created_at: '',
          avatar_url: comment.user.avatar_url,
        });
      }
    });
    
    return Array.from(userMap.values());
  }, [projectMembers, allTasks, comments]);

  const loadComments = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/tasks/${taskId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      // Failed to load comments
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (taskId) {
      loadComments();
    } else {
      setComments([]);
    }
  }, [taskId, loadComments]);

  const handleMentionSelect = (userId: string, userName: string) => {
    // Add user to mentioned list if not already present
    setMentionedUserIds((prev) => {
      if (!prev.includes(userId)) {
        return [...prev, userId];
      }
      return prev;
    });
  };

  const handleSubmit = async () => {
    if (!taskId || !newComment.trim()) return;

    setSubmitting(true);
    try {
      const requestBody = {
        content: newComment,
        mentioned_user_ids: mentionedUserIds,
      };

      const response = await fetch(`/api/projects/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        setComments([...comments, data.comment]);
        setNewComment('');
        setMentionedUserIds([]); // Reset mentions after submission
        if (onCommentAdd) {
          onCommentAdd(data.comment);
        }
      }
    } catch (error) {
      // Failed to add comment
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingCommentId || !editContent.trim()) return;

    try {
      const response = await fetch(`/api/projects/tasks/${taskId}/comments/${editingCommentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments(comments.map((c) => (c.id === editingCommentId ? data.comment : c)));
        setEditingCommentId(null);
        setEditContent('');
        if (onCommentUpdate) {
          onCommentUpdate(editingCommentId, editContent);
        }
      }
    } catch (error) {
      // Failed to update comment
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await fetch(`/api/projects/tasks/${taskId}/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setComments(comments.filter((c) => c.id !== commentId));
        if (onCommentDelete) {
          onCommentDelete(commentId);
        }
      }
    } catch (error) {
      // Failed to delete comment
    }
    setMenuAnchor(null);
  };

  const startEditing = (comment: TaskComment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
    setMenuAnchor(null);
  };

  const renderMentions = (content: string, mentionedUserIds: string[]) => {
    let result = content;
    mentionedUserIds.forEach((userId) => {
      const user = availableUsers.find((m) => m.id === userId);
      if (user) {
        const name = user.name || user.email;
        result = result.replace(
          new RegExp(`@${name}`, 'gi'),
          `<span style="color: ${theme.palette.text.primary}; font-weight: 600;">@${name}</span>`
        );
      }
    });
    return result;
  };

  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          color: theme.palette.text.primary,
          fontWeight: 600,
          mb: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontSize: '0.75rem',
        }}
      >
        Comments ({comments.length})
      </Typography>

      {/* Comments List */}
      <Box sx={{ mb: 3, maxHeight: 400, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} sx={{ color: theme.palette.text.primary }} />
          </Box>
        ) : comments.length === 0 ? (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic', p: 2 }}>
            No comments yet. Be the first to comment!
          </Typography>
        ) : (
          comments.map((comment) => (
            <Paper
              key={comment.id}
              sx={{
                p: 2,
                mb: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
              }}
            >
              {editingCommentId === comment.id ? (
                <Box>
                  <RichTextEditor 
                    value={editContent} 
                    onChange={setEditContent}
                    projectMembers={availableUsers}
                  />
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: 'flex-end' }}>
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => setEditingCommentId(null)} 
                      sx={{ 
                        borderColor: theme.palette.text.primary,
                        color: theme.palette.text.primary,
                        '&:hover': {
                          borderColor: theme.palette.text.primary,
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleEdit}
                      sx={{
                        borderColor: theme.palette.text.primary,
                        color: theme.palette.text.primary,
                        '&:hover': {
                          borderColor: theme.palette.text.primary,
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      Save
                    </Button>
                  </Box>
                </Box>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar
                      src={comment.user?.avatar_url || undefined}
                      sx={{
                        width: 32,
                        height: 32,
                        fontSize: '0.875rem',
                        backgroundColor: theme.palette.text.primary,
                        color: theme.palette.background.default,
                      }}
                    >
                      {(comment.user?.name || comment.user?.email || 'U').substring(0, 2).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                          {comment.user?.name || comment.user?.email || 'Unknown User'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          color: theme.palette.text.primary,
                          '& p': { margin: 0, marginBottom: 1 },
                          '& p:last-child': { marginBottom: 0 },
                        }}
                        dangerouslySetInnerHTML={{ __html: renderMentions(comment.content, comment.mentioned_user_ids) }}
                      />
                      {comment.mentioned_user_ids.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                          {comment.mentioned_user_ids.map((userId) => {
                            const user = availableUsers.find((m) => m.id === userId);
                            return user ? (
                              <Chip
                                key={userId}
                                label={`@${user.name || user.email}`}
                                size="small"
                                sx={{
                                  backgroundColor: theme.palette.action.hover,
                                  color: theme.palette.text.primary,
                                  border: `1px solid ${theme.palette.divider}`,
                                  fontSize: '0.7rem',
                                  height: 20,
                                }}
                              />
                            ) : null;
                          })}
                        </Box>
                      )}
                    </Box>
                    {comment.user_id === currentUserId && (
                      <IconButton
                        size="small"
                        onClick={(e) => setMenuAnchor({ element: e.currentTarget, commentId: comment.id })}
                        sx={{ 
                          color: theme.palette.text.primary,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </>
              )}
            </Paper>
          ))
        )}
      </Box>

      {/* Add Comment */}
      <Box>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          Add a comment (use @ to mention team members)
        </Typography>
        <RichTextEditor 
          value={newComment} 
          onChange={setNewComment} 
          placeholder="Type @ to mention someone..."
          projectMembers={availableUsers}
          onMentionSelect={handleMentionSelect}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button
            variant="outlined"
            startIcon={submitting ? <CircularProgress size={16} sx={{ color: theme.palette.text.primary }} /> : <SendIcon />}
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              fontWeight: 600,
              '&:hover': { 
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
              '&:disabled': { 
                borderColor: theme.palette.divider,
                color: theme.palette.text.secondary,
              },
            }}
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </Button>
        </Box>
      </Box>

      {/* Comment Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            const comment = comments.find((c) => c.id === menuAnchor?.commentId);
            if (comment) startEditing(comment);
          }}
          sx={{
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <EditIcon sx={{ mr: 1, fontSize: 18 }} /> Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) handleDelete(menuAnchor.commentId);
          }}
          sx={{ 
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 18 }} /> Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}

