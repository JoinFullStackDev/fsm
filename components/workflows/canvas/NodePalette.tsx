'use client';

import { Box, Typography, Paper, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  PlayArrow as PlayArrowIcon,
  BoltOutlined as BoltIcon,
  CallSplit as CallSplitIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

interface NodePaletteProps {
  onAddNode: (type: string, position?: { x: number; y: number }) => void;
}

const nodeTemplates = [
  {
    type: 'trigger',
    label: 'Trigger',
    description: 'Start workflow',
    icon: PlayArrowIcon,
    color: 'success.main',
  },
  {
    type: 'action',
    label: 'Action',
    description: 'Execute an action',
    icon: BoltIcon,
    color: 'primary.main',
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch logic',
    icon: CallSplitIcon,
    color: 'warning.main',
  },
  {
    type: 'delay',
    label: 'Delay',
    description: 'Wait before continuing',
    icon: ScheduleIcon,
    color: 'info.main',
  },
];

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  const theme = useTheme();

  const handleNodeClick = (type: string) => {
    onAddNode(type);
  };

  return (
    <Box
      sx={{
        width: 240,
        borderRight: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Node Palette
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Click to add to canvas
        </Typography>
      </Box>

      <List sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {nodeTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <ListItem key={template.type} disablePadding sx={{ mb: 1 }}>
              <Paper
                elevation={0}
                sx={{
                  width: '100%',
                  border: `1px solid ${theme.palette.divider}`,
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemButton
                  onClick={() => handleNodeClick(template.type)}
                  sx={{ py: 1.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Icon sx={{ color: template.color, fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={template.label}
                    secondary={template.description}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: 500,
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                    }}
                  />
                </ListItemButton>
              </Paper>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Drag nodes on canvas to connect them
        </Typography>
      </Box>
    </Box>
  );
}

