'use client';

import { motion } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  useTheme,
  alpha,
  Grid,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Code as CodeIcon,
  Architecture as ArchitectureIcon,
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

export default function MockTableSection() {
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
    <Grid container spacing={4}>
      <Grid item xs={12} md={6}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <Card
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
              border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
              borderRadius: 3,
            }}
          >
            <CardContent>
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
                        component={motion.tr}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1, duration: 0.3 }}
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
            </CardContent>
          </Card>
        </motion.div>
      </Grid>
      <Grid item xs={12} md={6}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
              border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
              borderRadius: 3,
            }}
          >
            <CardContent>
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
                        component={motion.tr}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
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
            </CardContent>
          </Card>
        </motion.div>
      </Grid>
    </Grid>
  );
}

