import { Box, Button, Typography, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Psychology as PsychologyIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
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

  const prompts = [
    {
      icon: <PsychologyIcon />,
      text: hasSpecs
        ? 'Analyze my clarity spec and suggest improvements'
        : 'Help me define a clear problem statement',
      show: true,
    },
    {
      icon: <AssignmentIcon />,
      text: hasEpics
        ? 'Review my epic and estimate complexity'
        : 'How should I structure my first epic?',
      show: hasSpecs,
    },
    {
      icon: <TrendingUpIcon />,
      text: hasTasks
        ? 'What tasks are blocking other work?'
        : 'What should I work on first?',
      show: true,
    },
    {
      icon: <SpeedIcon />,
      text: 'What should I focus on next?',
      show: true,
    },
    {
      icon: <AssignmentIcon />,
      text: 'Summarize my project progress',
      show: hasTasks,
    },
    {
      icon: <PsychologyIcon />,
      text: 'Are there any gaps in my product thinking?',
      show: hasSpecs,
    },
  ];

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
        Ask me anything about your project, or try one of these:
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          maxWidth: 600,
          mx: 'auto',
        }}
      >
        {prompts
          .filter((p) => p.show)
          .slice(0, 4)
          .map((prompt, idx) => (
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
              <Button
                fullWidth
                sx={{
                  py: 1.5,
                  px: 2,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  textTransform: 'none',
                  color: theme.palette.text.primary,
                }}
                startIcon={prompt.icon}
              >
                {prompt.text}
              </Button>
            </Paper>
          ))}
      </Box>
    </Box>
  );
}
