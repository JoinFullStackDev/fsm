'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress,
  IconButton,
  Chip,
  Skeleton,
  Fade,
  Slide,
  Tooltip,
  Fab,
  Zoom,
  Badge,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Send as SendIcon,
  ChatBubble as ChatBubbleIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import { consumeStream, parseActionBlocks } from '@/lib/utils/streamingClient';
import { getCsrfHeaders } from '@/lib/utils/csrfClient';
import MessageBubble from './MessageBubble';
import SuggestedPrompts from './SuggestedPrompts';
import type { ConversationMessage, WorkspaceConversation } from '@/types/workspace';

interface WorkspaceChatProps {
  projectId: string;
  workspaceId?: string;
  hasSpecs?: boolean;
  hasEpics?: boolean;
  hasTasks?: boolean;
  teamMembers?: Array<{ user_id: string; name: string | null; email: string; role: string }>;
  /** "embedded" shows CTA card, "floating" shows FAB button */
  variant?: 'embedded' | 'floating';
}

export default function WorkspaceChat({
  projectId,
  workspaceId,
  hasSpecs = false,
  hasEpics = false,
  hasTasks = false,
  teamMembers = [],
  variant = 'embedded',
}: WorkspaceChatProps) {
  const theme = useTheme();
  const { showError, showSuccess } = useNotification();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [conversations, setConversations] = useState<WorkspaceConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  // Load conversations
  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workspaces/${projectId}/conversations/${conversationId}`);
      if (!response.ok) return;
      
      const data = await response.json();
      setMessages(data.messages || []);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/conversations`);
      if (!response.ok) return;
      
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, [projectId]);

  // Load conversations when opening
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Handle opening the chat
  const handleOpen = () => {
    setIsOpen(true);
  };

  // Handle closing the chat
  const handleClose = () => {
    setIsClosing(true);
  };

  // Handle animation complete
  const handleExited = () => {
    setIsOpen(false);
    setIsClosing(false);
  };

  // Create new conversation
  const handleNewConversation = async () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  // Send message
  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message || isStreaming) return;

    // Add user message immediately
    const userMessage: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      // Stream AI response
      await consumeStream(
        `/api/workspaces/${projectId}/chat`,
        {
          method: 'POST',
          headers: getCsrfHeaders(),
          body: JSON.stringify({
            message,
            conversation_id: currentConversationId,
          }),
        },
        {
          onChunk: (chunk) => {
            if (chunk.text) {
              setStreamingText((prev) => prev + chunk.text);
            }
          },
          onComplete: async (fullText) => {
            // Parse actions from response
            const actions = parseActionBlocks(fullText);

            // Create assistant message
            const assistantMessage: ConversationMessage = {
              role: 'assistant',
              content: fullText,
              timestamp: new Date().toISOString(),
              actions: actions.length > 0
                ? actions.map((a) => ({
                    type: a.type as any,
                    status: 'suggested' as const,
                    data: a.data,
                  }))
                : undefined,
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setStreamingText('');
            setIsStreaming(false);

            // Save to conversation
            if (currentConversationId) {
              // Save user message
              await fetch(`/api/workspaces/${projectId}/conversations/${currentConversationId}`, {
                method: 'PATCH',
                headers: getCsrfHeaders(),
                body: JSON.stringify({
                  add_message: userMessage,
                }),
              });

              // Save assistant message
              await fetch(`/api/workspaces/${projectId}/conversations/${currentConversationId}`, {
                method: 'PATCH',
                headers: getCsrfHeaders(),
                body: JSON.stringify({
                  add_message: assistantMessage,
                }),
              });
            } else {
              // Create new conversation first
              const response = await fetch(`/api/workspaces/${projectId}/conversations`, {
                method: 'POST',
                headers: getCsrfHeaders(),
                body: JSON.stringify({
                  title: message.substring(0, 60),
                }),
              });

              if (response.ok) {
                const newConv = await response.json();
                setCurrentConversationId(newConv.id);

                // Save both messages to the new conversation
                await fetch(`/api/workspaces/${projectId}/conversations/${newConv.id}`, {
                  method: 'PATCH',
                  headers: getCsrfHeaders(),
                  body: JSON.stringify({
                    add_message: userMessage,
                  }),
                });

                await fetch(`/api/workspaces/${projectId}/conversations/${newConv.id}`, {
                  method: 'PATCH',
                  headers: getCsrfHeaders(),
                  body: JSON.stringify({
                    add_message: assistantMessage,
                  }),
                });

                await loadConversations();
              }
            }
          },
          onError: (error) => {
            showError(error.message);
            setIsStreaming(false);
            setStreamingText('');
          },
        }
      );
    } catch (error) {
      showError('Failed to send message');
      setIsStreaming(false);
      setStreamingText('');
    }
  };

  // Handle action confirmation
  const handleActionConfirm = async (action: any) => {
    if (!currentConversationId) return;

    try {
      const response = await fetch(
        `/api/workspaces/${projectId}/conversations/${currentConversationId}/actions`,
        {
          method: 'POST',
          headers: getCsrfHeaders(),
          body: JSON.stringify({
            type: action.type,
            data: action.data,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Action failed');
      }

      const result = await response.json();
      showSuccess(`Action executed: ${action.type}`);

      // Update action status in local messages
      const updatedMessages = messages.map((msg) => ({
        ...msg,
        actions: msg.actions?.map((a) =>
          a === action ? { ...a, status: 'executed' as const, result: result.result } : a
        ),
      }));
      setMessages(updatedMessages);

      // Persist updated action status to database
      await fetch(`/api/workspaces/${projectId}/conversations/${currentConversationId}`, {
        method: 'PATCH',
        headers: getCsrfHeaders(),
        body: JSON.stringify({
          update_messages: updatedMessages,
        }),
      });
    } catch (error) {
      showError('Failed to execute action');
    }
  };

  const handleActionReject = async (action: any) => {
    // Update action status in local messages
    const updatedMessages = messages.map((msg) => ({
      ...msg,
      actions: msg.actions?.map((a) => (a === action ? { ...a, status: 'rejected' as const } : a)),
    }));
    setMessages(updatedMessages);

    // Persist updated action status to database
    if (currentConversationId) {
      try {
        await fetch(`/api/workspaces/${projectId}/conversations/${currentConversationId}`, {
          method: 'PATCH',
          headers: getCsrfHeaders(),
          body: JSON.stringify({
            update_messages: updatedMessages,
          }),
        });
      } catch (error) {
        console.error('Failed to persist rejection status:', error);
      }
    }
  };

  const handleArchiveConversation = async (id: string) => {
    try {
      await fetch(`/api/workspaces/${projectId}/conversations/${id}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
      });
      await loadConversations();
      if (id === currentConversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
    } catch (error) {
      showError('Failed to archive conversation');
    }
  };

  // Collapsed state - show CTA card or floating button based on variant
  if (!isOpen) {
    // Floating variant - show FAB button
    if (variant === 'floating') {
      return (
        <Zoom in={!isOpen || isClosing}>
          <Tooltip title="AI Assistant" placement="left">
            <Fab
              onClick={handleOpen}
              sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 1200,
                width: 64,
                height: 64,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                boxShadow: theme.shadows[8],
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: theme.shadows[16],
                },
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 28, color: 'white' }} />
            </Fab>
          </Tooltip>
        </Zoom>
      );
    }

    // Embedded variant - show CTA card
    return (
      <Paper
        elevation={3}
        onClick={handleOpen}
        sx={{
          p: 3,
          cursor: 'pointer',
          borderRadius: 3,
          border: `2px solid ${theme.palette.divider}`,
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.action.hover} 100%)`,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[12],
            borderColor: theme.palette.primary.main,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: theme.shadows[4],
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 32, color: 'white' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              AI Workspace Assistant
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ask questions, create tasks, log decisions, and get help with your project
            </Typography>
          </Box>
          <Box
            sx={{
              px: 3,
              py: 1.5,
              borderRadius: 2,
              backgroundColor: theme.palette.primary.main,
              color: 'white',
              fontWeight: 600,
            }}
          >
            Open Chat
          </Box>
        </Box>
      </Paper>
    );
  }

  // Fullscreen mode
  return (
    <Fade in={!isClosing} timeout={300} onExited={handleExited} unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          backgroundColor: theme.palette.background.default,
          display: 'flex',
          animation: 'scaleIn 0.3s ease-out',
          '@keyframes scaleIn': {
            '0%': {
              opacity: 0,
              transform: 'scale(0.97)',
            },
            '100%': {
              opacity: 1,
              transform: 'scale(1)',
            },
          },
        }}
      >
        {/* Sidebar with conversations */}
        <Box
          sx={{
            width: 280,
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {/* Sidebar Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Conversations
            </Typography>
            <Tooltip title="New chat">
              <IconButton onClick={handleNewConversation} size="small">
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* New Chat Button */}
          <Box sx={{ p: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleNewConversation}
              sx={{
                justifyContent: 'flex-start',
                borderStyle: 'dashed',
                py: 1.5,
              }}
            >
              New Conversation
            </Button>
          </Box>

          {/* Conversation List */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 1 }}>
            {conversations.map((conv) => (
              <Box
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                sx={{
                  p: 2,
                  mb: 1,
                  borderRadius: 2,
                  cursor: 'pointer',
                  backgroundColor:
                    currentConversationId === conv.id
                      ? theme.palette.action.selected
                      : 'transparent',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: currentConversationId === conv.id ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {conv.title || 'Untitled'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {conv.message_count} message{conv.message_count === 1 ? '' : 's'}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchiveConversation(conv.id);
                  }}
                  sx={{
                    opacity: 0.5,
                    '&:hover': { opacity: 1 },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}

            {conversations.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <ChatBubbleIcon sx={{ fontSize: 40, color: theme.palette.text.disabled, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No conversations yet
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Main Chat Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* Chat Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AutoAwesomeIcon sx={{ color: theme.palette.primary.main }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                AI Workspace Assistant
              </Typography>
            </Box>
            <IconButton onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Messages Area */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Box sx={{ width: '100%', maxWidth: 900 }}>
              {loading ? (
                // Loading skeleton
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                    <Skeleton variant="rounded" width="60%" height={60} sx={{ borderRadius: 2 }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 3 }}>
                    <Box sx={{ width: '75%' }}>
                      <Skeleton variant="text" width="100%" height={24} />
                      <Skeleton variant="text" width="90%" height={24} />
                      <Skeleton variant="text" width="80%" height={24} />
                    </Box>
                  </Box>
                </>
              ) : (
                <>
                  {messages.length === 0 && !isStreaming && (
                    <SuggestedPrompts
                      onSelectPrompt={(prompt) => {
                        setInputValue(prompt);
                      }}
                      hasSpecs={hasSpecs}
                      hasEpics={hasEpics}
                      hasTasks={hasTasks}
                    />
                  )}

                  {messages.map((msg, idx) => (
                    <MessageBubble
                      key={idx}
                      message={msg}
                      teamMembers={teamMembers}
                      onActionConfirm={handleActionConfirm}
                      onActionReject={handleActionReject}
                    />
                  ))}

                  {/* Streaming message */}
                  {isStreaming && streamingText && (
                    <MessageBubble
                      message={{
                        role: 'assistant',
                        content: streamingText,
                        timestamp: new Date().toISOString(),
                      }}
                      teamMembers={teamMembers}
                      onActionConfirm={handleActionConfirm}
                      onActionReject={handleActionReject}
                    />
                  )}

                  {/* Typing indicator */}
                  {isStreaming && !streamingText && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        mb: 2,
                        maxWidth: '80%',
                      }}
                    >
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                          {[0, 0.2, 0.4].map((delay, i) => (
                            <Box
                              key={i}
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: theme.palette.text.secondary,
                                animation: 'pulse 1.4s infinite ease-in-out',
                                animationDelay: `${delay}s`,
                                '@keyframes pulse': {
                                  '0%, 80%, 100%': { opacity: 0.3 },
                                  '40%': { opacity: 1 },
                                },
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </Box>
          </Box>

          {/* Input Area */}
          <Box
            sx={{
              p: 3,
              borderTop: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <Box sx={{ maxWidth: 900, mx: 'auto' }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask me anything about your project..."
                  disabled={isStreaming}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isStreaming}
                  endIcon={isStreaming ? <CircularProgress size={16} /> : <SendIcon />}
                  sx={{
                    minWidth: 120,
                    borderRadius: 3,
                    px: 3,
                  }}
                >
                  Send
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Press Enter to send, Shift+Enter for new line
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Fade>
  );
}
