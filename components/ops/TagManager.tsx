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
        variant="subtitle2"
        sx={{
          color: '#B0B0B0',
          fontWeight: 600,
          mb: 2,
        }}
      >
        Tags
      </Typography>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            backgroundColor: 'rgba(255, 23, 68, 0.1)',
            border: '1px solid rgba(255, 23, 68, 0.3)',
            color: '#FF1744',
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
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                color: '#00E5FF',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                '& .MuiChip-deleteIcon': {
                  color: '#00E5FF',
                  '&:hover': {
                    color: '#FF1744',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.2)',
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
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#E0E0E0',
              '& fieldset': {
                borderColor: 'rgba(0, 229, 255, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(0, 229, 255, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#00E5FF',
              },
            },
            '& .MuiInputBase-input::placeholder': {
              color: '#808080',
              opacity: 1,
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleAddTag}
          disabled={adding || !newTagName.trim()}
          startIcon={adding ? <CircularProgress size={16} /> : <AddIcon />}
          sx={{
            backgroundColor: '#00E5FF',
            color: '#000',
            fontWeight: 600,
            minWidth: '100px',
            '&:hover': {
              backgroundColor: '#00B2CC',
            },
            '&:disabled': {
              backgroundColor: 'rgba(0, 229, 255, 0.3)',
              color: '#808080',
            },
          }}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}

