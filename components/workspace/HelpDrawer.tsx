import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Psychology as PsychologyIcon,
  AccountTree as AccountTreeIcon,
  MenuBook as MenuBookIcon,
  Lightbulb as LightbulbIcon,
  Keyboard as KeyboardIcon,
  ShowChart as ShowChartIcon,
  Explore as ExploreIcon,
  Flag as FlagIcon,
  Map as MapIcon,
  Groups as GroupsIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  const theme = useTheme();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 480,
          maxWidth: '90vw',
          backgroundColor: theme.palette.background.paper,
          borderLeft: `1px solid ${theme.palette.divider}`,
          transform: 'translateY(60px) !important',
        },
      }}
    >
      <Box sx={{ p: 3, maxHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Product Workspace
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Overview */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, backgroundColor: theme.palette.background.default }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesomeIcon sx={{ color: theme.palette.primary.main }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              AI-Powered Product Development
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ lineHeight: 1.8, mb: 2 }}>
            A comprehensive suite of 8 integrated systems designed to support the entire product development lifecycle—from initial strategy through stakeholder communication.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Each system feeds context to the AI assistant, enabling intelligent, context-aware guidance throughout your product journey.
          </Typography>
        </Paper>

        {/* The Eight Systems */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Core Systems
        </Typography>

        <List sx={{ mb: 2 }} dense>
          <ListItem>
            <ListItemIcon>
              <FlagIcon sx={{ color: '#6366F1' }} />
            </ListItemIcon>
            <ListItemText
              primary="Strategy Canvas"
              secondary="Define your product vision, North Star metric, strategic bets, and design principles."
              secondaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <ExploreIcon sx={{ color: '#8B5CF6' }} />
            </ListItemIcon>
            <ListItemText
              primary="Discovery Hub"
              secondary="Capture user insights, run experiments, and aggregate feedback to validate assumptions."
              secondaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <PsychologyIcon sx={{ color: '#EC4899' }} />
            </ListItemIcon>
            <ListItemText
              primary="Clarity Canvas"
              secondary="Define problems clearly with solution hypotheses. AI scores readiness for implementation."
              secondaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <ShowChartIcon sx={{ color: '#10B981' }} />
            </ListItemIcon>
            <ListItemText
              primary="Success Metrics"
              secondary="Track KPIs with targets, monitor health status, and validate product outcomes."
              secondaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <AccountTreeIcon sx={{ color: '#F59E0B' }} />
            </ListItemIcon>
            <ListItemText
              primary="Epic Builder"
              secondary="Break down features into FE/BE issues with AI assistance. Generate tasks automatically."
              secondaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <MapIcon sx={{ color: '#3B82F6' }} />
            </ListItemIcon>
            <ListItemText
              primary="Roadmap Planner"
              secondary="Prioritize features with RICE scoring, plan releases, and track dependencies."
              secondaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <GroupsIcon sx={{ color: '#14B8A6' }} />
            </ListItemIcon>
            <ListItemText
              primary="Stakeholder Hub"
              secondary="Manage relationships with power/interest matrix. AI drafts stakeholder updates."
              secondaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <MenuBookIcon sx={{ color: '#EF4444' }} />
            </ListItemIcon>
            <ListItemText
              primary="Context Library"
              secondary="Document decisions with rationale and track technical/product debt."
              secondaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
            />
          </ListItem>
        </List>

        <Divider sx={{ my: 3 }} />

        {/* AI Assistant */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          AI Assistant Capabilities
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
          <Chip label="Strategic Q&A" size="small" variant="outlined" />
          <Chip label="Insight Analysis" size="small" variant="outlined" />
          <Chip label="Progress Tracking" size="small" variant="outlined" />
          <Chip label="Priority Suggestions" size="small" variant="outlined" />
          <Chip label="Stakeholder Updates" size="small" variant="outlined" />
          <Chip label="Risk Identification" size="small" variant="outlined" />
        </Box>

        <Paper elevation={0} sx={{ p: 2, mb: 3, backgroundColor: theme.palette.background.default }}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            The AI assistant has access to all your workspace data. Ask questions like &quot;What are our users&apos; top pain points?&quot;, &quot;Are we on track for our metrics?&quot;, or &quot;Help me draft a stakeholder update.&quot;
          </Typography>
        </Paper>

        <Divider sx={{ my: 3 }} />

        {/* Quick Tips */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Workflow Tips
        </Typography>

        <Paper elevation={0} sx={{ p: 2, mb: 2, backgroundColor: theme.palette.background.default }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <LightbulbIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Start with Strategy
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Define your North Star metric and strategic bets before diving into features. This provides context for all downstream decisions.
          </Typography>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, mb: 2, backgroundColor: theme.palette.background.default }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <LightbulbIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Validate Before Building
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Use Discovery Hub to capture insights and run experiments. Feed validated learnings into your Clarity specs.
          </Typography>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, mb: 3, backgroundColor: theme.palette.background.default }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <LightbulbIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Keep Stakeholders Aligned
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Use the Stakeholder Hub to track alignment and let AI draft updates based on your actual progress and metrics.
          </Typography>
        </Paper>

        <Divider sx={{ my: 3 }} />

        {/* Keyboard Shortcuts */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Keyboard Shortcuts
        </Typography>

        <List dense sx={{ '& .MuiListItem-root': { py: 0.5 } }}>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <KeyboardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Send message</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enter
                  </Typography>
                </Box>
              }
            />
          </ListItem>

          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <KeyboardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">New line</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Shift + Enter
                  </Typography>
                </Box>
              }
            />
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
}
