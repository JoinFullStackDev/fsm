'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  Card,
  CardContent,
  useTheme,
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
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(
    group.collapsible ? (defaultCollapsed ?? group.defaultCollapsed ?? false) : false
  );

  if (!group.collapsible) {
    return (
      <Box sx={{ mb: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif', color: theme.palette.text.primary }}>
            {group.label}
          </Typography>
          {group.description && (
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
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
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: { xs: 1.5, md: 2 },
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: theme.palette.action.hover,
          },
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif', color: theme.palette.text.primary }}>
            {group.label}
          </Typography>
          {group.description && (
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
              {group.description}
            </Typography>
          )}
        </Box>
        <IconButton 
          size="small"
          sx={{
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </Box>
      <Collapse in={!collapsed}>
        <CardContent sx={{ backgroundColor: theme.palette.background.paper, p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>{children}</CardContent>
      </Collapse>
    </Card>
  );
}

