'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  TextField,
  IconButton,
  Button,
  Alert,
  CircularProgress,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { ContactTag, CompanyTag } from '@/types/ops';

interface TagManagerProps {
  contactId?: string;
  companyId?: string;
  tags: (ContactTag | CompanyTag)[];
  onTagsChange: () => void;
}

export default function TagManager({
  contactId,
  companyId,
  tags,
  onTagsChange,
}: TagManagerProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [newTagName, setNewTagName] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      setError('Tag name cannot be empty');
      return;
    }

    if (tags.some(tag => tag.tag_name.toLowerCase() === newTagName.trim().toLowerCase())) {
      setError('Tag already exists');
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const url = contactId
        ? `/api/ops/contacts/${contactId}/tags`
        : `/api/ops/companies/${companyId}/tags`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tag_name: newTagName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add tag');
      }

      setNewTagName('');
      showSuccess('Tag added successfully');
      onTagsChange();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add tag';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!confirm(`Are you sure you want to remove the tag "${tagName}"?`)) {
      return;
    }

    setRemoving(tagName);

    try {
      const url = contactId
        ? `/api/ops/contacts/${contactId}/tags?tag_name=${encodeURIComponent(tagName)}`
        : `/api/ops/companies/${companyId}/tags?tag_name=${encodeURIComponent(tagName)}`;

      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove tag');
      }

      showSuccess('Tag removed successfully');
      onTagsChange();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove tag';
      showError(errorMessage);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Box>
      <Typography
        variant="h6"
        sx={{
          color: theme.palette.text.primary,
          fontWeight: 600,
          fontFamily: 'var(--font-rubik), Rubik, sans-serif',
          mb: 3,
        }}
      >
        Tags
      </Typography>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {error}
        </Alert>
      )}

      {/* Existing Tags */}
      {tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.tag_name}
              onDelete={() => handleRemoveTag(tag.tag_name)}
              disabled={removing === tag.tag_name}
              sx={{
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                '& .MuiChip-deleteIcon': {
                  color: theme.palette.text.primary,
                  '&:hover': {
                    color: theme.palette.error.main,
                  },
                },
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  borderColor: theme.palette.text.primary,
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* Add Tag Input */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          placeholder="Add a tag..."
          value={newTagName}
          onChange={(e) => {
            setNewTagName(e.target.value);
            setError(null);
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !adding) {
              e.preventDefault();
              handleAddTag();
            }
          }}
          disabled={adding}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: theme.palette.background.default,
              color: theme.palette.text.primary,
              '& fieldset': {
                borderColor: theme.palette.divider,
              },
              '&:hover fieldset': {
                borderColor: theme.palette.text.secondary,
              },
              '&.Mui-focused fieldset': {
                borderColor: theme.palette.text.primary,
              },
            },
            '& .MuiInputBase-input::placeholder': {
              color: theme.palette.text.secondary,
              opacity: 1,
            },
            '& .MuiInputLabel-root': {
              color: theme.palette.text.secondary,
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: theme.palette.text.primary,
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleAddTag}
          disabled={adding || !newTagName.trim()}
          startIcon={adding ? <CircularProgress size={16} /> : <AddIcon />}
          sx={{
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            fontWeight: 600,
            minWidth: '100px',
            border: `1px solid ${theme.palette.divider}`,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              borderColor: theme.palette.text.primary,
            },
            '&:disabled': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.secondary,
              borderColor: theme.palette.divider,
            },
          }}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}

