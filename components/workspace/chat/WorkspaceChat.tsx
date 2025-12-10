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
  Drawer,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Send as SendIcon,
  ChatBubble as ChatBubbleIcon,
  Menu as MenuIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import { consumeStream, parseActionBlocks } from '@/lib/utils/streamingClient';
import { getCsrfHeaders } from '@/lib/utils/csrfClient';
import MessageBubble from './MessageBubble';
import SuggestedPrompts from './SuggestedPrompts';
import ConversationList from './ConversationList';
import type { ConversationMessage, WorkspaceConversation } from '@/types/workspace';

interface WorkspaceChatProps {
  projectId: string;
  workspaceId: string;
  hasSpecs: boolean;
  hasEpics: boolean;
  hasTasks: boolean;
  teamMembers?: Array<{ user_id: string; name: string | null; email: string; role: string }>;
}

export default function WorkspaceChat({
  projectId,
  workspaceId,
  hasSpecs,
  hasEpics,
  hasTasks,
  teamMembers = [],
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  // Load conversations
  // Load specific conversation
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
      
      // Auto-select first conversation
      if (data.length > 0 && !currentConversationId) {
        await loadConversation(data[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setLoading(false);
    }
  }, [projectId, currentConversationId, loadConversation]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);


  // Create new conversation
  const handleNewConversation = async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/conversations`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify({ title: 'New Conversation' }),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const newConv = await response.json();
      setCurrentConversationId(newConv.id);
      setMessages([]);
      await loadConversations();
      setSidebarOpen(false);
    } catch (error) {
      showError('Failed to create conversation');
    }
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
              await fetch(`/api/workspaces/${projectId}/conversations/${currentConversationId}`, {
                method: 'PATCH',
                headers: getCsrfHeaders(),
                body: JSON.stringify({
                  add_message: userMessage,
                }),
              });

              await fetch(`/api/workspaces/${projectId}/conversations/${currentConversationId}`, {
                method: 'PATCH',
                headers: getCsrfHeaders(),
                body: JSON.stringify({
                  add_message: assistantMessage,
                }),
              });
            } else {
              // Create new conversation
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

      // Update action status in messages
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          actions: msg.actions?.map((a) =>
            a === action ? { ...a, status: 'executed' as const, result: result.result } : a
          ),
        }))
      );
    } catch (error) {
      showError('Failed to execute action');
    }
  };

  const handleActionReject = (action: any) => {
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        actions: msg.actions?.map((a) => (a === action ? { ...a, status: 'rejected' as const } : a)),
      }))
    );
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading chat...</Typography>
      </Paper>
    );
  }

  const chatContent = (
    <>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.default,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ChatBubbleIcon sx={{ color: theme.palette.primary.main }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            AI Workspace Assistant
          </Typography>
          {conversations.length > 0 && (
            <Chip label={`${conversations.length} threads`} size="small" />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={() => setFullscreen(!fullscreen)} size="small">
            {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
          <IconButton onClick={() => setSidebarOpen(true)} size="small">
            <MenuIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Messages Area */}
      <Box
        sx={{
          p: 3,
          minHeight: fullscreen ? 'calc(100vh - 200px)' : 400,
          maxHeight: fullscreen ? 'calc(100vh - 200px)' : 600,
          overflow: 'auto',
          backgroundColor: theme.palette.background.paper,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: fullscreen ? 1400 : '100%',
          }}
        >
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

        {isStreaming && !streamingText && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              AI is thinking...
            </Typography>
          </Box>
        )}

          <div ref={messagesEndRef} />
        </Box>
      </Box>

      {/* Input Area */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.default,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
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
            size="small"
          />
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            endIcon={isStreaming ? <CircularProgress size={16} /> : <SendIcon />}
            sx={{ minWidth: 100 }}
          >
            Send
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Press Enter to send, Shift+Enter for new line
        </Typography>
      </Box>

      {/* Conversation Sidebar */}
      <Drawer
        anchor="right"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        PaperProps={{
          sx: { 
            width: 320, 
            p: 3,
            transform: 'translateY(60px) !important',
            maxHeight: 'calc(100vh - 60px)',
          },
        }}
      >
        <ConversationList
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={(id) => {
            loadConversation(id);
            setSidebarOpen(false);
          }}
          onNewConversation={handleNewConversation}
          onArchiveConversation={async (id) => {
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
          }}
        />
      </Drawer>
    </>
  );

  // Fullscreen mode
  if (fullscreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            height: '100%',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {chatContent}
        </Paper>
      </Box>
    );
  }

  // Normal mode
  return (
    <Paper
      elevation={2}
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      {chatContent}
    </Paper>
  );
}
