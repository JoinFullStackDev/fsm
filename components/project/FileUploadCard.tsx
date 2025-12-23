'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Avatar,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  TableChart as SpreadsheetIcon,
  TextSnippet as TextIcon,
  InsertDriveFile as FileIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import type { ProjectUploadWithUploader } from '@/types/project';

interface FileUploadCardProps {
  upload: ProjectUploadWithUploader;
  viewMode: 'grid' | 'list';
  onDelete: () => void;
  onReprocess: () => void;
}

function getFileIcon(mimeType: string | null, fileType: string | null) {
  if (!mimeType && !fileType) return <FileIcon />;
  
  const type = mimeType || '';
  const ext = fileType?.toLowerCase() || '';
  
  if (type.startsWith('image/')) return <ImageIcon />;
  if (type === 'application/pdf' || ext === 'pdf') return <PdfIcon />;
  if (type.includes('wordprocessingml') || ext === 'docx' || ext === 'doc') return <DocIcon />;
  if (type.includes('spreadsheetml') || ext === 'xlsx' || ext === 'xls' || ext === 'csv') return <SpreadsheetIcon />;
  if (type.startsWith('text/') || ext === 'txt' || ext === 'md') return <TextIcon />;
  
  return <FileIcon />;
}

function getFileTypeLabel(mimeType: string | null, fileType: string | null) {
  if (!mimeType && !fileType) return 'File';
  
  const type = mimeType || '';
  const ext = fileType?.toUpperCase() || '';
  
  if (type.startsWith('image/')) return ext || 'Image';
  if (type === 'application/pdf') return 'PDF';
  if (type.includes('wordprocessingml')) return 'DOCX';
  if (type.includes('spreadsheetml')) return 'XLSX';
  if (type === 'text/csv') return 'CSV';
  if (type === 'text/markdown') return 'Markdown';
  if (type === 'text/plain') return 'Text';
  if (type === 'application/json') return 'JSON';
  
  return ext || 'File';
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function FileUploadCard({
  upload,
  viewMode,
  onDelete,
  onReprocess,
}: FileUploadCardProps) {
  const theme = useTheme();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const isImage = upload.mime_type?.startsWith('image/');
  const isPending = !upload.is_processed && !upload.processing_error;
  const isFailed = !!upload.processing_error;
  const isProcessed = upload.is_processed && !upload.processing_error;
  
  const statusColor = isProcessed ? '#4CAF50' : isFailed ? '#F44336' : '#FF9800';
  const statusLabel = isProcessed ? 'Processed' : isFailed ? 'Failed' : 'Pending';
  const StatusIcon = isProcessed ? CheckCircleIcon : isFailed ? ErrorIcon : PendingIcon;

  const handlePreviewClick = () => {
    setPreviewOpen(true);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    setDeleteDialogOpen(false);
    onDelete();
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = upload.file_path;
    link.download = upload.file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (viewMode === 'list') {
    return (
      <>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          {/* Icon/Thumbnail */}
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1,
              backgroundColor: theme.palette.action.hover,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {isImage ? (
              <Box
                component="img"
                src={upload.file_path}
                alt={upload.file_name}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <Box sx={{ color: theme.palette.text.secondary }}>
                {getFileIcon(upload.mime_type, upload.file_type)}
              </Box>
            )}
          </Box>

          {/* File Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 500,
                color: theme.palette.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {upload.file_name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                {getFileTypeLabel(upload.mime_type, upload.file_type)} • {formatFileSize(upload.file_size)}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                {formatDate(upload.created_at)}
              </Typography>
            </Box>
          </Box>

          {/* Status */}
          <Chip
            icon={<StatusIcon sx={{ fontSize: 16 }} />}
            label={statusLabel}
            size="small"
            sx={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
              fontWeight: 500,
              '& .MuiChip-icon': {
                color: statusColor,
              },
            }}
          />

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="View">
              <IconButton size="small" onClick={handlePreviewClick}>
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton size="small" onClick={handleDownload}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {(isFailed || !isProcessed) && (
              <Tooltip title="Reprocess">
                <IconButton size="small" onClick={onReprocess}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Delete">
              <IconButton size="small" onClick={handleDeleteClick} sx={{ color: theme.palette.error.main }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        {/* Preview Dialog */}
        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getFileIcon(upload.mime_type, upload.file_type)}
              <Typography variant="h6" sx={{ flex: 1 }}>
                {upload.file_name}
              </Typography>
              <Chip
                icon={<StatusIcon sx={{ fontSize: 14 }} />}
                label={statusLabel}
                size="small"
                sx={{
                  backgroundColor: `${statusColor}20`,
                  color: statusColor,
                  '& .MuiChip-icon': { color: statusColor },
                }}
              />
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {isImage && (
              <Box
                component="img"
                src={upload.file_path}
                alt={upload.file_name}
                sx={{
                  maxWidth: '100%',
                  maxHeight: 400,
                  display: 'block',
                  margin: '0 auto',
                  borderRadius: 1,
                }}
              />
            )}
            
            {upload.ai_summary && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  AI Summary
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.action.hover,
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    {upload.ai_summary}
                  </Typography>
                </Paper>
              </Box>
            )}
            
            {upload.extracted_text && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Extracted Text
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.action.hover,
                    borderRadius: 1,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.secondary,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                    }}
                  >
                    {upload.extracted_text}
                  </Typography>
                </Paper>
              </Box>
            )}
            
            {upload.processing_error && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.error.main }}>
                  Processing Error
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
                    {upload.processing_error}
                  </Typography>
                </Paper>
              </Box>
            )}
            
            <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                Uploaded by {upload.uploader?.name || upload.uploader?.email || 'Unknown'} on {formatDate(upload.created_at)}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDownload} startIcon={<DownloadIcon />}>
              Download
            </Button>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete File</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete &quot;{upload.file_name}&quot;? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // Grid view
  return (
    <>
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          backgroundColor: theme.palette.background.paper,
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: theme.palette.text.primary,
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[4],
          },
        }}
      >
        {/* Preview Area */}
        <Box
          onClick={handlePreviewClick}
          sx={{
            height: 140,
            backgroundColor: theme.palette.action.hover,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {isImage ? (
            <Box
              component="img"
              src={upload.file_path}
              alt={upload.file_name}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <Box sx={{ color: theme.palette.text.secondary, fontSize: 48 }}>
              {getFileIcon(upload.mime_type, upload.file_type)}
            </Box>
          )}
          
          {/* Status Badge */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: `${statusColor}`,
              borderRadius: '50%',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isPending ? (
              <CircularProgress size={14} sx={{ color: '#fff' }} />
            ) : (
              <StatusIcon sx={{ fontSize: 14, color: '#fff' }} />
            )}
          </Box>
        </Box>

        {/* Info */}
        <Box sx={{ p: 2 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: theme.palette.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mb: 0.5,
            }}
          >
            {upload.file_name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              {getFileTypeLabel(upload.mime_type, upload.file_type)} • {formatFileSize(upload.file_size)}
            </Typography>
          </Box>
          
          {/* Summary Preview */}
          {upload.ai_summary && (
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                mt: 1,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {upload.ai_summary}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 0.5,
            px: 1,
            pb: 1,
            borderTop: `1px solid ${theme.palette.divider}`,
            pt: 1,
          }}
        >
          <Tooltip title="View">
            <IconButton size="small" onClick={handlePreviewClick}>
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download">
            <IconButton size="small" onClick={handleDownload}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {(isFailed || !isProcessed) && (
            <Tooltip title="Reprocess">
              <IconButton size="small" onClick={onReprocess}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Delete">
            <IconButton size="small" onClick={handleDeleteClick} sx={{ color: theme.palette.error.main }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getFileIcon(upload.mime_type, upload.file_type)}
            <Typography variant="h6" sx={{ flex: 1 }}>
              {upload.file_name}
            </Typography>
            <Chip
              icon={<StatusIcon sx={{ fontSize: 14 }} />}
              label={statusLabel}
              size="small"
              sx={{
                backgroundColor: `${statusColor}20`,
                color: statusColor,
                '& .MuiChip-icon': { color: statusColor },
              }}
            />
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {isImage && (
            <Box
              component="img"
              src={upload.file_path}
              alt={upload.file_name}
              sx={{
                maxWidth: '100%',
                maxHeight: 400,
                display: 'block',
                margin: '0 auto',
                borderRadius: 1,
              }}
            />
          )}
          
          {upload.ai_summary && (
            <Box sx={{ mt: isImage ? 2 : 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                AI Summary
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.action.hover,
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  {upload.ai_summary}
                </Typography>
              </Paper>
            </Box>
          )}
          
          {upload.extracted_text && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Extracted Text
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.action.hover,
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                  }}
                >
                  {upload.extracted_text}
                </Typography>
              </Paper>
            </Box>
          )}
          
          {upload.processing_error && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.error.main }}>
                Processing Error
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
                  {upload.processing_error}
                </Typography>
              </Paper>
            </Box>
          )}
          
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Uploaded by {upload.uploader?.name || upload.uploader?.email || 'Unknown'} on {formatDate(upload.created_at)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDownload} startIcon={<DownloadIcon />}>
            Download
          </Button>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{upload.file_name}&quot;? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

