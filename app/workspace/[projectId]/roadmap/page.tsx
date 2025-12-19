'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Container, Box, Typography, Button, Grid, Card, CardContent,
  CircularProgress, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, IconButton, Menu, MenuItem as MenuItemButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { RoadmapItem, CreateRoadmapItemInput } from '@/types/workspace-extended';
import { getCsrfHeaders } from '@/lib/utils/csrfClient';

export default function RoadmapPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { showSuccess, showError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{element: HTMLElement; item: RoadmapItem} | null>(null);
  
  const [formData, setFormData] = useState<Partial<CreateRoadmapItemInput>>({
    title: '',
    description: '',
    item_type: 'feature',
    roadmap_bucket: 'later',
  });

  const loadItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/roadmap`);
      if (response.ok) setItems(await response.json());
    } catch (err) {
      showError('Failed to load roadmap');
    } finally {
      setLoading(false);
    }
  }, [projectId, showError]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleOpenDialog = (item?: RoadmapItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        description: item.description || '',
        item_type: item.item_type,
        roadmap_bucket: item.roadmap_bucket,
      });
    } else {
      setEditingItem(null);
      setFormData({ title: '', description: '', item_type: 'feature', roadmap_bucket: 'later' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.title || !formData.item_type) {
        showError('Title and type are required');
        return;
      }

      const url = editingItem
        ? `/api/workspaces/${projectId}/roadmap/${editingItem.id}`
        : `/api/workspaces/${projectId}/roadmap`;
      
      const method = editingItem ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getCsrfHeaders(),
        body: JSON.stringify({ ...formData, workspace_id: undefined }),
      });

      if (!response.ok) throw new Error('Failed to save');

      showSuccess(editingItem ? 'Updated' : 'Created');
      setDialogOpen(false);
      await loadItems();
    } catch (err) {
      showError('Failed to save');
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Delete this item?')) return;

    try {
      const response = await fetch(`/api/workspaces/${projectId}/roadmap/${itemId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
      });

      if (!response.ok) throw new Error('Failed to delete');

      showSuccess('Deleted');
      await loadItems();
      setMenuAnchor(null);
    } catch (err) {
      showError('Failed to delete');
    }
  };

  const itemsByBucket = {
    now: items.filter(i => i.roadmap_bucket === 'now'),
    next: items.filter(i => i.roadmap_bucket === 'next'),
    later: items.filter(i => i.roadmap_bucket === 'later'),
    icebox: items.filter(i => i.roadmap_bucket === 'icebox'),
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/workspace/${projectId}`)}
          sx={{ mb: 2 }}
        >
          Back to Workspace
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Roadmap Planner
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Now / Next / Later roadmap
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Item
          </Button>
        </Box>
      </Box>

      {/* Kanban Columns */}
      <Grid container spacing={3}>
        {(['now', 'next', 'later', 'icebox'] as const).map((bucket) => (
          <Grid item xs={12} md={3} key={bucket}>
            <Typography variant="h6" sx={{ mb: 2, textTransform: 'capitalize' }}>
              {bucket} ({itemsByBucket[bucket].length})
            </Typography>
            {itemsByBucket[bucket].map((item) => (
              <Card key={item.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontSize: '1rem' }}>{item.title}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip label={item.item_type} size="small" />
                        <Chip label={item.status} size="small" color={item.status === 'shipped' ? 'success' : 'default'} />
                      </Box>
                      {item.priority_score && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Score: {item.priority_score.toFixed(1)}
                        </Typography>
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => setMenuAnchor({ element: e.currentTarget, item })}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Grid>
        ))}
      </Grid>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItemButton onClick={() => {
          if (menuAnchor) handleOpenDialog(menuAnchor.item);
          setMenuAnchor(null);
        }}>
          Edit
        </MenuItemButton>
        <MenuItemButton onClick={() => {
          if (menuAnchor) handleDelete(menuAnchor.item.id);
        }}>
          Delete
        </MenuItemButton>
      </Menu>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.item_type}
                onChange={(e) => setFormData({ ...formData, item_type: e.target.value as any })}
                label="Type"
              >
                <MenuItem value="feature">Feature</MenuItem>
                <MenuItem value="theme">Theme</MenuItem>
                <MenuItem value="epic">Epic</MenuItem>
                <MenuItem value="initiative">Initiative</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Bucket</InputLabel>
              <Select
                value={formData.roadmap_bucket}
                onChange={(e) => setFormData({ ...formData, roadmap_bucket: e.target.value as any })}
                label="Bucket"
              >
                <MenuItem value="now">Now</MenuItem>
                <MenuItem value="next">Next</MenuItem>
                <MenuItem value="later">Later</MenuItem>
                <MenuItem value="icebox">Icebox</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingItem ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

