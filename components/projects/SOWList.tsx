'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { ScopeOfWork } from '@/types/project';

interface SOWListProps {
  sows: ScopeOfWork[];
  onAdd?: () => void;
  onView?: (sow: ScopeOfWork) => void;
  onEdit?: (sow: ScopeOfWork) => void;
  onDelete?: (sow: ScopeOfWork) => void;
  loading?: boolean;
}

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  draft: 'default',
  review: 'warning',
  approved: 'success',
  active: 'primary',
  completed: 'success',
  archived: 'default',
};

export default function SOWList({
  sows,
  onAdd,
  onView,
  onEdit,
  onDelete,
  loading = false,
}: SOWListProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSOW, setSelectedSOW] = useState<ScopeOfWork | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, sow: ScopeOfWork) => {
    setAnchorEl(event.currentTarget);
    setSelectedSOW(sow);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedSOW(null);
  };

  const handleView = () => {
    if (selectedSOW && onView) {
      onView(selectedSOW);
    }
    handleMenuClose();
  };

  const handleEdit = () => {
    if (selectedSOW && onEdit) {
      onEdit(selectedSOW);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedSOW && onDelete) {
      onDelete(selectedSOW);
    }
    handleMenuClose();
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading scope of work...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {onAdd && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAdd}
          >
            Create Scope of Work
          </Button>
        </Box>
      )}

      {!sows || sows.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No scope of work documents found. Create one to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sows.map((sow) => (
            <Card key={sow.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h6">
                        {sow.title}
                      </Typography>
                      <Chip
                        label={sow.status}
                        color={statusColors[sow.status] || 'default'}
                        size="small"
                      />
                      <Typography variant="caption" color="text.secondary">
                        v{sow.version}
                      </Typography>
                    </Box>
                    {sow.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {sow.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Created: {format(new Date(sow.created_at), 'MMM d, yyyy')}
                      </Typography>
                      {sow.approved_at && (
                        <Typography variant="caption" color="text.secondary">
                          Approved: {format(new Date(sow.approved_at), 'MMM d, yyyy')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, sow)}
                    aria-label="SOW actions"
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {onView && (
          <MenuItem onClick={handleView}>
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View</ListItemText>
          </MenuItem>
        )}
        {onEdit && (
          <MenuItem onClick={handleEdit}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}

