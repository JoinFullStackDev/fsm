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
      console.error('Failed to load comments:', error);
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
    console.log('[TaskComments] Mention selected:', { userId, userName });
    // Add user to mentioned list if not already present
    setMentionedUserIds((prev) => {
      if (!prev.includes(userId)) {
        const updated = [...prev, userId];
        console.log('[TaskComments] Updated mentionedUserIds:', updated);
        return updated;
      }
      console.log('[TaskComments] User already in mentions list');
      return prev;
    });
  };

  const handleSubmit = async () => {
    if (!taskId || !newComment.trim()) return;

    console.log('[TaskComments] Submitting comment:', {
      taskId,
      contentLength: newComment.length,
      mentionedUserIds,
      mentionedUserIdsCount: mentionedUserIds.length,
    });

    setSubmitting(true);
    try {
      const requestBody = {
        content: newComment,
        mentioned_user_ids: mentionedUserIds,
      };
      console.log('[TaskComments] Request body:', requestBody);

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
      console.error('Failed to add comment:', error);
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
      console.error('Failed to update comment:', error);
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
      console.error('Failed to delete comment:', error);
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
          `<span style="color: #00E5FF; font-weight: 600;">@${name}</span>`
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
          color: '#00E5FF',
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
            <CircularProgress size={24} />
          </Box>
        ) : comments.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#B0B0B0', fontStyle: 'italic', p: 2 }}>
            No comments yet. Be the first to comment!
          </Typography>
        ) : (
          comments.map((comment) => (
            <Paper
              key={comment.id}
              sx={{
                p: 2,
                mb: 2,
                backgroundColor: 'rgba(0, 229, 255, 0.03)',
                border: '1px solid rgba(0, 229, 255, 0.1)',
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
                    <Button size="small" onClick={() => setEditingCommentId(null)} sx={{ color: '#B0B0B0' }}>
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleEdit}
                      sx={{
                        backgroundColor: '#00E5FF',
                        color: '#000',
                        '&:hover': { backgroundColor: '#00B2CC' },
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
                        backgroundColor: 'rgba(0, 229, 255, 0.2)',
                        color: '#00E5FF',
                      }}
                    >
                      {(comment.user?.name || comment.user?.email || 'U').substring(0, 2).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" sx={{ color: '#E0E0E0', fontWeight: 600 }}>
                          {comment.user?.name || comment.user?.email || 'Unknown User'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          color: '#E0E0E0',
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
                                  backgroundColor: 'rgba(0, 229, 255, 0.15)',
                                  color: '#00E5FF',
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
                        sx={{ color: '#B0B0B0' }}
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
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
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
            variant="contained"
            startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            sx={{
              backgroundColor: '#00E5FF',
              color: '#000',
              fontWeight: 600,
              '&:hover': { backgroundColor: '#00B2CC' },
              '&:disabled': { backgroundColor: 'rgba(0, 229, 255, 0.3)' },
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
      >
        <MenuItem
          onClick={() => {
            const comment = comments.find((c) => c.id === menuAnchor?.commentId);
            if (comment) startEditing(comment);
          }}
        >
          <EditIcon sx={{ mr: 1, fontSize: 18 }} /> Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) handleDelete(menuAnchor.commentId);
          }}
          sx={{ color: '#FF6B6B' }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 18 }} /> Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}

