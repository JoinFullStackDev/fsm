'use client';

import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { ContactAttachment } from '@/types/ops';

interface AttachmentManagerProps {
  contactId: string;
  attachments: ContactAttachment[];
  onAttachmentsChange: () => void;
}

export default function AttachmentManager({
  contactId,
  attachments,
  onAttachmentsChange,
}: AttachmentManagerProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const supabase = createSupabaseClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Get file extension
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
      
      // Create unique filename using contact ID, timestamp, and original filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `contacts/${contactId}/${timestamp}-${sanitizedName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('file_uploads')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        throw new Error('Failed to upload file: ' + uploadError.message);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('file_uploads')
        .getPublicUrl(fileName);

      // Create attachment record via API
      const response = await fetch(`/api/ops/contacts/${contactId}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_name: file.name,
          file_path: publicUrl,
          file_size: file.size,
          file_type: file.type || null,
        }),
      });

      if (!response.ok) {
        // If API call fails, try to delete the uploaded file
        try {
          await supabase.storage.from('file_uploads').remove([fileName]);
        } catch (deleteErr) {
          console.error('Failed to clean up uploaded file:', deleteErr);
        }

        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create attachment record');
      }

      showSuccess('File uploaded successfully');
      onAttachmentsChange();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string, filePath: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) {
      return;
    }

    setDeleting(attachmentId);

    try {
      // Extract file path from URL for deletion
      let fileName = filePath;
      try {
        const url = new URL(filePath);
        // Extract path after bucket name (e.g., contacts/contactId/timestamp-filename)
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.findIndex(part => part === 'file_uploads');
        if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
          fileName = pathParts.slice(bucketIndex + 1).join('/');
        }
      } catch {
        // If not a URL, assume it's already a path
        fileName = filePath.replace(/^.*\/file_uploads\//, '');
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('file_uploads')
        .remove([fileName]);

      if (storageError) {
        console.warn('Failed to delete file from storage:', storageError);
        // Continue with API deletion anyway
      }

      // Delete attachment record via API
      const response = await fetch(
        `/api/ops/contacts/${contactId}/attachments?attachment_id=${attachmentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete attachment');
      }

      showSuccess('Attachment deleted successfully');
      onAttachmentsChange();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete attachment';
      showError(errorMessage);
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: theme.palette.text.secondary,
            fontWeight: 600,
          }}
        >
          Attachments
        </Typography>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          disabled={uploading}
        />
        <Button
          variant="contained"
          startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          sx={{
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            fontWeight: 600,
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
          {uploading ? 'Uploading...' : 'Upload File'}
        </Button>
      </Box>

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

      {attachments.length === 0 ? (
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            fontStyle: 'italic',
            textAlign: 'center',
            py: 3,
          }}
        >
          No attachments yet
        </Typography>
      ) : (
        <List sx={{ p: 0 }}>
          {attachments.map((attachment) => (
            <Paper
              key={attachment.id}
              sx={{
                mb: 1,
                backgroundColor: theme.palette.background.paper,
                border: `2px solid ${theme.palette.divider}`,
              }}
            >
              <ListItem>
                <AttachFileIcon
                  sx={{
                    color: theme.palette.text.primary,
                    mr: 2,
                  }}
                />
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 500,
                      }}
                    >
                      {attachment.file_name}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: theme.palette.text.secondary,
                          display: 'block',
                        }}
                      >
                        {formatFileSize(attachment.file_size)}
                        {attachment.file_type && ` • ${attachment.file_type}`}
                      </Typography>
                      {attachment.uploaded_user && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: theme.palette.text.secondary,
                            display: 'block',
                          }}
                        >
                          Uploaded by {attachment.uploaded_user.name || attachment.uploaded_user.email}
                          {' • '}
                          {new Date(attachment.created_at).toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => window.open(attachment.file_path, '_blank')}
                    sx={{
                      color: theme.palette.text.primary,
                      mr: 1,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    <DownloadIcon />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={() => handleDelete(attachment.id, attachment.file_path)}
                    disabled={deleting === attachment.id}
                    sx={{
                      color: theme.palette.error.main,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    {deleting === attachment.id ? <CircularProgress size={20} /> : <DeleteIcon />}
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            </Paper>
          ))}
        </List>
      )}
    </Box>
  );
}

