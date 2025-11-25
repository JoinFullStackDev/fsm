'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  Card,
  CardContent,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { TemplateFieldGroup } from '@/types/templates';

interface FieldGroupProps {
  group: TemplateFieldGroup;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export default function FieldGroup({ group, children, defaultCollapsed }: FieldGroupProps) {
  const [collapsed, setCollapsed] = useState(
    group.collapsible ? (defaultCollapsed ?? group.defaultCollapsed ?? false) : false
  );

  if (!group.collapsible) {
    return (
      <Box sx={{ mb: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {group.label}
          </Typography>
          {group.description && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {group.description}
            </Typography>
          )}
        </Box>
        {children}
      </Box>
    );
  }

  return (
    <Card
      sx={{
        mb: 3,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'primary.main',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'rgba(0, 229, 255, 0.05)',
          },
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {group.label}
          </Typography>
          {group.description && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {group.description}
            </Typography>
          )}
        </Box>
        <IconButton size="small">
          {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </Box>
      <Collapse in={!collapsed}>
        <CardContent>{children}</CardContent>
      </Collapse>
    </Card>
  );
}

