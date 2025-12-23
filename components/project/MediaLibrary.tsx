'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import FileUploadCard from './FileUploadCard';
import EmptyState from '@/components/ui/EmptyState';
import type { ProjectUploadWithUploader } from '@/types/project';

interface MediaLibraryProps {
  projectId: string;
  uploads: ProjectUploadWithUploader[];
  loading: boolean;
  onUploadsChange: () => void;
}

const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
];

const FILE_TYPE_FILTERS = [
  { value: 'all', label: 'All Files' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'spreadsheet', label: 'Spreadsheets' },
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export default function MediaLibrary({
  projectId,
  uploads,
  loading,
  onUploadsChange,
}: MediaLibraryProps) {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFilesUpload(files);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleFilesUpload(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFilesUpload = async (files: File[]) => {
    setUploading(true);
    setUploadProgress(null);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);

      try {
        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          showError(`Unsupported file type: ${file.name}`);
          errorCount++;
          continue;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          showError(`File too large (max 25MB): ${file.name}`);
          errorCount++;
          continue;
        }

        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `projects/${projectId}/${timestamp}-${sanitizedName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('file_uploads')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('file_uploads')
          .getPublicUrl(storagePath);

        // Get file extension
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

        // Create upload record via API
        const response = await fetch(`/api/projects/${projectId}/uploads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_name: file.name,
            file_path: publicUrl,
            file_size: file.size,
            file_type: fileExt,
            mime_type: file.type,
          }),
        });

        if (!response.ok) {
          // Try to clean up storage
          try {
            await supabase.storage.from('file_uploads').remove([storagePath]);
          } catch {
            // Ignore cleanup errors
          }
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create upload record');
        }

        const uploadRecord = await response.json();

        // Trigger AI processing (don't wait for it)
        fetch(`/api/projects/${projectId}/uploads/${uploadRecord.id}/process`, {
          method: 'POST',
        }).catch((err) => {
          console.error('AI processing trigger failed:', err);
        });

        successCount++;
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        showError(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        errorCount++;
      }
    }

    setUploading(false);
    setUploadProgress(null);

    if (successCount > 0) {
      showSuccess(`Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
      onUploadsChange();
    }
  };

  const handleDelete = async (uploadId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/uploads/${uploadId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete upload');
      }

      showSuccess('File deleted successfully');
      onUploadsChange();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const handleReprocess = async (uploadId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/uploads/${uploadId}/process`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process upload');
      }

      showSuccess('File processing started');
      onUploadsChange();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to process file');
    }
  };

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: 'grid' | 'list' | null) => {
    if (newMode) {
      setViewMode(newMode);
    }
  };

  const handleTypeFilterChange = (event: SelectChangeEvent<string>) => {
    setTypeFilter(event.target.value);
  };

  // Filter uploads
  const filteredUploads = uploads.filter((upload) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = upload.file_name.toLowerCase().includes(query);
      const matchesDesc = upload.description?.toLowerCase().includes(query);
      const matchesTags = upload.tags?.some((tag) => tag.toLowerCase().includes(query));
      if (!matchesName && !matchesDesc && !matchesTags) {
        return false;
      }
    }

    // Type filter
    if (typeFilter !== 'all') {
      const mimeType = upload.mime_type || '';
      if (typeFilter === 'image' && !mimeType.startsWith('image/')) {
        return false;
      }
      if (typeFilter === 'document' && !['application/pdf', 'text/', 'application/vnd.openxmlformats-officedocument.wordprocessingml'].some((t) => mimeType.includes(t))) {
        return false;
      }
      if (typeFilter === 'spreadsheet' && !mimeType.includes('spreadsheet') && !mimeType.includes('csv')) {
        return false;
      }
    }

    return true;
  });

  // Calculate stats
  const stats = {
    total: uploads.length,
    processed: uploads.filter((u) => u.is_processed && !u.processing_error).length,
    pending: uploads.filter((u) => !u.is_processed).length,
    failed: uploads.filter((u) => u.processing_error).length,
  };

  return (
    <Box>
      {/* Upload Zone */}
      <Paper
        elevation={0}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          p: { xs: 3, md: 4 },
          mb: 3,
          border: `2px dashed ${dragActive ? theme.palette.primary.main : theme.palette.divider}`,
          borderRadius: 3,
          backgroundColor: dragActive ? theme.palette.action.hover : theme.palette.background.paper,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          '&:hover': {
            borderColor: theme.palette.primary.main,
            backgroundColor: theme.palette.action.hover,
          },
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        {uploading ? (
          <Box sx={{ py: 2 }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
              {uploadProgress || 'Uploading...'}
            </Typography>
          </Box>
        ) : (
          <>
            <CloudUploadIcon
              sx={{
                fontSize: 48,
                color: dragActive ? theme.palette.primary.main : theme.palette.text.secondary,
                mb: 2,
              }}
            />
            <Typography
              variant="h6"
              sx={{
                color: theme.palette.text.primary,
                fontWeight: 600,
                mb: 1,
              }}
            >
              {dragActive ? 'Drop files here' : 'Drag & drop files or click to browse'}
            </Typography>
            <Typography
              variant="body2"
              sx={{ 
                color: theme.palette.text.secondary, 
                mb: 1, 
                maxWidth: 500, 
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              Upload images, documents, and files to provide context for the AI assistant.
              Files are automatically processed to extract text and generate summaries.
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.disabled, mb: 2 }}
            >
              Supports PNG, JPG, GIF, WebP, PDF, Word, Excel, and text files
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip label="Max 25MB per file" size="small" variant="outlined" />
              <Chip label="AI auto-processing" size="small" variant="outlined" />
            </Box>
          </>
        )}
      </Paper>

      {/* Stats */}
      {uploads.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <Chip
            label={`${stats.total} Total`}
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              fontWeight: 600,
            }}
          />
          <Chip
            label={`${stats.processed} Processed`}
            sx={{
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              color: '#4CAF50',
              fontWeight: 600,
            }}
          />
          {stats.pending > 0 && (
            <Chip
              label={`${stats.pending} Pending`}
              sx={{
                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                color: '#FF9800',
                fontWeight: 600,
              }}
            />
          )}
          {stats.failed > 0 && (
            <Chip
              label={`${stats.failed} Failed`}
              sx={{
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#F44336',
                fontWeight: 600,
              }}
            />
          )}
        </Box>
      )}

      {/* Filters */}
      {uploads.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', md: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
              <TextField
                size="small"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: theme.palette.text.secondary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>File Type</InputLabel>
                <Select
                  value={typeFilter}
                  onChange={handleTypeFilterChange}
                  label="File Type"
                >
                  {FILE_TYPE_FILTERS.map((filter) => (
                    <MenuItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              size="small"
            >
              <ToggleButton value="grid">
                <GridViewIcon />
              </ToggleButton>
              <ToggleButton value="list">
                <ViewListIcon />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Paper>
      )}

      {/* Upload List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filteredUploads.length === 0 ? (
        uploads.length === 0 ? (
          <EmptyState
            icon={<CloudUploadIcon sx={{ fontSize: 64 }} />}
            title="No files uploaded yet"
            description="Upload images, documents, and files to provide context for the AI assistant. Files are automatically processed to extract text and generate summaries."
            actionLabel="Upload Files"
            onAction={() => fileInputRef.current?.click()}
          />
        ) : (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No files match your search criteria. Try adjusting your filters.
          </Alert>
        )
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {filteredUploads.map((upload) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={upload.id}>
              <FileUploadCard
                upload={upload}
                viewMode="grid"
                onDelete={() => handleDelete(upload.id)}
                onReprocess={() => handleReprocess(upload.id)}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filteredUploads.map((upload) => (
            <FileUploadCard
              key={upload.id}
              upload={upload}
              viewMode="list"
              onDelete={() => handleDelete(upload.id)}
              onReprocess={() => handleReprocess(upload.id)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

