'use client';

import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Switch,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  Webhook as WebhookIcon,
  TouchApp as ManualIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Workflow, TriggerType } from '@/types/workflows';

interface WorkflowListProps {
  workflows: Workflow[];
  onToggleActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onViewRuns: (id: string) => void;
}

const triggerTypeConfig: Record<TriggerType, { label: string; icon: JSX.Element; color: string }> = {
  event: {
    label: 'Event',
    icon: <PlayIcon fontSize="small" />,
    color: '#00BCD4',
  },
  schedule: {
    label: 'Schedule',
    icon: <ScheduleIcon fontSize="small" />,
    color: '#FF9800',
  },
  webhook: {
    label: 'Webhook',
    icon: <WebhookIcon fontSize="small" />,
    color: '#9C27B0',
  },
  manual: {
    label: 'Manual',
    icon: <ManualIcon fontSize="small" />,
    color: '#4CAF50',
  },
};

export default function WorkflowList({
  workflows,
  onToggleActive,
  onDelete,
  onEdit,
  onViewRuns,
}: WorkflowListProps) {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; workflowId: string } | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, workflowId: string) => {
    event.stopPropagation();
    setMenuAnchor({ element: event.currentTarget, workflowId });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <TableContainer
      component={Paper}
      sx={{
        backgroundColor: theme.palette.mode === 'dark' ? 'background.paper' : 'white',
      }}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Trigger</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Steps</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Last Updated</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 100 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {workflows.map((workflow) => {
            const triggerConfig = triggerTypeConfig[workflow.trigger_type];
            const stepsCount = (workflow as unknown as { steps?: { count: number }[] }).steps?.[0]?.count || 0;

            return (
              <TableRow
                key={workflow.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => onEdit(workflow.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={workflow.is_active}
                    onChange={(e) => onToggleActive(workflow.id, e.target.checked)}
                    color="primary"
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      {workflow.name}
                    </Typography>
                    {workflow.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {workflow.description}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={triggerConfig.icon}
                    label={triggerConfig.label}
                    size="small"
                    sx={{
                      backgroundColor: `${triggerConfig.color}20`,
                      color: triggerConfig.color,
                      borderColor: triggerConfig.color,
                      '& .MuiChip-icon': {
                        color: triggerConfig.color,
                      },
                    }}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{stepsCount} steps</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(workflow.updated_at)}
                  </Typography>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="View Run History">
                      <IconButton
                        size="small"
                        onClick={() => onViewRuns(workflow.id)}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, workflow.id)}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              onEdit(menuAnchor.workflowId);
              handleMenuClose();
            }
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              onViewRuns(menuAnchor.workflowId);
              handleMenuClose();
            }
          }}
        >
          <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
          View Runs
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              onDelete(menuAnchor.workflowId);
              handleMenuClose();
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </TableContainer>
  );
}

