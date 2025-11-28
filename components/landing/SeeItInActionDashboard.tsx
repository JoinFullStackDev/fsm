'use client';

import { motion } from 'framer-motion';
import {
  Box,
  Paper,
  Typography,
  useTheme,
  alpha,
  AppBar,
  Toolbar,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Menu as MenuIcon,
  Description as DescriptionIcon,
  Code as CodeIcon,
  Architecture as ArchitectureIcon,
  Assignment as TaskIcon,
} from '@mui/icons-material';

const mockArtifacts = [
  { id: 1, name: 'E-commerce PRD', type: 'PRD', date: '2 hours ago', status: 'Complete' },
  { id: 2, name: 'User Database Schema', type: 'ERD', date: '5 hours ago', status: 'Complete' },
  { id: 3, name: 'API Specification', type: 'Spec', date: '1 day ago', status: 'Complete' },
  { id: 4, name: 'Mobile App Blueprint', type: 'Blueprint', date: '2 days ago', status: 'In Progress' },
];

const mockBacklog = [
  { id: 1, item: 'User Authentication Flow', priority: 'High', phase: 'Phase 2', assignee: 'Team' },
  { id: 2, item: 'Payment Integration', priority: 'High', phase: 'Phase 3', assignee: 'Team' },
  { id: 3, item: 'Dashboard Analytics', priority: 'Medium', phase: 'Phase 4', assignee: 'Team' },
  { id: 4, item: 'Email Notifications', priority: 'Low', phase: 'Phase 5', assignee: 'Team' },
];

