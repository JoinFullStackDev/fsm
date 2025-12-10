import { Box, Typography, Paper, IconButton, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ContentCopy as ContentCopyIcon, Check as CheckIcon } from '@mui/icons-material';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { ConversationMessage } from '@/types/workspace';
import ActionCard from './ActionCard';

interface MessageBubbleProps {
  message: ConversationMessage;
  onActionConfirm?: (action: any) => Promise<void>;
  onActionReject?: (action: any) => void;
  teamMembers?: Array<{ user_id: string; name: string | null; email: string; role: string }>;
}

export default function MessageBubble({
  message,
  onActionConfirm,
  onActionReject,
  teamMembers,
}: MessageBubbleProps) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2,
      }}
    >
      <Box sx={{ maxWidth: '80%', minWidth: '200px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {isUser ? 'You' : 'AI Assistant'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(message.timestamp)}
          </Typography>
        </Box>

        <Paper
          elevation={isUser ? 2 : 0}
          sx={{
            p: 2,
            backgroundColor: isUser
              ? theme.palette.primary.main
              : theme.palette.background.default,
            color: isUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
            borderRadius: 2,
            border: isUser ? 'none' : `1px solid ${theme.palette.divider}`,
            position: 'relative',
          }}
        >
          {isUser ? (
            <Typography 
              variant="body1" 
              sx={{ 
                whiteSpace: 'pre-wrap',
                color: theme.palette.primary.contrastText,
              }}
            >
              {message.content}
            </Typography>
          ) : (
            <>
              <Box
                sx={{
                  '& p': { my: 1 },
                  '& ul, & ol': { my: 1, pl: 3 },
                  '& li': { mb: 0.5 },
                  '& code': {
                    backgroundColor: theme.palette.action.hover,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.875em',
                  },
                  '& pre': {
                    backgroundColor: theme.palette.background.paper,
                    p: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    border: `1px solid ${theme.palette.divider}`,
                  },
                  '& pre code': {
                    backgroundColor: 'transparent',
                    padding: 0,
                  },
                  '& h1, & h2, & h3': {
                    fontWeight: 600,
                    mt: 2,
                    mb: 1,
                  },
                  '& blockquote': {
                    borderLeft: `4px solid ${theme.palette.divider}`,
                    pl: 2,
                    my: 2,
                    color: theme.palette.text.secondary,
                  },
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {message.content}
                </ReactMarkdown>
              </Box>
              <Tooltip title={copied ? 'Copied!' : 'Copy message'}>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    opacity: 0.6,
                    '&:hover': { opacity: 1 },
                  }}
                >
                  {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </>
          )}
        </Paper>

        {/* Action cards */}
        {message.actions && message.actions.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {message.actions.map((action, idx) => (
              <ActionCard
                key={idx}
                action={action}
                teamMembers={teamMembers}
                onConfirm={async () => {
                  if (onActionConfirm) {
                    await onActionConfirm(action);
                  }
                }}
                onReject={() => {
                  if (onActionReject) {
                    onActionReject(action);
                  }
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
