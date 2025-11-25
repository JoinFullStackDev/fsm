'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';

interface TemplateSyncIndicatorProps {
  templateId: string;
  onRefresh?: () => void;
}

export default function TemplateSyncIndicator({ templateId, onRefresh }: TemplateSyncIndicatorProps) {
  const [templateUpdatedAt, setTemplateUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const supabase = createSupabaseClient();

  const loadTemplateInfo = useCallback(async () => {
    const { data } = await supabase
      .from('project_templates')
      .select('updated_at, name')
      .eq('id', templateId)
      .single();

    if (data) {
      setTemplateUpdatedAt(data.updated_at);
    }
  }, [supabase, templateId]);

  useEffect(() => {
    loadTemplateInfo();
  }, [loadTemplateInfo]);

  const handleRefresh = async () => {
    console.log('[TemplateSyncIndicator] Refresh clicked for template:', templateId);
    setRefreshing(true);
    await loadTemplateInfo();
    if (onRefresh) {
      console.log('[TemplateSyncIndicator] Calling onRefresh callback');
      onRefresh();
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (!templateUpdatedAt) {
    return null;
  }

  const updatedDate = new Date(templateUpdatedAt);
  const timeAgo = getTimeAgo(updatedDate);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Tooltip title={`Template last updated: ${updatedDate.toLocaleString()}`}>
        <Chip
          icon={<InfoIcon />}
          label={`Template updated ${timeAgo}`}
          size="small"
          variant="outlined"
          sx={{
            borderColor: 'primary.main',
            color: 'text.secondary',
          }}
        />
      </Tooltip>
      <Tooltip title="Refresh to see latest template changes">
        <IconButton
          size="small"
          onClick={handleRefresh}
          disabled={refreshing}
          sx={{
            color: 'primary.main',
          }}
        >
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

