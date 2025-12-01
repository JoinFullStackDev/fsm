'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  List,
  ListItem,
  CircularProgress,
  Chip,
  Link,
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  SmartToy as AIIcon,
} from '@mui/icons-material';
import type { AIChatInput, AIChatOutput } from '@/types/kb';

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
  organizationId?: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    article_id: string;
    article_title: string;
    article_slug: string;
    relevance_score: number;
  }>;
}

export default function AIChatDrawer({ open, onClose, organizationId }: AIChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/ai/kb/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          conversation_history: conversationHistory,
          organization_id: organizationId,
        } as AIChatInput),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data: AIChatOutput = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400, md: 500 }, display: 'flex', flexDirection: 'column' },
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <AIIcon color="primary" />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          AI Assistant
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
            <AIIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body1">
              Ask me anything about the knowledge base!
            </Typography>
          </Box>
        )}

        <List>
          {messages.map((message, index) => (
            <ListItem
              key={index}
              sx={{
                flexDirection: 'column',
                alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                px: 0,
              }}
            >
              <Paper
                sx={{
                  p: 2,
                  maxWidth: '80%',
                  bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100',
                  color: message.role === 'user' ? 'primary.contrastText' : '#000000',
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: message.role === 'assistant' ? '#000000' : 'inherit' }}>
                  {message.content}
                </Typography>
                {message.sources && message.sources.length > 0 && (
                  <Box 
                    sx={{ 
                      mt: 2, 
                      pt: 2, 
                      borderTop: 1, 
                      borderColor: 'divider',
                    }}
                  >
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: 'block', 
                        mb: 1.5,
                        fontWeight: 600,
                        color: '#666',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontSize: '0.7rem',
                      }}
                    >
                      Sources:
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {message.sources.map((source, idx) => (
                        <Link
                          key={idx}
                          href={`/kb/${source.article_slug}`}
                          sx={{ textDecoration: 'none' }}
                        >
                          <Paper
                            elevation={0}
                            sx={{
                              p: 1.5,
                              bgcolor: '#ffffff',
                              border: '1px solid #e0e0e0',
                              borderRadius: 1,
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: '#f5f5f5',
                                borderColor: '#bdbdbd',
                                transform: 'translateY(-1px)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              },
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#000000 !important',
                                fontWeight: 500,
                                fontSize: '0.875rem',
                                lineHeight: 1.4,
                              }}
                            >
                              {source.article_title}
                            </Typography>
                            {source.relevance_score !== undefined && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#666 !important',
                                  fontSize: '0.7rem',
                                  mt: 0.5,
                                  display: 'block',
                                }}
                              >
                                Relevance: {Math.round(source.relevance_score * 100)}%
                              </Typography>
                            )}
                          </Paper>
                        </Link>
                      ))}
                    </Box>
                  </Box>
                )}
              </Paper>
            </ListItem>
          ))}
          {loading && (
            <ListItem sx={{ justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </ListItem>
          )}
        </List>
        <div ref={messagesEndRef} />
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          InputProps={{
            endAdornment: (
              <IconButton onClick={handleSend} disabled={loading || !input.trim()}>
                <SendIcon />
              </IconButton>
            ),
          }}
        />
      </Box>
    </Drawer>
  );
}

