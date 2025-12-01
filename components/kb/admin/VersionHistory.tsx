'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  History as HistoryIcon,
  Restore as RestoreIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import type { KnowledgeBaseVersion } from '@/types/kb';

interface VersionHistoryProps {
  articleId: string;
  onRestore?: (version: KnowledgeBaseVersion) => Promise<void>;
}

export default function VersionHistory({ articleId, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<KnowledgeBaseVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingVersion, setViewingVersion] = useState<KnowledgeBaseVersion | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadVersions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/kb/articles/${articleId}/versions`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleRestore = async (version: KnowledgeBaseVersion) => {
    if (!onRestore) return;

    setRestoring(true);
    try {
      await onRestore(version);
      setViewingVersion(null);
    } catch (error) {
      console.error('Error restoring version:', error);
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (versions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 4, color: 'text.secondary' }}>
        <HistoryIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
        <Typography>No version history available</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <HistoryIcon color="primary" />
        <Typography variant="h6">Version History</Typography>
      </Box>

      <List>
        {versions.map((version) => (
          <ListItem
            key={version.id}
            secondaryAction={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<ViewIcon />}
                  onClick={() => setViewingVersion(version)}
                >
                  View
                </Button>
                {onRestore && (
                  <Button
                    size="small"
                    startIcon={<RestoreIcon />}
                    onClick={() => handleRestore(version)}
                    disabled={restoring}
                  >
                    Restore
                  </Button>
                )}
              </Box>
            }
          >
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1">{version.title}</Typography>
                  <Chip label={`v${version.version_number}`} size="small" />
                </Box>
              }
              secondary={new Date(version.created_at).toLocaleString()}
            />
          </ListItem>
        ))}
      </List>

      <Dialog
        open={!!viewingVersion}
        onClose={() => setViewingVersion(null)}
        maxWidth="md"
        fullWidth
      >
        {viewingVersion && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">{viewingVersion.title}</Typography>
                <Chip label={`v${viewingVersion.version_number}`} size="small" />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box
                sx={{
                  '& p': { marginBottom: 1 },
                  '& ul, & ol': { marginLeft: 2, marginBottom: 1 },
                }}
              >
                <ReactMarkdown>{viewingVersion.body}</ReactMarkdown>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewingVersion(null)}>Close</Button>
              {onRestore && (
                <Button
                  variant="contained"
                  onClick={() => handleRestore(viewingVersion)}
                  disabled={restoring}
                >
                  {restoring ? <CircularProgress size={20} /> : 'Restore This Version'}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

