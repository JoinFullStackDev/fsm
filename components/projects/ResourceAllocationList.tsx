'use client';

import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import WorkloadIndicator from './WorkloadIndicator';
import type { ProjectMemberAllocation } from '@/types/project';

interface ResourceAllocationListProps {
  allocations: Array<ProjectMemberAllocation & {
    user?: {
      id: string;
      name: string | null;
      email: string;
      avatar_url?: string | null;
    };
  }>;
  workloads?: Map<string, any>;
  onEdit?: (allocation: ProjectMemberAllocation) => void;
  onDelete?: (allocationId: string) => void;
  loading?: boolean;
}

export default function ResourceAllocationList({
  allocations,
  workloads,
  onEdit,
  onDelete,
  loading = false,
}: ResourceAllocationListProps) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading allocations...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!allocations || allocations.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            No resource allocations found. Add allocations to track team member capacity.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Team Member</TableCell>
            <TableCell align="right">Hours/Week</TableCell>
            <TableCell>Period</TableCell>
            <TableCell>Utilization</TableCell>
            <TableCell>Notes</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {allocations.map((allocation) => {
            const workload = workloads?.get(allocation.user_id);
            const userName = allocation.user?.name || allocation.user?.email || 'Unknown User';
            
            return (
              <TableRow key={allocation.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {userName}
                  </Typography>
                  {allocation.user?.email && (
                    <Typography variant="caption" color="text.secondary">
                      {allocation.user.email}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {allocation.allocated_hours_per_week.toFixed(1)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {allocation.start_date && allocation.end_date
                      ? `${format(new Date(allocation.start_date), 'MMM d, yyyy')} - ${format(new Date(allocation.end_date), 'MMM d, yyyy')}`
                      : allocation.start_date
                        ? `From ${format(new Date(allocation.start_date), 'MMM d, yyyy')}`
                        : allocation.end_date
                          ? `Until ${format(new Date(allocation.end_date), 'MMM d, yyyy')}`
                          : 'No date range'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <WorkloadIndicator workload={workload} size="small" />
                </TableCell>
                <TableCell>
                  {allocation.notes ? (
                    <Tooltip title={allocation.notes}>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150 }}>
                        {allocation.notes}
                      </Typography>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      —
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                    {onEdit && (
                      <IconButton
                        size="small"
                        onClick={() => onEdit(allocation)}
                        aria-label="Edit allocation"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    {onDelete && (
                      <IconButton
                        size="small"
                        onClick={() => onDelete(allocation.id)}
                        aria-label="Delete allocation"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

