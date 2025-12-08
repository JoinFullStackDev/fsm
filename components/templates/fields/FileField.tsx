'use client';
import type { PhaseDataUnion } from '@/types/phases';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  FilePresent as FileIcon,
} from '@mui/icons-material';
import { useSupabaseClient } from '@/lib/supabaseClient';
import type { TemplateFieldConfig } from '@/types/templates';
import logger from '@/lib/utils/logger';

interface FileFieldProps {
  field: TemplateFieldConfig;
  value: string | null; // File path or URL
  onChange: (value: string | null) => void;
  error?: string;
  phaseData?: Record<string, unknown>;
}

function FileField({ field, value, onChange, error, phaseData }: FileFieldProps) {
  const theme = useTheme();
  const config = field.field_config;
  const supabase = useSupabaseClient();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadError(null);
      handleUpload(selectedFile);
    }
  };

  const handleUpload = async (fileToUpload: File) => {
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Get file extension
      const fileExt = fileToUpload.name.split('.').pop()?.toLowerCase() || 'bin';
      
      // Create unique filename using user ID, timestamp, and original filename
      const timestamp = Date.now();
      const sanitizedName = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${session.user.id}/${timestamp}-${sanitizedName}`;

      logger.debug('[File Upload] Uploading file:', fileName, 'Size:', fileToUpload.size);

      // Upload file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('file_uploads')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType: fileToUpload.type,
        });

      if (uploadError) {
        logger.error('[File Upload] Upload error:', uploadError);
        throw new Error('Failed to upload file: ' + uploadError.message);
      }

      logger.debug('[File Upload] Upload successful:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('file_uploads')
        .getPublicUrl(fileName);

      logger.debug('[File Upload] Public URL:', publicUrl);

      // Store the URL in phase data
      onChange(publicUrl);
      setFile(null);
      setUploadError(null);
    } catch (err) {
      console.error('[File Upload] Unexpected error:', err);
      setUploadError('Failed to upload file: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!value) return;

    try {
      // Extract file path from URL
      const urlParts = value.split('/');
      const fileName = urlParts.slice(-2).join('/'); // Get user_id/filename
      
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('file_uploads')
        .remove([fileName]);

      if (deleteError) {
        logger.warn('[File Upload] Failed to delete file:', deleteError);
        // Continue anyway - clear the value even if deletion fails
      }

      onChange(null);
    } catch (err) {
      logger.error('[File Upload] Error removing file:', err);
      // Still clear the value
      onChange(null);
    }
  };

  const getFileName = (url: string | null): string => {
    if (!url) return '';
    try {
      const parts = url.split('/');
      const fileName = parts[parts.length - 1];
      // Remove query parameters if any
      return fileName.split('?')[0];
    } catch {
      return 'Uploaded file';
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {(error || uploadError) && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 2,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {error || uploadError}
        </Alert>
      )}

      {value ? (
        <Box
          sx={{
            p: 2,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            backgroundColor: theme.palette.background.paper,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <FileIcon sx={{ color: theme.palette.text.primary }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getFileName(value)}
              </Typography>
              <Link
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                sx={{ color: theme.palette.text.primary }}
              >
                View file
              </Link>
            </Box>
          </Box>
          <IconButton
            onClick={handleRemove}
            size="small"
            disabled={uploading}
            sx={{
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ) : (
        <Box>
          <input
            accept="*/*"
            style={{ display: 'none' }}
            id={`file-upload-${field.field_key}`}
            type="file"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <label htmlFor={`file-upload-${field.field_key}`}>
            <Button
              variant="outlined"
              component="span"
              startIcon={uploading ? <CircularProgress size={16} sx={{ color: theme.palette.text.primary }} /> : <UploadIcon />}
              disabled={uploading}
              fullWidth
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
                '&.Mui-disabled': {
                  borderColor: theme.palette.divider,
                  color: theme.palette.text.secondary,
                },
              }}
            >
              {uploading ? 'Uploading...' : config.placeholder || 'Choose file to upload'}
            </Button>
          </label>
          {config.helpText && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: theme.palette.text.secondary }}>
              {config.helpText}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

export default React.memo(FileField);

