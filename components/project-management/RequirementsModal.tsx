'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import type { PreviewTask } from '@/types/taskGenerator';

interface RequirementsModalProps {
  open: boolean;
  onClose: () => void;
  task: PreviewTask | null;
}

export default function RequirementsModal({
  open,
  onClose,
  task,
}: RequirementsModalProps) {
  const requirements = task?.requirements || [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          border: '2px solid',
          borderColor: 'primary.main',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
          borderBottom: '1px solid',
          borderColor: 'primary.main',
          color: 'primary.main',
          fontWeight: 600,
        }}
      >
        Requirements: {task?.title || 'Task'}
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {requirements.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No requirements specified for this task.
          </Typography>
        ) : (
          <List>
            {requirements.map((req, index) => (
              <ListItem key={index} sx={{ px: 0 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Typography variant="body2" component="span" sx={{ fontWeight: 500 }}>
                        {index + 1}.
                      </Typography>
                      <Typography variant="body2" component="span">
                        {req}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        {task?.userStories && task.userStories.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              User Stories
            </Typography>
            <List>
              {task.userStories.map((story, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        {story}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

