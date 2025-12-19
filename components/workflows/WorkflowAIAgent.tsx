'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Fab,
  Drawer,
  Typography,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
  Chip,
  Button,
  Tooltip,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkflowStep, TriggerType } from '@/types/workflows';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  workflowData?: GeneratedWorkflow;
}

export interface GeneratedWorkflow {
  name?: string;
  description?: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  steps: WorkflowStep[];
}

interface WorkflowAIAgentProps {
  currentWorkflowName?: string;
  currentSteps?: WorkflowStep[];
  onApplyWorkflow: (workflow: GeneratedWorkflow) => void;
}

const suggestionChips = [
  'When a task is completed, send an email notification',
  'Create a weekly report workflow',
  'When an opportunity is won, create a project',
  'Notify Slack when high-priority tasks are created',
  'Wait 2 days after contact creation, then send follow-up email',
];

export default function WorkflowAIAgent({
  currentWorkflowName,
  currentSteps = [],
  onApplyWorkflow,
}: WorkflowAIAgentProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/workflows/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input.trim(),
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentWorkflow: currentSteps.length > 0 ? { name: currentWorkflowName, steps: currentSteps } : null,
        }),
      });

      if (!response.ok) {
        // Try to get the error message from the response
        let errorMessage = 'Failed to generate workflow';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response isn't JSON, use status text
          errorMessage = `Failed to generate workflow: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullContent = '';
      let workflowData: GeneratedWorkflow | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullContent += parsed.text;
                setStreamingContent(fullContent);
              }
              if (parsed.workflow) {
                workflowData = parsed.workflow;
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Skip invalid JSON chunks
              if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
                console.warn('Parse error:', e);
              }
            }
          }
        }
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
        workflowData,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingContent('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyWorkflow = (workflow: GeneratedWorkflow) => {
    console.log('[WorkflowAIAgent] Applying workflow:', JSON.stringify(workflow, null, 2));
    console.log('[WorkflowAIAgent] Steps in workflow:', workflow.steps?.length || 0);
    onApplyWorkflow(workflow);
    setOpen(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleClearChat = () => {
    setMessages([]);
    setStreamingContent('');
  };

  // Clean content for display (remove workflow JSON blocks)
  const cleanContentForDisplay = (content: string): string => {
    return content.replace(/```workflow[\s\S]*?```/g, '').trim();
  };

  return (
    <>
      {/* Floating Action Button */}
      <Tooltip title="AI Workflow Builder" placement="left">
        <Fab
          color="primary"
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
            },
          }}
        >
          <AutoAwesomeIcon />
        </Fab>
      </Tooltip>

      {/* Chat Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 450 },
            maxWidth: '100vw',
            backgroundColor: theme.palette.background.default,
            borderLeft: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${theme.palette.divider}`,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AutoAwesomeIcon sx={{ color: theme.palette.primary.main }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                  AI Workflow Builder
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Describe your workflow in natural language
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Clear chat">
                <IconButton size="small" onClick={handleClearChat}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Messages Area */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {messages.length === 0 && !streamingContent && (
              <Box sx={{ py: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Hi! I can help you build workflows using natural language. Try one of these examples:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {suggestionChips.map((suggestion, index) => (
                    <Chip
                      key={index}
                      label={suggestion}
                      size="small"
                      onClick={() => handleSuggestionClick(suggestion)}
                      sx={{
                        cursor: 'pointer',
                        height: 'auto',
                        py: 0.5,
                        '& .MuiChip-label': {
                          whiteSpace: 'normal',
                        },
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        maxWidth: '85%',
                        backgroundColor:
                          message.role === 'user'
                            ? alpha(theme.palette.primary.main, 0.1)
                            : theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: 'pre-wrap' }}
                      >
                        {message.role === 'assistant' 
                          ? cleanContentForDisplay(message.content) 
                          : message.content}
                      </Typography>

                      {/* Apply Workflow Button */}
                      {message.workflowData && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <CheckCircleIcon fontSize="small" color="success" />
                            <Typography variant="caption" fontWeight={600}>
                              Workflow Ready
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                            {message.workflowData.steps?.length || 0} step(s) • Trigger: {message.workflowData.trigger_type}
                          </Typography>
                          <Button
                            variant="contained"
                            size="small"
                            fullWidth
                            onClick={() => handleApplyWorkflow(message.workflowData!)}
                            sx={{
                              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                            }}
                          >
                            Apply to Canvas
                          </Button>
                        </Box>
                      )}
                    </Paper>
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Streaming Content */}
            {streamingContent && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {cleanContentForDisplay(streamingContent)}
                  </Typography>
                </Paper>
              </motion.div>
            )}

            {/* Loading Indicator */}
            {isLoading && !streamingContent && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Thinking...
                </Typography>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Input Area */}
          <Box
            sx={{
              p: 2,
              borderTop: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                inputRef={inputRef}
                fullWidth
                size="small"
                placeholder="Describe the workflow you want to build..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isLoading}
                multiline
                maxRows={4}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.2),
                  },
                }}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

