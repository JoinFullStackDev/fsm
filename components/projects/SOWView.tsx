'use client';

import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { format } from 'date-fns';
import type { ScopeOfWork } from '@/types/project';

interface SOWViewProps {
  sow: ScopeOfWork;
}

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  draft: 'default',
  review: 'warning',
  approved: 'success',
  active: 'primary',
  completed: 'success',
  archived: 'default',
};

export default function SOWView({ sow }: SOWViewProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="h5">{sow.title}</Typography>
            <Chip
              label={sow.status}
              color={statusColors[sow.status] || 'default'}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Version {sow.version} • Created {format(new Date(sow.created_at), 'MMM d, yyyy')}
            {sow.approved_at && ` • Approved ${format(new Date(sow.approved_at), 'MMM d, yyyy')}`}
          </Typography>
        </CardContent>
      </Card>

      {sow.description && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Description</Typography>
            <Typography variant="body2" color="text.secondary">
              {sow.description}
            </Typography>
          </CardContent>
        </Card>
      )}

      {sow.objectives && sow.objectives.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Objectives</Typography>
            <List dense>
              {sow.objectives.map((objective, index) => (
                <ListItem key={index}>
                  <ListItemText primary={objective} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {sow.deliverables && sow.deliverables.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Deliverables</Typography>
            <List dense>
              {sow.deliverables.map((deliverable, index) => (
                <ListItem key={index}>
                  <ListItemText primary={deliverable} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {sow.timeline && Object.keys(sow.timeline).length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Timeline</Typography>
            {sow.timeline.start_date && sow.timeline.end_date && (
              <Typography variant="body2" color="text.secondary">
                {format(new Date(sow.timeline.start_date), 'MMM d, yyyy')} - {format(new Date(sow.timeline.end_date), 'MMM d, yyyy')}
              </Typography>
            )}
            {sow.timeline.milestones && sow.timeline.milestones.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Milestones</Typography>
                <List dense>
                  {sow.timeline.milestones.map((milestone, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={milestone.name}
                        secondary={milestone.date ? format(new Date(milestone.date), 'MMM d, yyyy') : undefined}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {sow.budget && Object.keys(sow.budget).length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Budget</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sow.budget.estimated_hours && (
                <Typography variant="body2">
                  Estimated Hours: {sow.budget.estimated_hours}
                </Typography>
              )}
              {sow.budget.hourly_rate && (
                <Typography variant="body2">
                  Hourly Rate: ${sow.budget.hourly_rate}
                </Typography>
              )}
              {sow.budget.total_budget && (
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  Total Budget: ${sow.budget.total_budget.toLocaleString()}
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {sow.assumptions && sow.assumptions.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Assumptions</Typography>
            <List dense>
              {sow.assumptions.map((assumption, index) => (
                <ListItem key={index}>
                  <ListItemText primary={assumption} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {sow.constraints && sow.constraints.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Constraints</Typography>
            <List dense>
              {sow.constraints.map((constraint, index) => (
                <ListItem key={index}>
                  <ListItemText primary={constraint} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {sow.exclusions && sow.exclusions.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Exclusions</Typography>
            <List dense>
              {sow.exclusions.map((exclusion, index) => (
                <ListItem key={index}>
                  <ListItemText primary={exclusion} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {sow.acceptance_criteria && sow.acceptance_criteria.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Acceptance Criteria</Typography>
            <List dense>
              {sow.acceptance_criteria.map((criterion, index) => (
                <ListItem key={index}>
                  <ListItemText primary={criterion} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

