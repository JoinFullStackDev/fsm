import { Box, Button, Typography, Paper, IconButton, List, ListItem, ListItemButton, ListItemText, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Chat as ChatIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import type { WorkspaceConversation } from '@/types/workspace';

interface ConversationListProps {
  conversations: WorkspaceConversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onArchiveConversation?: (id: string) => void;
}

export default function ConversationList({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onArchiveConversation,
}: ConversationListProps) {
  const theme = useTheme();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Conversations
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={onNewConversation}
          variant="contained"
        >
          New
        </Button>
      </Box>

      {conversations.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: theme.palette.background.default }}>
          <ChatIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No conversations yet
          </Typography>
        </Paper>
      ) : (
        <List sx={{ p: 0 }}>
          {conversations.map((conv) => (
            <ListItem
              key={conv.id}
              disablePadding
              secondaryAction={
                onArchiveConversation && (
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchiveConversation(conv.id);
                    }}
                    sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
                  >
                    <ArchiveIcon fontSize="small" />
                  </IconButton>
                )
              }
            >
              <ListItemButton
                selected={conv.id === currentConversationId}
                onClick={() => onSelectConversation(conv.id)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  border: conv.id === currentConversationId
                    ? `2px solid ${theme.palette.primary.main}`
                    : '2px solid transparent',
                }}
              >
                <ListItemText
                  primary={conv.title}
                  secondary={`${conv.message_count} messages`}
                  primaryTypographyProps={{
                    sx: {
                      fontWeight: conv.id === currentConversationId ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
