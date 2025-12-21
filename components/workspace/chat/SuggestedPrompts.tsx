import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Psychology as PsychologyIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Code as CodeIcon,
  BugReport as BugReportIcon,
  Group as GroupIcon,
  Schedule as ScheduleIcon,
  Flag as FlagIcon,
  Build as BuildIcon,
  IntegrationInstructions as IntegrationIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';

interface SuggestedPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  hasSpecs: boolean;
  hasEpics: boolean;
  hasTasks: boolean;
}

export default function SuggestedPrompts({
  onSelectPrompt,
  hasSpecs,
  hasEpics,
  hasTasks,
}: SuggestedPromptsProps) {
  const theme = useTheme();

  // Build prompts based on project state
  const prompts: Array<{ icon: React.ReactNode; text: string; show: boolean }> = [];

  // Always show these core prompts
  prompts.push({
    icon: <PsychologyIcon />,
    text: hasSpecs ? 'Analyze my clarity spec and suggest improvements' : 'Help me define a clear problem statement',
    show: true,
  });

  prompts.push({
    icon: <TrendingUpIcon />,
    text: hasTasks ? 'What tasks are blocking other work?' : 'What should I work on first?',
    show: true,
  });

  prompts.push({
    icon: <SpeedIcon />,
    text: 'What should I focus on next?',
    show: true,
  });

  prompts.push({
    icon: <GroupIcon />,
    text: 'Who has capacity for new tasks?',
    show: true,
  });

  // Show when project has specs
  if (hasSpecs) {
    prompts.push({
      icon: <AssignmentIcon />,
      text: hasEpics ? 'Review my epic and estimate complexity' : 'How should I structure my first epic?',
      show: true,
    });

    prompts.push({
      icon: <PsychologyIcon />,
      text: 'Are there any gaps in my product thinking?',
      show: true,
    });

    prompts.push({
      icon: <CodeIcon />,
      text: 'Generate implementation tasks for the current phase',
      show: true,
    });

    prompts.push({
      icon: <BuildIcon />,
      text: 'What engineering work is needed for MVP?',
      show: true,
    });

    prompts.push({
      icon: <BuildIcon />,
      text: 'What backend services need to be built?',
      show: true,
    });
  }

  // Show when project has epics
  if (hasEpics) {
    prompts.push({
      icon: <IntegrationIcon />,
      text: 'Create API integration tasks for this phase',
      show: true,
    });

    prompts.push({
      icon: <CodeIcon />,
      text: 'Break down the frontend implementation into tasks',
      show: true,
    });
  }

  // Show when project has tasks
  if (hasTasks) {
    prompts.push({
      icon: <BugReportIcon />,
      text: 'Generate QA test cases for recent features',
      show: true,
    });

    prompts.push({
      icon: <BugReportIcon />,
      text: 'What needs testing before release?',
      show: true,
    });

    prompts.push({
      icon: <BugReportIcon />,
      text: 'Create test plan tasks for this sprint',
      show: true,
    });

    prompts.push({
      icon: <GroupIcon />,
      text: 'Show task distribution by team member',
      show: true,
    });

    prompts.push({
      icon: <AssignmentIcon />,
      text: 'Summarize my project progress',
      show: true,
    });

    prompts.push({
      icon: <TimelineIcon />,
      text: 'What tasks should start this week?',
      show: true,
    });

    prompts.push({
      icon: <FlagIcon />,
      text: 'Are there any overdue or at-risk tasks?',
      show: true,
    });

    prompts.push({
      icon: <ScheduleIcon />,
      text: 'Help me plan the next sprint',
      show: true,
    });
  }

  // All prompts in the array are already filtered by conditions above
  const visiblePrompts = prompts;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
        Ask me anything about your project, or try one of these:
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          maxWidth: 700,
          mx: 'auto',
          maxHeight: 400,
          overflowY: 'auto',
          px: 1,
        }}
      >
        {visiblePrompts.map((prompt, idx) => (
          <Paper
            key={idx}
            elevation={0}
            sx={{
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              overflow: 'hidden',
              transition: 'all 0.2s',
              cursor: 'pointer',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                backgroundColor: theme.palette.action.hover,
                transform: 'translateX(4px)',
              },
            }}
            onClick={() => onSelectPrompt(prompt.text)}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1.25,
                px: 2,
                minHeight: 40,
              }}
            >
              <Box 
                component="span"
                sx={{ 
                  color: theme.palette.text.secondary, 
                  display: 'flex', 
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {prompt.icon}
              </Box>
              <span style={{ color: '#333', fontSize: '14px' }}>
                {prompt.text}
              </span>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
