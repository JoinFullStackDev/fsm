'use client';

import { Alert, AlertTitle, Box, Typography, List, ListItem, ListItemText } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import type { ResourceAllocationConflict } from '@/types/project';

interface AllocationConflictWarningProps {
  conflicts: ResourceAllocationConflict[];
  onDismiss?: () => void;
}

export default function AllocationConflictWarning({ 
  conflicts, 
  onDismiss 
}: AllocationConflictWarningProps) {
  if (!conflicts || conflicts.length === 0) {
    return null;
  }

  return (
    <Alert 
      severity="warning" 
      icon={<WarningIcon />}
      onClose={onDismiss}
      sx={{ mb: 2 }}
    >
      <AlertTitle>Resource Allocation Conflicts Detected</AlertTitle>
      {conflicts.map((conflict, index) => (
        <Box key={index} sx={{ mt: index > 0 ? 2 : 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
            {conflict.user_name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {conflict.message}
          </Typography>
          {conflict.conflicting_projects && conflict.conflicting_projects.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                Conflicting Projects:
              </Typography>
              <List dense sx={{ py: 0 }}>
                {conflict.conflicting_projects.map((project, pIndex) => (
                  <ListItem key={pIndex} sx={{ py: 0, px: 1 }}>
                    <ListItemText
                      primary={project.project_name}
                      secondary={`${project.allocated_hours} hours/week`}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Current: {conflict.current_allocation.toFixed(1)} hours/week | 
            Max: {conflict.max_capacity} hours/week
          </Typography>
        </Box>
      ))}
    </Alert>
  );
}

