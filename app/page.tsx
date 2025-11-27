'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Paper,
  useTheme,
  keyframes,
  LinearProgress,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  Dashboard as DashboardIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  FolderOpen as FolderIcon,
  People as PeopleIcon,
  AutoAwesome as AIIcon,
  Rocket as RocketIcon,
  PersonAdd as PersonAddIcon,
  ShoppingCart as ShoppingCartIcon,
  Favorite as FavoriteIcon,
  PlayArrow as PlayArrowIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Build as BuildIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import type { User } from '@/types/project';

// Animations
const floatAnimation = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
`;

const slideInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

const flowAnimation = keyframes`
  0% {
    stroke-dashoffset: 1000;
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
`;

const aiPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
`;

const connectorFlow = keyframes`
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateX(100%);
    opacity: 0;
  }
`;

const connectorFlowVertical = keyframes`
  0% {
    transform: translateY(-100%);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(100%);
    opacity: 0;
  }
`;

// Flow Node Component
function FlowNode({
  theme,
  icon,
  title,
  description,
  delay,
  isStart = false,
  isWide = false,
  isTab = false,
}: {
  theme: any;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
  isStart?: boolean;
  isWide?: boolean;
  isTab?: boolean;
}) {
  return (
    <Paper
      sx={{
        p: isTab ? 2 : 3,
        backgroundColor: theme.palette.background.paper,
        border: `2px solid ${theme.palette.divider}`,
        borderRadius: 2,
        minWidth: isWide ? 200 : isTab ? 140 : 180,
        maxWidth: isTab ? 160 : 220,
        textAlign: 'center',
        position: 'relative',
        transition: 'all 0.3s ease',
        animation: `${slideInUp} 0.6s ease-out ${delay}s both`,
        '&:hover': {
          borderColor: '#4CAF50',
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px #4CAF5020`,
        },
      }}
    >
      {!isStart && (
        <Box
          sx={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#4CAF50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${theme.palette.background.paper}`,
            animation: `${aiPulse} 2s ease-in-out infinite`,
            animationDelay: `${delay}s`,
          }}
        >
          <AIIcon sx={{ fontSize: 12, color: theme.palette.background.default }} />
        </Box>
      )}
      <Box sx={{ color: theme.palette.text.primary, mb: 1, display: 'flex', justifyContent: 'center' }}>
        {icon}
      </Box>
      <Typography
        variant={isTab ? 'caption' : 'body2'}
        sx={{ color: theme.palette.text.primary, fontWeight: 600, mb: 0.5 }}
      >
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem' }}>
        {description}
      </Typography>
    </Paper>
  );
}