export default function SeeItInActionDashboard() {
  const theme = useTheme();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PRD':
        return <DescriptionIcon sx={{ fontSize: 16 }} />;
      case 'ERD':
        return <ArchitectureIcon sx={{ fontSize: 16 }} />;
      default:
        return <CodeIcon sx={{ fontSize: 16 }} />;
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        py: { xs: 6, md: 10 },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8 }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, mb: 4 }}>
          <Typography
            variant="h3"
            align="center"
            sx={{
              fontSize: { xs: '1.75rem', md: '2.5rem' },
              fontWeight: 700,
              mb: 1,
            }}
          >
            See It In Action
          </Typography>
          <Typography
            variant="h6"
            align="center"
            color="text.secondary"
            sx={{ mb: 4, maxWidth: '700px', mx: 'auto' }}
          >
            AI auto-generates documents and organizes work, saving hours for your team
          </Typography>
        </Box>

        {/* Mock Dashboard */}
        <Paper
          elevation={8}
          sx={{
            width: '100%',
            maxWidth: '1400px',
            mx: 'auto',
            borderRadius: 3,
            overflow: 'hidden',
            background: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            display: 'flex',
            flexDirection: 'column',
            minHeight: { xs: 'auto', md: '600px' },
            height: 'auto',
          }}
        >
          {/* Header */}
          <AppBar
            position="static"
            elevation={0}
            sx={{
              backgroundColor: theme.palette.background.paper,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              color: theme.palette.text.primary,
            }}
          >
            <Toolbar sx={{ px: 2, minHeight: '64px !important' }}>
              <IconButton edge="start" sx={{ mr: 2, display: { md: 'none' } }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
                FullStack Method
              </Typography>
              <IconButton sx={{ mr: 1 }}>
                <NotificationsIcon />
              </IconButton>
              <IconButton>
                <AccountCircleIcon />
              </IconButton>
            </Toolbar>
          </AppBar>

          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Sidebar - Collapsed with tooltips */}
            <Box
              sx={{
                width: { xs: 0, md: 64 },
                borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                backgroundColor: alpha(theme.palette.background.default, 0.5),
                display: { xs: 'none', md: 'block' },
              }}
            >
              <List sx={{ pt: 2, px: 0.5 }}>
                <Tooltip title="Dashboard" placement="right" arrow>
                  <ListItem
                    button
                    sx={{
                      justifyContent: 'center',
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      borderLeft: `3px solid ${theme.palette.primary.main}`,
                      borderRadius: 1,
                      mb: 0.5,
                      minHeight: 48,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.15),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 'auto', justifyContent: 'center' }}>
                      <DashboardIcon sx={{ color: theme.palette.primary.main }} />
                    </ListItemIcon>
                  </ListItem>
                </Tooltip>
                <Tooltip title="Projects" placement="right" arrow>
                  <ListItem
                    button
                    sx={{
                      justifyContent: 'center',
                      borderRadius: 1,
                      mb: 0.5,
                      minHeight: 48,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.5),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 'auto', justifyContent: 'center' }}>
                      <FolderIcon />
                    </ListItemIcon>
                  </ListItem>
                </Tooltip>
                <Tooltip title="Tasks" placement="right" arrow>
                  <ListItem
                    button
                    sx={{
                      justifyContent: 'center',
                      borderRadius: 1,
                      mb: 0.5,
                      minHeight: 48,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.5),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 'auto', justifyContent: 'center' }}>
                      <TaskIcon />
                    </ListItemIcon>
                  </ListItem>
                </Tooltip>
                <Tooltip title="Settings" placement="right" arrow>
                  <ListItem
                    button
                    sx={{
                      justifyContent: 'center',
                      borderRadius: 1,
                      mb: 0.5,
                      minHeight: 48,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.5),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 'auto', justifyContent: 'center' }}>
                      <SettingsIcon />
                    </ListItemIcon>
                  </ListItem>
                </Tooltip>
              </List>
            </Box>

            {/* Main Content Area */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto',
                backgroundColor: theme.palette.background.default,
              }}
            >
              <Box sx={{ p: { xs: 2, md: 4 }, flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                  Project Overview
                </Typography>

                {/* Content - Full Width Stacked */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Recently Generated Artifacts */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.5 }}
                  >
                    <Paper
                      elevation={2}
                      sx={{
                        p: 3,
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        Recently Generated Artifacts
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ border: 'none', py: 1 }}>Artifact</TableCell>
                              <TableCell sx={{ border: 'none', py: 1 }}>Type</TableCell>
                              <TableCell sx={{ border: 'none', py: 1 }} align="right">Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {mockArtifacts.map((artifact, index) => (
                              <TableRow
                                key={artifact.id}
                                sx={{
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.action.hover, 0.5),
                                  },
                                }}
                              >
                                <TableCell sx={{ border: 'none', py: 1.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {getTypeIcon(artifact.type)}
                                    <Box>
                                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {artifact.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {artifact.date}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </TableCell>
                                <TableCell sx={{ border: 'none', py: 1.5 }}>
                                  <Chip label={artifact.type} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell sx={{ border: 'none', py: 1.5 }} align="right">
                                  <Chip
                                    label={artifact.status}
                                    size="small"
                                    color={artifact.status === 'Complete' ? 'success' : 'warning'}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </motion.div>

                  {/* Product Backlog */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <Paper
                      elevation={2}
                      sx={{
                        p: 3,
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        Product Backlog
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ border: 'none', py: 1 }}>Item</TableCell>
                              <TableCell sx={{ border: 'none', py: 1 }}>Priority</TableCell>
                              <TableCell sx={{ border: 'none', py: 1 }}>Phase</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {mockBacklog.map((item, index) => (
                              <TableRow
                                key={item.id}
                                sx={{
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.action.hover, 0.5),
                                  },
                                }}
                              >
                                <TableCell sx={{ border: 'none', py: 1.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {item.item}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ border: 'none', py: 1.5 }}>
                                  <Chip
                                    label={item.priority}
                                    size="small"
                                    color={
                                      item.priority === 'High'
                                        ? 'error'
                                        : item.priority === 'Medium'
                                        ? 'warning'
                                        : 'default'
                                    }
                                  />
                                </TableCell>
                                <TableCell sx={{ border: 'none', py: 1.5 }}>
                                  <Chip label={item.phase} size="small" variant="outlined" />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </motion.div>
                </Box>
              </Box>
            </Box>
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
}

