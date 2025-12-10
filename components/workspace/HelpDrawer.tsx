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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Psychology as PsychologyIcon,
  AccountTree as AccountTreeIcon,
  MenuBook as MenuBookIcon,
  Lightbulb as LightbulbIcon,
  Keyboard as KeyboardIcon,
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
        },
      }}
    >
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            About Product Workspace
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Overview */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, backgroundColor: theme.palette.background.default }}>
          <Typography variant="body1" sx={{ lineHeight: 1.8, mb: 2 }}>
            Product Workspace is an upstream product thinking layer that helps teams define
            problems clearly before building solutions.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            It enforces clarity before execution through three integrated systems that work together
            to reduce ambiguity and improve handoffs.
          </Typography>
        </Paper>

        {/* The Three Systems */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          The Three Systems
        </Typography>

        <List sx={{ mb: 3 }}>
          <ListItem>
            <ListItemIcon>
              <PsychologyIcon sx={{ color: theme.palette.primary.main }} />
            </ListItemIcon>
            <ListItemText
              primary="Clarity Canvas"
              secondary="Define problems, capture business intent, identify outcomes. AI analyzes for completeness and suggests improvements."
              secondaryTypographyProps={{ sx: { lineHeight: 1.6 } }}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <AccountTreeIcon sx={{ color: theme.palette.success.main }} />
            </ListItemIcon>
            <ListItemText
              primary="Epic Builder"
              secondary="Decompose clarity specs into actionable FE/BE issues with AI. Generate tasks in FSM or export to GitLab."
              secondaryTypographyProps={{ sx: { lineHeight: 1.6 } }}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <MenuBookIcon sx={{ color: theme.palette.warning.main }} />
            </ListItemIcon>
            <ListItemText
              primary="Context Library"
              secondary="Track decisions with rationale and log technical/product debt. Preserves institutional knowledge."
              secondaryTypographyProps={{ sx: { lineHeight: 1.6 } }}
            />
          </ListItem>
        </List>

        <Divider sx={{ my: 3 }} />

        {/* Quick Tips */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Quick Tips
        </Typography>

        <Paper elevation={0} sx={{ p: 2, mb: 2, backgroundColor: theme.palette.background.default }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <LightbulbIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Start with Problems, Not Solutions
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Use Clarity Canvas to force clear problem definition before jumping to solutions.
            The AI readiness score helps identify gaps in your thinking.
          </Typography>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, mb: 2, backgroundColor: theme.palette.background.default }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <LightbulbIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Let AI Do the Decomposition
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Once your clarity spec is solid (7+/10 readiness), use Epic Builder to generate
            comprehensive FE/BE issues automatically. Review and refine as needed.
          </Typography>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, mb: 3, backgroundColor: theme.palette.background.default }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <LightbulbIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Document Decisions as You Go
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Use Context Library to capture why decisions were made. Future you (and your team)
            will thank you when revisiting similar problems.
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