// Flow Connector Component
function FlowConnector({
  theme,
  direction = 'down',
  delay,
  variant = 'single',
  fromTab,
}: {
  theme: any;
  direction?: 'down' | 'up' | 'left' | 'right';
  delay: number;
  variant?: 'single' | 'multi';
  fromTab?: number;
}) {
  const length = 60;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: -length,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 2,
        height: length,
        zIndex: 0,
        animation: `${fadeIn} 0.5s ease-out ${delay}s both`,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          backgroundColor: theme.palette.divider,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: `linear-gradient(180deg, transparent, ${theme.palette.text.primary}, transparent)`,
            animation: `${connectorFlowVertical} 2s ease-in-out infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      </Box>
      <ArrowForwardIcon
        sx={{
          position: 'absolute',
          bottom: -10,
          left: '50%',
          transform: 'translateX(-50%) rotate(90deg)',
          color: theme.palette.text.primary,
          fontSize: 16,
          animation: `${fadeIn} 0.5s ease-out ${delay + 0.2}s both`,
        }}
      />
    </Box>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { role, isSuperAdmin, loading: roleLoading } = useRole();
  const [scrollY, setScrollY] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', session.user.id)
        .single();

      if (!error && data) {
        setUser(data as User);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNavigate = (path: string) => {
    handleMenuClose();
    router.push(path);
  };

  const handleSignOut = async () => {
    handleMenuClose();
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  const getUserInitials = () => {
    if (user?.name) {
      const names = user.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated Background Grid */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(${theme.palette.divider} 1px, transparent 1px),
            linear-gradient(90deg, ${theme.palette.divider} 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          opacity: 0.1,
          transform: `translate(${scrollY * 0.02}px, ${scrollY * 0.02}px)`,
          transition: 'transform 0.1s ease-out',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Floating Particles */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {Array.from({ length: 30 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: 2,
              height: 2,
              backgroundColor: theme.palette.text.primary,
              opacity: 0.2,
              borderRadius: '50%',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${5 + Math.random() * 10}s infinite ease-in-out`,
              animationDelay: `${Math.random() * 2}s`,
              '@keyframes float': {
                '0%, 100%': {
                  transform: 'translateY(0) translateX(0)',
                  opacity: 0.2,
                },
                '50%': {
                  transform: `translateY(${-30 - Math.random() * 40}px) translateX(${-15 - Math.random() * 30}px)`,
                  opacity: 0.4,
                },
              },
            }}
          />
        ))}
      </Box>

      {/* Header */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: theme.palette.background.paper,
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              FSM™
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {!loading && user ? (
                <>
                  <IconButton
                    onClick={handleMenuOpen}
                    sx={{
                      p: 0,
                      '&:hover': {
                        opacity: 0.8,
                      },
                    }}
                  >
                    <Avatar
                      src={user?.avatar_url || undefined}
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: theme.palette.text.primary,
                        color: theme.palette.background.default,
                        border: `1px solid ${theme.palette.divider}`,
                        cursor: 'pointer',
                      }}
                    >
                      {getUserInitials()}
                    </Avatar>
                  </IconButton>
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'right',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    PaperProps={{
                      sx: {
                        mt: 1,
                        minWidth: 200,
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                      },
                    }}
                  >
                    {user && (
                      <Box sx={{ px: 2, py: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {user.name || 'User'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {user.email}
                        </Typography>
                      </Box>
                    )}
                    <Divider sx={{ borderColor: theme.palette.divider }} />
                    <MenuItem
                      onClick={() => handleNavigate('/dashboard')}
                      sx={{
                        color: 'text.primary',
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      <DashboardIcon fontSize="small" sx={{ mr: 1.5 }} />
                      Dashboard
                    </MenuItem>
                    {!roleLoading && role === 'admin' && isSuperAdmin && (
                      <MenuItem
                        onClick={() => handleNavigate('/admin')}
                        sx={{
                          color: 'text.primary',
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                      >
                        <AdminIcon fontSize="small" sx={{ mr: 1.5 }} />
                        Admin
                      </MenuItem>
                    )}
                    <MenuItem
                      onClick={() => handleNavigate('/profile')}
                      sx={{
                        color: 'text.primary',
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      <PersonIcon fontSize="small" sx={{ mr: 1.5 }} />
                      Profile
                    </MenuItem>
                    <Divider sx={{ borderColor: theme.palette.divider }} />
                    <MenuItem
                      onClick={handleSignOut}
                      sx={{
                        color: theme.palette.text.primary,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
                      Sign Out
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <Button
                  variant="outlined"
                  onClick={() => router.push('/auth/signin')}
                  sx={{
                    borderColor: theme.palette.text.primary,
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    '&:hover': {
                      borderColor: theme.palette.text.primary,
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  Sign In
                </Button>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero Section */}
      <Box sx={{ pt: 20, pb: 12, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              textAlign: 'center',
              mb: 8,
              animation: `${slideInUp} 0.8s ease-out`,
            }}
          >
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2rem', md: '3.5rem', lg: '4.5rem' },
                fontWeight: 700,
                mb: 3,
                mx: 'auto',
                maxWidth: '900px',
                color: theme.palette.text.primary,
                lineHeight: 1.2,
              }}
            >
              End Your Teams Chaos, Start with Structure
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: theme.palette.text.secondary,
                mb: 4,
                maxWidth: '700px',
                mx: 'auto',
                lineHeight: 1.6,
                fontWeight: 400,
              }}
            >
              AI-accelerated project management platform designed to transform how you build.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 6 }}>
              <Button
                variant="outlined"
                size="large"
                onClick={() => router.push('/auth/signin')}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Get Started
              </Button>
            </Box>
          </Box>

          {/* Mock Dashboard Preview */}
          <Box
            sx={{
              mb: 8,
              animation: `${fadeIn} 1s ease-out 0.3s both`,
            }}
          >
            <Paper
              sx={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                p: 4,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                  Dashboard Preview
                </Typography>
                <Chip
                  label="Live Demo"
                  size="small"
                  sx={{
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                    fontWeight: 600,
                  }}
                />
              </Box>
              
              {/* Stats Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                  { label: 'Total Projects', value: '24', progress: 75 },
                  { label: 'Active Tasks', value: '142', progress: 60 },
                  { label: 'Team Members', value: '12', progress: 0 },
                  { label: 'Completion Rate', value: '87%', progress: 87 },
                ].map((stat, i) => (
                  <Grid item xs={6} md={3} key={i}>
                    <Paper
                      sx={{
                        p: 2,
                        backgroundColor: theme.palette.action.hover,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                        {stat.label}
                      </Typography>
                      <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600, mb: 1 }}>
                        {stat.value}
                      </Typography>
                      {stat.progress > 0 && (
                        <LinearProgress
                          variant="determinate"
                          value={stat.progress}
                          sx={{
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: theme.palette.background.paper,
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: '#4CAF50',
                            },
                          }}
                        />
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {/* Mock Chart Area */}
              <Box
                sx={{
                  height: 300,
                  backgroundColor: theme.palette.action.hover,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                  p: 3,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
                  Project Activity Timeline
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 'calc(100% - 40px)' }}>
                  {[65, 80, 45, 90, 70, 55, 85, 60, 75, 50, 88, 65].map((height, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        flex: 1,
                        height: `${height}%`,
                        backgroundColor: theme.palette.text.primary,
                        borderRadius: '4px 4px 0 0',
                        animation: `${pulse} 2s ease-in-out infinite`,
                        animationDelay: `${idx * 0.15}s`,
                        opacity: 0.8,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Paper>
          </Box>
        </Container>
      </Box>

      {/* System Architecture Flow */}
      <Box sx={{ py: 12, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="xl">
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '2rem', md: '2.5rem' },
              textAlign: 'center',
              mb: 2,
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            How Our System Works
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              mb: 8,
              color: theme.palette.text.secondary,
              maxWidth: '700px',
              mx: 'auto',
              fontWeight: 400,
            }}
          >
            Visualize the complete flow from dashboard to project execution
          </Typography>

          {/* Interactive Flow Diagram */}
          <Paper
            sx={{
              p: { xs: 3, md: 6 },
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              position: 'relative',
              overflow: 'auto',
              minHeight: 800,
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                minHeight: 700,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {/* Top Level: Dashboard */}
              <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <FlowNode
                  theme={theme}
                  icon={<DashboardIcon />}
                  title="Dashboard"
                  description="Central hub for all operations"
                  delay={0}
                  isStart={true}
                />
              </Box>

              {/* Second Level: Companies List */}
              <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', position: 'relative', pt: 2 }}>
                <FlowConnector
                  theme={theme}
                  direction="down"
                  delay={0.2}
                />
                <FlowNode
                  theme={theme}
                  icon={<PeopleIcon />}
                  title="Companies"
                  description="Create, read, update, delete companies"
                  delay={0.3}
                />
              </Box>

              {/* Third Level: Company Details */}
              <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', position: 'relative', pt: 2 }}>
                <FlowConnector
                  theme={theme}
                  direction="down"
                  delay={0.5}
                />
                <FlowNode
                  theme={theme}
                  icon={<BuildIcon />}
                  title="Company Details"
                  description="View and manage company information"
                  delay={0.6}
                  isWide={true}
                />
              </Box>

              {/* Fourth Level: Tabs Row */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: 2,
                  width: '100%',
                  position: 'relative',
                  pt: 2,
                }}
              >
                <FlowConnector
                  theme={theme}
                  direction="down"
                  delay={0.8}
                  variant="multi"
                />
                {[
                  { icon: <TrendingUpIcon />, title: 'Opportunities', desc: 'Add opportunities for projects' },
                  { icon: <FolderIcon />, title: 'Projects', desc: 'View connected projects' },
                  { icon: <PeopleIcon />, title: 'Contacts', desc: 'Manage company contacts' },
                  { icon: <TimelineIcon />, title: 'Tasks', desc: 'Company & contact tasks' },
                  { icon: <DashboardIcon />, title: 'Activity', desc: 'Activity feed & updates' },
                ].map((tab, idx) => (
                  <FlowNode
                    key={idx}
                    theme={theme}
                    icon={tab.icon}
                    title={tab.title}
                    description={tab.desc}
                    delay={0.9 + idx * 0.1}
                    isTab={true}
                  />
                ))}
              </Box>

              {/* Fifth Level: Connected Pages */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  flexWrap: 'wrap',
                  gap: 4,
                  width: '100%',
                  mt: 2,
                }}
              >
                {/* Opportunities Flow */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  <FlowConnector
                    theme={theme}
                    direction="down"
                    delay={1.5}
                    fromTab={0}
                  />
                  <FlowNode
                    theme={theme}
                    icon={<TrendingUpIcon />}
                    title="Opportunities List"
                    description="All opportunities"
                    delay={1.6}
                  />
                  <Box sx={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <FlowConnector
                      theme={theme}
                      direction="down"
                      delay={1.8}
                    />
                  </Box>
                  <FlowNode
                    theme={theme}
                    icon={<CheckCircleIcon />}
                    title="Opportunity Details"
                    description="Convert to project"
                    delay={1.9}
                  />
                </Box>

                {/* Contacts Flow */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  <FlowConnector
                    theme={theme}
                    direction="down"
                    delay={2.0}
                    fromTab={2}
                  />
                  <FlowNode
                    theme={theme}
                    icon={<PeopleIcon />}
                    title="Contacts List"
                    description="All company contacts"
                    delay={2.1}
                  />
                  <Box sx={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <FlowConnector
                      theme={theme}
                      direction="down"
                      delay={2.3}
                    />
                  </Box>
                  <FlowNode
                    theme={theme}
                    icon={<DescriptionIcon />}
                    title="Contact Details"
                    description="Slideout with full info"
                    delay={2.4}
                  />
                  <Box sx={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <FlowConnector
                      theme={theme}
                      direction="down"
                      delay={2.6}
                    />
                  </Box>
                  <FlowNode
                    theme={theme}
                    icon={<TimelineIcon />}
                    title="Tasks & Notes"
                    description="Contact-specific tasks"
                    delay={2.7}
                  />
                </Box>
              </Box>
            </Box>

            {/* Legend */}
            <Box
              sx={{
                mt: 6,
                pt: 4,
                borderTop: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                justifyContent: 'center',
                gap: 4,
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: '#4CAF50',
                    animation: `${pulse} 2s ease-in-out infinite`,
                  }}
                />
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  AI Automation
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 2,
                    height: 20,
                    backgroundColor: theme.palette.text.primary,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: `linear-gradient(180deg, transparent, ${theme.palette.text.primary}, transparent)`,
                      animation: `${connectorFlowVertical} 2s ease-in-out infinite`,
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  Data Flow
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 12, backgroundColor: theme.palette.action.hover, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '2rem', md: '2.5rem' },
              textAlign: 'center',
              mb: 2,
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            Powerful Features
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              mb: 6,
              color: theme.palette.text.secondary,
              maxWidth: '700px',
              mx: 'auto',
              fontWeight: 400,
            }}
          >
            Everything you need to manage projects efficiently
          </Typography>
          <Grid container spacing={3}>
            {[
              {
                icon: <AIIcon />,
                title: 'AI-Powered Planning',
                description: 'Generate comprehensive project plans with AI-driven insights',
              },
              {
                icon: <TimelineIcon />,
                title: 'Real-Time Tracking',
                description: 'Monitor progress and milestones with live updates',
              },
              {
                icon: <PeopleIcon />,
                title: 'Team Collaboration',
                description: 'Work together seamlessly with built-in collaboration tools',
              },
              {
                icon: <FolderIcon />,
                title: 'Project Templates',
                description: 'Start faster with pre-built project templates',
              },
              {
                icon: <TrendingUpIcon />,
                title: 'Analytics & Insights',
                description: 'Make data-driven decisions with comprehensive analytics',
              },
              {
                icon: <CheckCircleIcon />,
                title: 'Quality Assurance',
                description: 'Ensure code quality with automated testing and validation',
              },
            ].map((feature, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper
                  sx={{
                    p: 3,
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    height: '100%',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: theme.palette.text.primary,
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <Box sx={{ color: theme.palette.text.primary, mb: 2 }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 1, fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ py: 12, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="md">
          <Paper
            sx={{
              p: 6,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                mb: 2,
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              Ready to Get Started?
            </Typography>
            <Typography variant="h6" sx={{ color: theme.palette.text.secondary, mb: 4, fontWeight: 400 }}>
              Join thousands of teams building better products with FullStack Method™
            </Typography>
            <Button
              variant="outlined"
              size="large"
              onClick={() => router.push('/auth/signin')}
              endIcon={<ArrowForwardIcon />}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                fontWeight: 600,
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Sign In
            </Button>
          </Paper>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          py: 6,
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              © {new Date().getFullYear()} FullStack Method™. All rights reserved.
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Made with ❤️ by FullStack Method™ Team
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
