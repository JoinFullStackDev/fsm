'use client';

import { Box, TextField, Typography } from '@mui/material';
import type { TemplateFieldConfig } from '@/types/templates';
import type { Navigation } from '@/types/phases';

interface NavigationFieldProps {
  field: TemplateFieldConfig;
  value: Navigation;
  onChange: (value: Navigation) => void;
  error?: string;
  phaseData?: any;
}

export default function NavigationField({ field, value, onChange, error, phaseData }: NavigationFieldProps) {
  const config = field.field_config;
  const navigation = value || { primary_nav: [], secondary_nav: [], route_map: {} };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
          {error}
        </Typography>
      )}
      <TextField
        fullWidth
        label="Primary Navigation (comma-separated)"
        value={navigation.primary_nav?.join(', ') || ''}
        onChange={(e) => onChange({
          ...navigation,
          primary_nav: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
        })}
        margin="normal"
        size="small"
      />
      <TextField
        fullWidth
        label="Secondary Navigation (comma-separated)"
        value={navigation.secondary_nav?.join(', ') || ''}
        onChange={(e) => onChange({
          ...navigation,
          secondary_nav: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
        })}
        margin="normal"
        size="small"
      />
      <TextField
        fullWidth
        multiline
        rows={4}
        label="Route Map (JSON format)"
        value={JSON.stringify(navigation.route_map || {}, null, 2)}
        onChange={(e) => {
          try {
            const routeMap = JSON.parse(e.target.value);
            onChange({
              ...navigation,
              route_map: routeMap,
            });
          } catch {}
        }}
        margin="normal"
        size="small"
        placeholder='{"route1": "/path1", "route2": "/path2"}'
      />
    </Box>
  );
}

