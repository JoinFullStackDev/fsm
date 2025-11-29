'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Business as BusinessIcon,
  RocketLaunch as RocketLaunchIcon,
  TrendingUp as TrendingUpIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  People as PeopleIcon,
  Code as CodeIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Speed as SpeedIcon,
  Work as WorkIcon,
} from '@mui/icons-material';

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  widgets: Array<{
    widget_type: string;
    dataset: any;
    position: { x: number; y: number; w: number; h: number };
    settings: any;
  }>;
}

const TEMPLATES: DashboardTemplate[] = [
  {
    id: 'startup_pm',
    name: 'Startup PM',
    description: 'Project management focused dashboard for startups',
    icon: 'RocketLaunch',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Total Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'tasks_due_today' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Due Today', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'overdue_tasks' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'Overdue', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Phase Completion', format: 'percentage' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'day' },
        position: { x: 0, y: 2, w: 6, h: 4 },
        settings: { chartType: 'line', title: 'Task Timeline' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_status_distribution' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        settings: { chartType: 'pie', title: 'Task Status' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_priority_distribution' },
        position: { x: 0, y: 6, w: 4, h: 4 },
        settings: { chartType: 'pie', title: 'Task Priority' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 4, y: 6, w: 4, h: 4 },
        settings: { chartType: 'area', title: 'Phase Progress' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_status_distribution' },
        position: { x: 8, y: 6, w: 4, h: 4 },
        settings: { chartType: 'pie', title: 'Phase Status' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'tasks', limit: 10 },
        position: { x: 0, y: 10, w: 6, h: 4 },
        settings: { title: 'Recent Tasks' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'projects', limit: 8 },
        position: { x: 6, y: 10, w: 6, h: 4 },
        settings: { title: 'Active Projects' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 8 },
        position: { x: 0, y: 14, w: 12, h: 4 },
        settings: { title: 'Recent Activity' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'project_health', autoGenerate: false },
        position: { x: 0, y: 18, w: 12, h: 3 },
        settings: { title: 'Project Health Summary' },
      },
    ],
  },
  {
    id: 'agency_ops',
    name: 'Agency Ops',
    description: 'Operations focused dashboard for agencies',
    icon: 'Business',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'project_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Active Projects', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'opportunity_count' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Opportunities', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'company_count' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'Companies', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'user_count' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Team Members', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 0, y: 2, w: 3, h: 2 },
        settings: { title: 'Total Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 3, y: 2, w: 3, h: 2 },
        settings: { title: 'Completion Rate', format: 'percentage' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        settings: { chartType: 'area', title: 'Phase Completion Over Time' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'week' },
        position: { x: 0, y: 4, w: 6, h: 4 },
        settings: { chartType: 'bar', title: 'Task Velocity' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_status_distribution' },
        position: { x: 6, y: 6, w: 6, h: 4 },
        settings: { chartType: 'pie', title: 'Phase Status' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'opportunities', limit: 10 },
        position: { x: 0, y: 8, w: 6, h: 4 },
        settings: { title: 'Opportunities Pipeline' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'companies', limit: 10 },
        position: { x: 6, y: 8, w: 6, h: 4 },
        settings: { title: 'Companies' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'projects', limit: 10 },
        position: { x: 0, y: 12, w: 6, h: 4 },
        settings: { title: 'Active Projects' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 10 },
        position: { x: 6, y: 12, w: 6, h: 4 },
        settings: { title: 'Recent Activity' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'bottleneck_detection', autoGenerate: false },
        position: { x: 0, y: 16, w: 12, h: 3 },
        settings: { title: 'Operations Insights' },
      },
    ],
  },
  {
    id: 'executive_overview',
    name: 'Executive Overview',
    description: 'High-level KPIs and metrics for executives',
    icon: 'TrendingUp',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'project_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Projects', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'user_count' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Users', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'ai_tokens_used' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'AI Tokens', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'export_count' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Exports', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 0, y: 2, w: 3, h: 2 },
        settings: { title: 'Total Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 3, y: 2, w: 3, h: 2 },
        settings: { title: 'Completion', format: 'percentage' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'week' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        settings: { chartType: 'line', title: 'Task Velocity' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'ai_usage_timeline', groupBy: 'week' },
        position: { x: 0, y: 4, w: 6, h: 4 },
        settings: { chartType: 'bar', title: 'AI Usage' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'export_timeline', groupBy: 'week' },
        position: { x: 6, y: 6, w: 6, h: 4 },
        settings: { chartType: 'line', title: 'Export Activity' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_status_distribution' },
        position: { x: 0, y: 8, w: 6, h: 4 },
        settings: { chartType: 'pie', title: 'Phase Status' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_status_distribution' },
        position: { x: 6, y: 8, w: 6, h: 4 },
        settings: { chartType: 'pie', title: 'Task Status' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 10 },
        position: { x: 0, y: 12, w: 6, h: 4 },
        settings: { title: 'Recent Activity' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'projects', limit: 8 },
        position: { x: 6, y: 12, w: 6, h: 4 },
        settings: { title: 'Top Projects' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'risk_analysis', autoGenerate: false },
        position: { x: 0, y: 16, w: 12, h: 3 },
        settings: { title: 'Executive Summary' },
      },
    ],
  },
  {
    id: 'developer_focus',
    name: 'Developer Focus',
    description: 'Task and productivity metrics for developers',
    icon: 'Code',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'My Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'tasks_due_today' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Due Today', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'overdue_tasks' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'Overdue', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Progress', format: 'percentage' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'day' },
        position: { x: 0, y: 2, w: 6, h: 4 },
        settings: { chartType: 'line', title: 'Task Completion Timeline' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_priority_distribution' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        settings: { chartType: 'pie', title: 'Task Priority' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_status_distribution' },
        position: { x: 0, y: 6, w: 4, h: 4 },
        settings: { chartType: 'pie', title: 'Task Status' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 4, y: 6, w: 4, h: 4 },
        settings: { chartType: 'area', title: 'Phase Progress' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'ai_usage_timeline', groupBy: 'day' },
        position: { x: 8, y: 6, w: 4, h: 4 },
        settings: { chartType: 'bar', title: 'AI Usage' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'tasks', limit: 12 },
        position: { x: 0, y: 10, w: 8, h: 5 },
        settings: { title: 'My Tasks' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 8 },
        position: { x: 8, y: 10, w: 4, h: 5 },
        settings: { title: 'Activity' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'task_prioritization', autoGenerate: false },
        position: { x: 0, y: 15, w: 12, h: 3 },
        settings: { title: 'Task Recommendations' },
      },
    ],
  },
  {
    id: 'team_performance',
    name: 'Team Performance',
    description: 'Team productivity and activity metrics',
    icon: 'People',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'user_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Team Size', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Total Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'project_count' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'Active Projects', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Completion Rate', format: 'percentage' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'tasks_due_today' },
        position: { x: 0, y: 2, w: 3, h: 2 },
        settings: { title: 'Due Today', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'overdue_tasks' },
        position: { x: 3, y: 2, w: 3, h: 2 },
        settings: { title: 'Overdue', format: 'number' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'week' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        settings: { chartType: 'bar', title: 'Task Velocity' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_status_distribution' },
        position: { x: 0, y: 4, w: 6, h: 4 },
        settings: { chartType: 'pie', title: 'Task Status' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 6, y: 6, w: 6, h: 4 },
        settings: { chartType: 'area', title: 'Phase Progress' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_status_distribution' },
        position: { x: 0, y: 8, w: 4, h: 4 },
        settings: { chartType: 'pie', title: 'Phase Status' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 12 },
        position: { x: 4, y: 8, w: 8, h: 5 },
        settings: { title: 'Team Activity' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'tasks', limit: 10 },
        position: { x: 0, y: 12, w: 12, h: 4 },
        settings: { title: 'Recent Tasks' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'bottleneck_detection', autoGenerate: false },
        position: { x: 0, y: 16, w: 12, h: 3 },
        settings: { title: 'Team Insights' },
      },
    ],
  },
  {
    id: 'ai_analytics',
    name: 'AI Analytics',
    description: 'AI usage and performance tracking',
    icon: 'Analytics',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'ai_tokens_used' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Total AI Tokens', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'user_count' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'AI Users', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'project_count' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'AI Projects', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'AI Tasks', format: 'number' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'ai_usage_timeline', groupBy: 'day' },
        position: { x: 0, y: 2, w: 8, h: 4 },
        settings: { chartType: 'line', title: 'AI Usage Over Time' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'ai_usage_timeline', groupBy: 'week' },
        position: { x: 8, y: 2, w: 4, h: 4 },
        settings: { chartType: 'bar', title: 'Weekly Usage' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'day' },
        position: { x: 0, y: 6, w: 6, h: 4 },
        settings: { chartType: 'line', title: 'Task Generation' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'export_timeline', groupBy: 'week' },
        position: { x: 6, y: 6, w: 6, h: 4 },
        settings: { chartType: 'bar', title: 'Export Activity' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 15 },
        position: { x: 0, y: 10, w: 8, h: 5 },
        settings: { title: 'Recent AI Activity' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'projects', limit: 8 },
        position: { x: 8, y: 10, w: 4, h: 5 },
        settings: { title: 'AI Projects' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'risk_analysis', autoGenerate: false },
        position: { x: 0, y: 15, w: 12, h: 3 },
        settings: { title: 'AI Usage Insights' },
      },
    ],
  },
  {
    id: 'project_health',
    name: 'Project Health',
    description: 'Comprehensive project status and health metrics',
    icon: 'Assessment',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'project_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Total Projects', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Phase Completion', format: 'percentage' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'Total Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'overdue_tasks' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Overdue Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'tasks_due_today' },
        position: { x: 0, y: 2, w: 3, h: 2 },
        settings: { title: 'Due Today', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'user_count' },
        position: { x: 3, y: 2, w: 3, h: 2 },
        settings: { title: 'Team Members', format: 'number' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        settings: { chartType: 'area', title: 'Phase Progress' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_status_distribution' },
        position: { x: 0, y: 4, w: 6, h: 4 },
        settings: { chartType: 'pie', title: 'Phase Status' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_status_distribution' },
        position: { x: 6, y: 6, w: 6, h: 4 },
        settings: { chartType: 'pie', title: 'Task Status' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'week' },
        position: { x: 0, y: 8, w: 6, h: 4 },
        settings: { chartType: 'line', title: 'Task Velocity' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'projects', limit: 10 },
        position: { x: 6, y: 8, w: 6, h: 4 },
        settings: { title: 'Project Status' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'tasks', limit: 10 },
        position: { x: 0, y: 12, w: 6, h: 4 },
        settings: { title: 'Recent Tasks' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 10 },
        position: { x: 6, y: 12, w: 6, h: 4 },
        settings: { title: 'Project Activity' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'project_health', autoGenerate: false },
        position: { x: 0, y: 16, w: 12, h: 3 },
        settings: { title: 'Health Analysis' },
      },
    ],
  },
  {
    id: 'sales_pipeline',
    name: 'Sales Pipeline',
    description: 'Sales and opportunity tracking dashboard',
    icon: 'BarChart',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'opportunity_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Total Opportunities', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'company_count' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Companies', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'project_count' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'Won Projects', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'user_count' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Sales Team', format: 'number' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'week' },
        position: { x: 0, y: 2, w: 6, h: 4 },
        settings: { chartType: 'line', title: 'Sales Activity' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        settings: { chartType: 'area', title: 'Project Progress' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'opportunities', limit: 12 },
        position: { x: 0, y: 6, w: 8, h: 5 },
        settings: { title: 'Opportunities Pipeline' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'companies', limit: 10 },
        position: { x: 8, y: 6, w: 4, h: 5 },
        settings: { title: 'Top Companies' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'projects', limit: 8 },
        position: { x: 0, y: 11, w: 6, h: 4 },
        settings: { title: 'Active Projects' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 8 },
        position: { x: 6, y: 11, w: 6, h: 4 },
        settings: { title: 'Sales Activity' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'risk_analysis', autoGenerate: false },
        position: { x: 0, y: 15, w: 12, h: 3 },
        settings: { title: 'Sales Insights' },
      },
    ],
  },
  {
    id: 'productivity_tracker',
    name: 'Productivity Tracker',
    description: 'Track team productivity and output',
    icon: 'Speed',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Tasks Completed', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'export_count' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Exports', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'ai_tokens_used' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'AI Usage', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Progress', format: 'percentage' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'project_count' },
        position: { x: 0, y: 2, w: 3, h: 2 },
        settings: { title: 'Projects', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'user_count' },
        position: { x: 3, y: 2, w: 3, h: 2 },
        settings: { title: 'Team Size', format: 'number' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'week' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        settings: { chartType: 'bar', title: 'Weekly Task Output' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'export_timeline', groupBy: 'week' },
        position: { x: 0, y: 4, w: 6, h: 4 },
        settings: { chartType: 'line', title: 'Export Activity' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'ai_usage_timeline', groupBy: 'week' },
        position: { x: 6, y: 6, w: 6, h: 4 },
        settings: { chartType: 'bar', title: 'AI Usage Trends' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 0, y: 8, w: 6, h: 4 },
        settings: { chartType: 'area', title: 'Phase Progress' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 12 },
        position: { x: 6, y: 8, w: 6, h: 5 },
        settings: { title: 'Recent Activity' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'tasks', limit: 10 },
        position: { x: 0, y: 12, w: 12, h: 4 },
        settings: { title: 'Productivity Tasks' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'bottleneck_detection', autoGenerate: false },
        position: { x: 0, y: 16, w: 12, h: 3 },
        settings: { title: 'Productivity Insights' },
      },
    ],
  },
  {
    id: 'task_management',
    name: 'Task Management',
    description: 'Comprehensive task tracking and management',
    icon: 'Work',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Total Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'tasks_due_today' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Due Today', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'overdue_tasks' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'Overdue', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Completion', format: 'percentage' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_status_distribution' },
        position: { x: 0, y: 2, w: 4, h: 4 },
        settings: { chartType: 'pie', title: 'Task Status' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_priority_distribution' },
        position: { x: 4, y: 2, w: 4, h: 4 },
        settings: { chartType: 'pie', title: 'Task Priority' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'day' },
        position: { x: 8, y: 2, w: 4, h: 4 },
        settings: { chartType: 'line', title: 'Daily Tasks' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'week' },
        position: { x: 0, y: 6, w: 6, h: 4 },
        settings: { chartType: 'bar', title: 'Weekly Task Trends' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 6, y: 6, w: 6, h: 4 },
        settings: { chartType: 'area', title: 'Phase Progress' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'tasks', limit: 12 },
        position: { x: 0, y: 10, w: 8, h: 5 },
        settings: { title: 'All Tasks' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 8 },
        position: { x: 8, y: 10, w: 4, h: 5 },
        settings: { title: 'Task Activity' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'task_prioritization', autoGenerate: false },
        position: { x: 0, y: 15, w: 12, h: 3 },
        settings: { title: 'Task Recommendations' },
      },
    ],
  },
  {
    id: 'operations_overview',
    name: 'Operations Overview',
    description: 'Complete operations and business metrics',
    icon: 'Dashboard',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'project_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Projects', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'opportunity_count' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Opportunities', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'company_count' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'Companies', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'user_count' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Users', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 0, y: 2, w: 3, h: 2 },
        settings: { title: 'Total Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 3, y: 2, w: 3, h: 2 },
        settings: { title: 'Completion', format: 'percentage' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        settings: { chartType: 'area', title: 'Project Progress' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'week' },
        position: { x: 0, y: 4, w: 6, h: 4 },
        settings: { chartType: 'bar', title: 'Task Velocity' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_status_distribution' },
        position: { x: 6, y: 6, w: 6, h: 4 },
        settings: { chartType: 'pie', title: 'Phase Status' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'projects', limit: 10 },
        position: { x: 0, y: 8, w: 6, h: 4 },
        settings: { title: 'Active Projects' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'opportunities', limit: 10 },
        position: { x: 6, y: 8, w: 6, h: 4 },
        settings: { title: 'Opportunities' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'companies', limit: 8 },
        position: { x: 0, y: 12, w: 6, h: 4 },
        settings: { title: 'Companies' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 8 },
        position: { x: 6, y: 12, w: 6, h: 4 },
        settings: { title: 'Recent Activity' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'bottleneck_detection', autoGenerate: false },
        position: { x: 0, y: 16, w: 12, h: 3 },
        settings: { title: 'Operations Insights' },
      },
    ],
  },
  {
    id: 'analytics_dashboard',
    name: 'Analytics Dashboard',
    description: 'Data-driven insights and analytics',
    icon: 'PieChart',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'project_count' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Projects', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'ai_tokens_used' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'AI Tokens', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'export_count' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Exports', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'user_count' },
        position: { x: 0, y: 2, w: 3, h: 2 },
        settings: { title: 'Users', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 3, y: 2, w: 3, h: 2 },
        settings: { title: 'Completion', format: 'percentage' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'week' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        settings: { chartType: 'line', title: 'Task Trends' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'ai_usage_timeline', groupBy: 'week' },
        position: { x: 0, y: 4, w: 6, h: 4 },
        settings: { chartType: 'bar', title: 'AI Usage' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_status_distribution' },
        position: { x: 6, y: 6, w: 6, h: 4 },
        settings: { chartType: 'pie', title: 'Phase Status' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_status_distribution' },
        position: { x: 0, y: 8, w: 4, h: 4 },
        settings: { chartType: 'pie', title: 'Task Status' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'export_timeline', groupBy: 'week' },
        position: { x: 4, y: 8, w: 4, h: 4 },
        settings: { chartType: 'line', title: 'Export Trends' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 8, y: 8, w: 4, h: 4 },
        settings: { chartType: 'area', title: 'Phase Progress' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 12 },
        position: { x: 0, y: 12, w: 12, h: 5 },
        settings: { title: 'Activity Feed' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'risk_analysis', autoGenerate: false },
        position: { x: 0, y: 17, w: 12, h: 3 },
        settings: { title: 'Analytics Insights' },
      },
    ],
  },
  {
    id: 'timeline_view',
    name: 'Timeline View',
    description: 'Time-based project and task tracking',
    icon: 'Timeline',
    widgets: [
      {
        widget_type: 'metric',
        dataset: { dataSource: 'task_count' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        settings: { title: 'Total Tasks', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'project_count' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        settings: { title: 'Projects', format: 'number' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'phase_completion' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        settings: { title: 'Progress', format: 'percentage' },
      },
      {
        widget_type: 'metric',
        dataset: { dataSource: 'tasks_due_today' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        settings: { title: 'Due Today', format: 'number' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'day' },
        position: { x: 0, y: 2, w: 6, h: 5 },
        settings: { chartType: 'line', title: 'Task Timeline' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'phase_completion_timeline' },
        position: { x: 6, y: 2, w: 6, h: 5 },
        settings: { chartType: 'area', title: 'Phase Progress' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'ai_usage_timeline', groupBy: 'day' },
        position: { x: 0, y: 7, w: 4, h: 4 },
        settings: { chartType: 'bar', title: 'AI Usage Timeline' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'export_timeline', groupBy: 'day' },
        position: { x: 4, y: 7, w: 4, h: 4 },
        settings: { chartType: 'line', title: 'Export Timeline' },
      },
      {
        widget_type: 'chart',
        dataset: { dataSource: 'task_timeline', groupBy: 'week' },
        position: { x: 8, y: 7, w: 4, h: 4 },
        settings: { chartType: 'bar', title: 'Weekly Tasks' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'tasks', limit: 10 },
        position: { x: 0, y: 11, w: 6, h: 4 },
        settings: { title: 'Recent Tasks' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'projects', limit: 8 },
        position: { x: 6, y: 11, w: 6, h: 4 },
        settings: { title: 'Active Projects' },
      },
      {
        widget_type: 'table',
        dataset: { dataSource: 'recent_activity', limit: 10 },
        position: { x: 0, y: 15, w: 12, h: 4 },
        settings: { title: 'Timeline Activity' },
      },
      {
        widget_type: 'ai_insight',
        dataset: { insight_type: 'timeline_prediction', autoGenerate: false },
        position: { x: 0, y: 19, w: 12, h: 3 },
        settings: { title: 'Timeline Predictions' },
      },
    ],
  },
];

interface DashboardTemplatesProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: DashboardTemplate) => void;
}

const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'RocketLaunch':
      return RocketLaunchIcon;
    case 'Business':
      return BusinessIcon;
    case 'TrendingUp':
      return TrendingUpIcon;
    case 'Dashboard':
      return DashboardIcon;
    case 'Analytics':
      return AnalyticsIcon;
    case 'People':
      return PeopleIcon;
    case 'Code':
      return CodeIcon;
    case 'Assessment':
      return AssessmentIcon;
    case 'Timeline':
      return TimelineIcon;
    case 'BarChart':
      return BarChartIcon;
    case 'PieChart':
      return PieChartIcon;
    case 'Speed':
      return SpeedIcon;
    case 'Work':
      return WorkIcon;
    default:
      return BusinessIcon;
  }
};

export default function DashboardTemplates({ open, onClose, onSelect }: DashboardTemplatesProps) {
  const theme = useTheme();

  const handleSelect = (template: DashboardTemplate) => {
    onSelect(template);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Choose a Dashboard Template</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          {TEMPLATES.map((template) => {
            const IconComponent = getIcon(template.icon);
            return (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    '&:hover': {
                      border: `2px solid ${theme.palette.primary.main}`,
                    },
                  }}
                  onClick={() => handleSelect(template)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <IconComponent color="primary" />
                      <Typography variant="h6">{template.name}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {template.description}
                    </Typography>
                    <Chip
                      label={`${template.widgets.length} widgets`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
