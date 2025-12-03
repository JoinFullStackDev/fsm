'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/providers/NotificationProvider';
import { motion } from 'framer-motion';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  useTheme,
  alpha,
  Paper,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  Rocket as RocketIcon,
  AutoAwesome as AIIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import FeatureCard from '@/components/landing/FeatureCard';
import PricingCard from '@/components/landing/PricingCard';
import SignupModal from '@/components/landing/SignupModal';
import MockDashboard from '@/components/landing/MockDashboard';
import ProcessStepper from '@/components/landing/ProcessStepper';
import LandingHeader from '@/components/landing/LandingHeader';
import InteractiveMockUI from '@/components/landing/InteractiveMockUI';
import SeeItInActionDashboard from '@/components/landing/SeeItInActionDashboard';
import type { PackageFeatures, Package } from '@/lib/organizationContext';

export default function HomePage() {
  const theme = useTheme();
  const router = useRouter();
  const { showSuccess } = useNotification();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [signupModalOpen, setSignupModalOpen] = useState(false);

  useEffect(() => {
    loadPackages();
    
    // Check for sign-out success message
    if (typeof window !== 'undefined') {
      const signoutSuccess = sessionStorage.getItem('signout_success');
      if (signoutSuccess === 'true') {
        sessionStorage.removeItem('signout_success');
        showSuccess('You have been signed out successfully');
      }
    }
  }, [showSuccess]);

  const loadPackages = async () => {
    try {
      const response = await fetch('/api/packages', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log('[HomePage] Loaded packages:', data.packages?.length, 'packages');
        console.log('[HomePage] Package names:', data.packages?.map((p: Package) => p.name).join(', '));
        setPackages(data.packages || []);
      }
    } catch (err) {
      console.error('Failed to load packages:', err);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <RocketIcon sx={{ fontSize: 32 }} />,
      title: 'Guided Process',
      description: 'Step-by-step guidance through all 6 phases of product development',
    },
    {
      icon: <AIIcon sx={{ fontSize: 32 }} />,
      title: 'AI-Powered',
      description: 'Generate PRDs, ERDs, and user stories in minutes with AI assistance',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 32 }} />,
      title: 'Enterprise Ready',
      description: 'Multi-tenant architecture with RBAC, audit trails, and team collaboration',
    },
    {
      icon: <AnalyticsIcon sx={{ fontSize: 32 }} />,
      title: 'Reporting & Insights',
      description: 'See progress, risks, and blockers at a glance with real-time analytics',
    },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse at top, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 50%),
                     radial-gradient(ellipse at bottom, ${alpha(theme.palette.secondary.main, 0.1)} 0%, transparent 50%),
                     ${theme.palette.background.default}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <LandingHeader />
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, px: { xs: 0, md: 3 } }}>
        {/* Hero Section */}
        <Box
          sx={{
            pt: { xs: 10, md: 16 }, // Add extra padding to account for fixed header
            pb: { xs: 8, md: 12 },
            minHeight: { xs: 'auto', md: '90vh' },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Box sx={{ flex: 1, zIndex: 2 }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
                  fontWeight: 800,
                  mb: 2,
                  lineHeight: 1.1,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                FullStack Method™ App
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  color: 'text.secondary',
                  mb: 4,
                  fontWeight: 400,
                  lineHeight: 1.6,
                  maxWidth: '600px',
                }}
              >
                The complete system for building products. From idea to deployment, we guide you through every phase with AI-powered tools.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => router.push('/auth/signup')}
                    sx={{
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      borderRadius: 2,
                    }}
                  >
                    Get Started Free
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => router.push('/auth/signin')}
                    sx={{
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      borderRadius: 2,
                    }}
                  >
                    Sign In
                  </Button>
                </motion.div>
              </Box>
            </motion.div>
          </Box>
          <Box
            sx={{
              flex: 1,
              maxWidth: { xs: '100%', md: 600 },
              mt: { xs: 4, md: 0 },
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            >
              <MockDashboard />
            </motion.div>
          </Box>
        </Box>

        {/* Feature Highlight Strip */}
        {/* <Box sx={{ py: { xs: 6, md: 10 } }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <Typography
              variant="h2"
              align="center"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                fontWeight: 700,
                mb: 1,
              }}
            >
              Everything You Need
            </Typography>
            <Typography
              variant="h6"
              align="center"
              color="text.secondary"
              sx={{ mb: 6, maxWidth: '700px', mx: 'auto' }}
            >
              Powerful features to accelerate your product development
            </Typography>
          </motion.div>
          <Grid container spacing={3}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} md={3} key={feature.title}>
                <FeatureCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  delay={index * 0.1}
                />
              </Grid>
            ))}
          </Grid>
        </Box> */}

        {/* How It Works / Process Section */}
        <Box
          sx={{
            py: { xs: 6, md: 10 },
            background: `radial-gradient(ellipse at center, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 70%)`,
            borderRadius: 4,
            px: 2,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.3 }}
          >
            <Typography
              variant="h2"
              align="center"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                fontWeight: 700,
                mb: 1,
              }}
            >
              Everything You Need
            </Typography>
            <Typography
              variant="h6"
              align="center"
              color="text.secondary"
              sx={{ mb: 6, maxWidth: '700px', mx: 'auto' }}
            >
              Powerful features to accelerate your product development
            </Typography>
          </motion.div>
          <ProcessStepper />
        </Box>

        {/* Interactive Mock UI Banner - Hero Moment */}
        <InteractiveMockUI />

        {/* Comparison Table Section */}
        <Box sx={{ py: { xs: 6, md: 10 }, mt: 4 }}>
          <Divider
            sx={{
              mb: 8,
              borderColor: theme.palette.divider,
              borderWidth: 2,
              '&::before, &::after': {
                borderColor: theme.palette.divider,
                borderWidth: 2,
              },
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            style={{ width: '100%' }}
          >
            <Typography
              variant="h2"
              align="center"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                fontWeight: 700,
                mb: 1,
              }}
            >
              FSM vs. The Competition
            </Typography>
            <Typography
              variant="h6"
              align="center"
              color="text.secondary"
              sx={{ mb: 6, maxWidth: '700px', mx: 'auto' }}
            >
              See how FullStack Method™ compares to other product development tools
            </Typography>
          </motion.div>

          <TableContainer
            component={Paper}
            sx={{
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              overflowX: 'auto',
              overflowY: 'hidden',
              backgroundColor: theme.palette.background.paper,
              maxWidth: '100%',
            }}
          >
            <Table sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow
                  sx={{
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    '& th': {
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    },
                  }}
                >
                  <TableCell 
                    sx={{ 
                      width: '30%', 
                      minWidth: { xs: 180, md: 200 },
                      position: 'sticky', 
                      left: 0, 
                      backgroundColor: theme.palette.background.default, 
                      zIndex: 2,
                      boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                      fontSize: { xs: '0.875rem', md: '1rem' },
                    }}
                  >
                    Feature
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: theme.palette.primary.main, minWidth: 120 }}>
                    FSM
                  </TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>Jira</TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>Linear</TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>Notion</TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>Asana</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  // All platforms have these (all green checks)
                  { feature: 'Project Templates', fsm: true, jira: true, linear: true, notion: true, asana: true },
                  { feature: 'Team Collaboration', fsm: true, jira: true, linear: true, notion: true, asana: true },
                  { feature: 'Task Management', fsm: true, jira: true, linear: true, notion: true, asana: true },
                  { feature: 'RBAC & Permissions', fsm: true, jira: true, linear: true, notion: true, asana: true },
                  { feature: 'API Access', fsm: true, jira: true, linear: true, notion: true, asana: true },
                  // Most platforms have these (progression)
                  { feature: 'Real-time Analytics', fsm: true, jira: true, linear: true, notion: false, asana: true },
                  { feature: 'Multi-tenant Architecture', fsm: true, jira: true, linear: false, notion: false, asana: true },
                  { feature: 'GitHub Integration', fsm: true, jira: true, linear: true, notion: false, asana: false },
                  { feature: 'Audit Trails', fsm: true, jira: true, linear: false, notion: false, asana: false },
                  // FSM-only features (only FSM has green check)
                  { feature: 'Export to Cursor/Blueprint', fsm: true, jira: false, linear: false, notion: false, asana: false },
                  { feature: 'Custom Branding', fsm: true, jira: false, linear: false, notion: false, asana: false },
                  { feature: 'AI-Powered PRD Generation', fsm: true, jira: false, linear: false, notion: false, asana: false },
                  { feature: 'Phase-Based Workflow', fsm: true, jira: false, linear: false, notion: false, asana: false },
                  { feature: 'Built-in ERD Generator', fsm: true, jira: false, linear: false, notion: false, asana: false },
                  { feature: 'Automated User Stories', fsm: true, jira: false, linear: false, notion: false, asana: false },
                ].map((row, index) => (
                  <TableRow
                    key={row.feature}
                    sx={{
                      '&:nth-of-type(odd)': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.05),
                      },
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      },
                      '& td': {
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        py: 2,
                      },
                    }}
                  >
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{
                        fontWeight: 600,
                        position: 'sticky',
                        left: 0,
                        backgroundColor: index % 2 === 0
                          ? theme.palette.background.paper
                          : theme.palette.background.default,
                        zIndex: 1,
                        boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                        minWidth: { xs: 180, md: 200 },
                        fontSize: { xs: '0.75rem', md: '0.875rem' },
                      }}
                    >
                      {row.feature}
                    </TableCell>
                    <TableCell align="center">
                      {row.fsm ? (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: '#4caf50',
                            color: '#ffffff',
                          }}
                        >
                          <CheckIcon sx={{ fontSize: 20, color: '#ffffff' }} />
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: '#f44336',
                            color: '#ffffff',
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 20, color: '#ffffff' }} />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {row.jira ? (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: '#4caf50',
                            color: '#ffffff',
                          }}
                        >
                          <CheckIcon sx={{ fontSize: 20, color: '#ffffff' }} />
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: '#f44336',
                            color: '#ffffff',
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 20, color: '#ffffff' }} />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {row.linear ? (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: '#4caf50',
                            color: '#ffffff',
                          }}
                        >
                          <CheckIcon sx={{ fontSize: 20, color: '#ffffff' }} />
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: '#f44336',
                            color: '#ffffff',
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 20, color: '#ffffff' }} />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {row.notion ? (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: '#4caf50',
                            color: '#ffffff',
                          }}
                        >
                          <CheckIcon sx={{ fontSize: 20, color: '#ffffff' }} />
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: '#f44336',
                            color: '#ffffff',
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 20, color: '#ffffff' }} />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {row.asana ? (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: '#4caf50',
                            color: '#ffffff',
                          }}
                        >
                          <CheckIcon sx={{ fontSize: 20, color: '#ffffff' }} />
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: '#f44336',
                            color: '#ffffff',
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 20, color: '#ffffff' }} />
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Pricing Section */}
        <Box sx={{ py: { xs: 6, md: 10 } }}>
          <Divider
            sx={{
              mb: 8,
              borderColor: theme.palette.divider,
              borderWidth: 2,
              '&::before, &::after': {
                borderColor: theme.palette.divider,
                borderWidth: 2,
              },
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <Typography
              variant="h2"
              align="center"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                fontWeight: 700,
                mb: 1,
              }}
            >
              Choose Your Plan
            </Typography>
            <Typography
              variant="h6"
              align="center"
              color="text.secondary"
              sx={{ mb: 6, maxWidth: '700px', mx: 'auto' }}
            >
              Start with a free trialing, then choose the plan that fits your team
            </Typography>
          </motion.div>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                justifyContent: 'center',
                '& > *': {
                  flexBasis: {
                    xs: '100%',
                    sm: 'calc(50% - 8px)',
                    md: 'calc(33.333% - 11px)',
                    lg: 'calc(20% - 13px)',
                  },
                  maxWidth: {
                    xs: '100%',
                    sm: 'calc(50% - 8px)',
                    md: 'calc(33.333% - 11px)',
                    lg: 'calc(20% - 13px)',
                  },
                },
              }}
            >
              {packages.map((pkg, index) => (
                <PricingCard
                  key={pkg.id}
                  pkg={pkg}
                  isPopular={index === 1} // Mark second package as popular
                  delay={index * 0.1}
                  index={index}
                  onSelect={(pkg) => {
                    setSelectedPackage(pkg);
                    setSignupModalOpen(true);
                  }}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Social Proof Section */}
        <Box sx={{ py: { xs: 6, md: 8 } }}>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <Typography
              variant="body1"
              align="center"
              color="text.secondary"
              sx={{ mb: 4 }}
            >
              Trusted by product teams building the next generation of software
            </Typography>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 4,
                flexWrap: 'wrap',
                opacity: 0.6,
              }}
            >
              {['TechCorp', 'StartupXYZ', 'InnovateCo', 'BuildFast'].map((company, index) => (
                <motion.div
                  key={company}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 0.6, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  whileHover={{ opacity: 1, y: -4 }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: 'text.secondary',
                    }}
                  >
                    {company}
                  </Typography>
                </motion.div>
              ))}
            </Box>
          </motion.div>
        </Box>

        {/* See It In Action Dashboard */}
        <SeeItInActionDashboard />

        {/* Final CTA Section */}
        <Box
          sx={{
            py: { xs: 8, md: 12 },
            mb: 4,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <Paper
              elevation={0}
              sx={{
                p: { xs: 4, md: 8 },
                textAlign: 'center',
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.15)} 100%)`,
                borderRadius: 4,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: `radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
                  pointerEvents: 'none',
                },
              }}
            >
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Typography
                  variant="h2"
                  sx={{
                    fontSize: { xs: '2rem', md: '3rem' },
                    fontWeight: 700,
                    mb: 2,
                  }}
                >
                  Ready to ship your next product faster?
                </Typography>
                <Typography
                  variant="h6"
                  color="text.secondary"
                  sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}
                >
                  Join thousands of teams using FullStack Method™ to accelerate product development
                </Typography>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => router.push('/auth/signup')}
                    sx={{
                      px: 6,
                      py: 2,
                      fontSize: '1.2rem',
                      fontWeight: 600,
                      borderRadius: 2,
                      boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.4)}`,
                    }}
                  >
                    Start Free Trial
                  </Button>
                </motion.div>
              </Box>
            </Paper>
          </motion.div>
        </Box>
      </Container>

      {/* Signup Modal */}
      <SignupModal
        open={signupModalOpen}
        onClose={() => {
          setSignupModalOpen(false);
          setSelectedPackage(null);
        }}
        package={selectedPackage}
      />
    </Box>
  );
}
