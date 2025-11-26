'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Chip,
  Link,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  History as HistoryIcon,
  PersonAdd as PersonAddIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  FolderOpen as FolderIcon,
  Assignment as TaskIcon,
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Label as LabelIcon,
  Phone as PhoneIcon,
  AssignmentInd as AssignmentIcon,
  Timeline as TimelineIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import type { ActivityFeedItem, ActivityEventType } from '@/types/ops';

interface CompanyActivityTabProps {
  companyId: string;
}

export default function CompanyActivityTab({ companyId }: CompanyActivityTabProps) {
  const router = useRouter();
  const theme = useTheme();
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ops/companies/${companyId}/activity?limit=50`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load activity feed');
      }

      const data = await response.json();
      setActivities(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load activity feed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const getEventTypeIcon = (eventType: ActivityEventType) => {
    switch (eventType) {
      case 'contact_created':
        return <PersonAddIcon sx={{ fontSize: 20 }} />;
      case 'contact_updated':
        return <PersonIcon sx={{ fontSize: 20 }} />;
      case 'opportunity_created':
      case 'opportunity_status_changed':
        return <TrendingUpIcon sx={{ fontSize: 20 }} />;
      case 'project_created':
        return <FolderIcon sx={{ fontSize: 20 }} />;
      case 'task_created':
      case 'task_updated':
        return <TaskIcon sx={{ fontSize: 20 }} />;
      case 'company_status_updated':
        return <BusinessIcon sx={{ fontSize: 20 }} />;
      case 'lead_status_changed':
        return <CheckCircleIcon sx={{ fontSize: 20 }} />;
      case 'pipeline_stage_changed':
        return <TimelineIcon sx={{ fontSize: 20 }} />;
      case 'tag_added':
      case 'tag_removed':
        return <LabelIcon sx={{ fontSize: 20 }} />;
      case 'interaction_created':
        return <PhoneIcon sx={{ fontSize: 20 }} />;
      case 'attachment_uploaded':
        return <AttachFileIcon sx={{ fontSize: 20 }} />;
      case 'assignment_changed':
        return <AssignmentIcon sx={{ fontSize: 20 }} />;
      default:
        return <HistoryIcon sx={{ fontSize: 20 }} />;
    }
  };

  const getEventTypeColor = (eventType: ActivityEventType) => {
    if (eventType.includes('created')) return 'success';
    if (eventType.includes('updated')) return 'info';
    if (eventType.includes('status_changed')) return 'warning';
    if (eventType === 'tag_added') return 'primary';
    if (eventType === 'interaction_created') return 'success';
    return 'default';
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleEntityClick = (activity: ActivityFeedItem) => {
    if (!activity.related_entity_id || !activity.related_entity_type) return;

    switch (activity.related_entity_type) {
      case 'contact':
        router.push(`/ops/contacts/${activity.related_entity_id}/edit`);
        break;
      case 'opportunity':
        router.push(`/ops/opportunities/${activity.related_entity_id}`);
        break;
      case 'project':
        router.push(`/project/${activity.related_entity_id}`);
        break;
      case 'task':
        // Tasks don't have a detail page, but we could navigate to company tasks tab
        router.push(`/ops/companies/${companyId}`);
        break;
      default:
        break;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const formatEventTypeLabel = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const filteredActivities = eventTypeFilter === 'all' 
    ? activities 
    : activities.filter(activity => activity.event_type === eventTypeFilter);

  // Get unique event types from activities for the filter dropdown
  const availableEventTypes = Array.from(new Set(activities.map(a => a.event_type))).sort();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  if (activities.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <HistoryIcon sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2, opacity: 0.5 }} />
        <Typography variant="h6" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          No Activity Yet
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          Activity will appear here as you work with this company
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h6"
          sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
          }}
        >
          Activity Feed
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel sx={{ color: theme.palette.text.secondary }}>Filter by Type</InputLabel>
          <Select
            value={eventTypeFilter}
            label="Filter by Type"
            onChange={(e) => setEventTypeFilter(e.target.value)}
            sx={{
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.background.paper,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.divider,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.text.secondary,
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.text.primary,
              },
              '& .MuiSvgIcon-root': {
                color: theme.palette.text.primary,
              },
            }}
          >
            <MenuItem value="all">All Types</MenuItem>
            {availableEventTypes.map((eventType) => (
              <MenuItem key={eventType} value={eventType}>
                {formatEventTypeLabel(eventType)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {filteredActivities.length === 0 && activities.length > 0 && (
        <Alert 
          severity="info" 
          sx={{ 
            mb: 2,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.secondary,
          }}
        >
          No activities match the selected filter.
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filteredActivities.map((activity) => {
          const hasClickableEntity = activity.related_entity_id && activity.related_entity_type;
          const isClickable = hasClickableEntity && 
            (activity.related_entity_type === 'contact' || 
             activity.related_entity_type === 'opportunity' || 
             activity.related_entity_type === 'project');

          return (
            <Paper
              key={activity.id}
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                cursor: isClickable ? 'pointer' : 'default',
                transition: 'all 0.2s',
                '&:hover': isClickable ? {
                  borderColor: theme.palette.text.secondary,
                  backgroundColor: theme.palette.action.hover,
                } : {},
              }}
              onClick={() => isClickable && handleEntityClick(activity)}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box
                  sx={{
                    color: theme.palette.text.primary,
                    display: 'flex',
                    alignItems: 'center',
                    mt: 0.5,
                  }}
                >
                  {getEventTypeIcon(activity.event_type)}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={activity.event_type.replace(/_/g, ' ')}
                      color={getEventTypeColor(activity.event_type) as any}
                      size="small"
                      icon={getEventTypeIcon(activity.event_type)}
                    />
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                      {formatDate(activity.created_at)}
                    </Typography>
                  </Box>
                  <Typography 
                    sx={{ 
                      color: theme.palette.text.primary,
                      ...(isClickable && {
                        '&:hover': {
                          color: theme.palette.text.secondary,
                        },
                      }),
                    }}
                  >
                    {activity.message}
                    
                    {/* Show interaction details if available */}
                    {(activity as any).interaction_details && (
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.default, borderRadius: 1, p: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <PhoneIcon sx={{ fontSize: 16, color: theme.palette.text.primary }} />
                          <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                            {(activity as any).interaction_details.interaction_type}
                          </Typography>
                          {(activity as any).interaction_details.created_user && (
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, ml: 'auto' }}>
                              by {(activity as any).interaction_details.created_user.name || (activity as any).interaction_details.created_user.email}
                            </Typography>
                          )}
                        </Box>
                        {(activity as any).interaction_details.subject && (
                          <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 600, mb: 0.5 }}>
                            {(activity as any).interaction_details.subject}
                          </Typography>
                        )}
                        <Typography variant="body2" sx={{ color: theme.palette.text.primary, whiteSpace: 'pre-wrap', mb: 0.5 }}>
                          {(activity as any).interaction_details.notes}
                        </Typography>
                        {(activity as any).interaction_details.interaction_date && (
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            Interaction date: {new Date((activity as any).interaction_details.interaction_date).toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Show tag details if available */}
                    {(activity as any).tag_details && (
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.default, borderRadius: 1, p: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LabelIcon sx={{ fontSize: 16, color: theme.palette.text.primary }} />
                          <Chip
                            label={(activity as any).tag_details.tag_name}
                            size="small"
                            sx={{
                              backgroundColor: theme.palette.background.paper,
                              color: theme.palette.text.primary,
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          />
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, ml: 'auto' }}>
                            Added {new Date((activity as any).tag_details.created_at).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {/* Show attachment details if available */}
                    {(activity as any).attachment_details && (
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.default, borderRadius: 1, p: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <AttachFileIcon sx={{ fontSize: 16, color: theme.palette.text.primary }} />
                          <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 500, flex: 1 }}>
                            {(activity as any).attachment_details.file_name}
                          </Typography>
                          {(activity as any).attachment_details.uploaded_user && (
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                              by {(activity as any).attachment_details.uploaded_user.name || (activity as any).attachment_details.uploaded_user.email}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            {formatFileSize((activity as any).attachment_details.file_size)}
                            {(activity as any).attachment_details.file_type && ` • ${(activity as any).attachment_details.file_type}`}
                            {' • '}
                            Uploaded {new Date((activity as any).attachment_details.created_at).toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<OpenInNewIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open((activity as any).attachment_details.file_path, '_blank');
                            }}
                            sx={{
                              borderColor: theme.palette.text.primary,
                              color: theme.palette.text.primary,
                              '&:hover': {
                                borderColor: theme.palette.text.secondary,
                                backgroundColor: theme.palette.action.hover,
                              },
                            }}
                          >
                            Open
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              const link = document.createElement('a');
                              link.href = (activity as any).attachment_details.file_path;
                              link.download = (activity as any).attachment_details.file_name;
                              link.click();
                            }}
                            sx={{
                              borderColor: theme.palette.text.primary,
                              color: theme.palette.text.primary,
                              '&:hover': {
                                borderColor: theme.palette.text.secondary,
                                backgroundColor: theme.palette.action.hover,
                              },
                            }}
                          >
                            Download
                          </Button>
                        </Box>
                      </Box>
                    )}

                    {isClickable && (
                      <Link
                        component="span"
                        sx={{
                          ml: 1,
                          color: theme.palette.text.primary,
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                            color: theme.palette.text.secondary,
                          },
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEntityClick(activity);
                        }}
                      >
                        View →
                      </Link>
                    )}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}

