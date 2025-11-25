'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Paper,
  useTheme,
  alpha,
  keyframes,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  Analytics as AnalyticsIcon,
  People as PeopleIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
  Lightbulb as LightbulbIcon,
  Code as CodeIcon,
  Shield as ShieldIcon,
  Rocket as RocketIcon,
  Build as BuildIcon,
  Psychology as PsychologyIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  GitHub as GitHubIcon,
  YouTube as YouTubeIcon,
} from '@mui/icons-material';

// Animations
const floatAnimation = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
`;

const pulseAnimation = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

const gradientAnimation = keyframes`
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
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

export default function LandingPage() {
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistLoading(true);
    setWaitlistError(null);
    setWaitlistSuccess(false);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setWaitlistSuccess(true);
      setEmail('');
      setName('');
      setRole('');
    } catch (error) {
      setWaitlistError(error instanceof Error ? error.message : 'Failed to join waitlist');
    } finally {
      setWaitlistLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0A0E27 0%, #121633 50%, #0A0E27 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 20% 50%, ${alpha('#00E5FF', 0.1)} 0%, transparent 50%),
                       radial-gradient(circle at 80% 80%, ${alpha('#E91E63', 0.1)} 0%, transparent 50%)`,
          animation: `${gradientAnimation} 15s ease infinite`,
          backgroundSize: '200% 200%',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: alpha('#0A0E27', 0.9),
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${alpha('#00E5FF', 0.2)}`,
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #00E5FF 0%, #E91E63 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              FullStack Method™
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <Button
                variant="text"
                sx={{
                  color: '#B0B0B0',
                  fontWeight: 500,
                  '&:hover': {
                    color: '#00E5FF',
                    backgroundColor: 'transparent',
                  },
                }}
              >
                Home
              </Button>
              <Button
                variant="text"
                sx={{
                  color: '#B0B0B0',
                  fontWeight: 500,
                  '&:hover': {
                    color: '#00E5FF',
                    backgroundColor: 'transparent',
                  },
                }}
              >
                Solutions
              </Button>
              <Button
                variant="text"
                sx={{
                  color: '#B0B0B0',
                  fontWeight: 500,
                  '&:hover': {
                    color: '#00E5FF',
                    backgroundColor: 'transparent',
                  },
                }}
              >
                About Us
              </Button>
              <Button
                variant="outlined"
                onClick={() => router.push('/auth/signin')}
                sx={{
                  borderColor: alpha('#00E5FF', 0.5),
                  color: '#00E5FF',
                  fontWeight: 600,
                  px: 2,
                  '&:hover': {
                    borderColor: '#00E5FF',
                    backgroundColor: alpha('#00E5FF', 0.1),
                  },
                }}
              >
                Login
              </Button>
              <Button
                variant="contained"
                onClick={() => router.push('/auth/signin')}
                sx={{
                  background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
                  color: '#000',
                  fontWeight: 600,
                  px: 3,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #00B2CC 0%, #00CC6A 100%)',
                  },
                }}
              >
                Get Started
              </Button>
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
                fontSize: { xs: '1.875rem', md: '3rem', lg: '3.75rem' },
                fontWeight: 800,
                mb: 3,
                mx: 'auto',
                maxWidth: '768px',
                background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.2,
              }}
            >
              End Your Teams Chaos, Start with Structure
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: '#B0B0B0',
                mb: 4,
                maxWidth: '700px',
                mx: 'auto',
                lineHeight: 1.6,
              }}
            >
              With our AI-accelerated project management platform designed to transform how you build.
            </Typography>
            <Typography
              variant="h6"
              sx={{
                // color: '#B0B0B0',
                mb: 4,
                maxWidth: '700px',
                mx: 'auto',
                lineHeight: 1.6,
                background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Plan, execute, and deliver exceptional results.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 6 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => router.push('/auth/signin')}
                sx={{
                  background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
                  color: '#000',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #00B2CC 0%, #00CC6A 100%)',
                  },
                }}
              >
                Get Started
              </Button>
              <Button
                variant="outlined"
                size="large"
                sx={{
                  borderColor: alpha('#00E5FF', 0.5),
                  color: '#00E5FF',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  '&:hover': {
                    borderColor: '#00E5FF',
                    backgroundColor: alpha('#00E5FF', 0.1),
                  },
                }}
              >
                Book a Demo
              </Button>
            </Box>
            {/* Statistics */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
              {[
                { value: '10x', label: 'Faster Development' },
                { value: '850+', label: 'Happy Users' },
                { value: '100%', label: 'Code Quality' },
              ].map((stat, index) => (
                <Box key={index} sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="h3"
                    sx={{
                      fontSize: '2.25rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 0.5,
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#B0B0B0' }}>
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* The FullStack Method Manifesto */}
      <Box sx={{ py: 12, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            sx={{
              fontSize: '2.8125rem',
              textAlign: 'center',
              mb: 2,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            The FullStack Method™ Manifesto
          </Typography>
          <Typography
            variant="h5"
            sx={{
              textAlign: 'center',
              mb: 6,
              color: '#B0B0B0',
              maxWidth: '800px',
              mx: 'auto',
            }}
          >
            We believe in a world where building software is a joyful and creative endeavor.
          </Typography>
          <Grid container spacing={6}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ color: '#00E5FF', mb: 2, fontWeight: 600 }}>
                What makes us different from other AI platforms?
              </Typography>
              <Typography variant="h6" sx={{ color: '#E0E0E0', mb: 3, fontWeight: 600 }}>
                Commit to these core values, every single day:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  'AI-powered project analysis and task generation',
                  'Automated testing and quality assurance',
                  'Deployment & monitoring with real-time insights',
                  'Structured methodology for consistent results',
                ].map((item, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <CheckCircleIcon sx={{ color: '#00FF88', mt: 0.5, flexShrink: 0 }} />
                    <Typography variant="body1" sx={{ color: '#E0E0E0', lineHeight: 1.6 }}>
                      {item}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ color: '#00E5FF', mb: 3, fontWeight: 600 }}>
                We believe in...
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  'AI-powered development that enhances human creativity',
                  'Developer productivity through intelligent automation',
                  'Code quality that exceeds industry standards',
                  'Collaboration that brings teams together',
                  'Transparency in every process and decision',
                ].map((item, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <CheckCircleIcon sx={{ color: '#00FF88', mt: 0.5, flexShrink: 0 }} />
                    <Typography variant="body1" sx={{ color: '#E0E0E0', lineHeight: 1.6 }}>
                      {item}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 6 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => router.push('/auth/signin')}
              sx={{
                background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
                color: '#000',
                fontWeight: 600,
                px: 4,
                '&:hover': {
                  background: 'linear-gradient(135deg, #00B2CC 0%, #00CC6A 100%)',
                },
              }}
            >
              Get Started
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              sx={{
                borderColor: alpha('#00E5FF', 0.5),
                color: '#00E5FF',
                fontWeight: 600,
                px: 4,
                '&:hover': {
                  borderColor: '#00E5FF',
                  backgroundColor: alpha('#00E5FF', 0.1),
                },
              }}
            >
              Learn More
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Integration Partners */}
      <Box sx={{ py: 8, backgroundColor: alpha('#00E5FF', 0.05), position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            sx={{
              textAlign: 'center',
              mb: 4,
              fontWeight: 600,
              color: '#E0E0E0',
            }}
          >
            FullStack Method™ works with your favorite tools
          </Typography>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 4,
              flexWrap: 'wrap',
            }}
          >
            {['Supabase', 'Next.js', 'TypeScript', 'Material-UI', 'GitHub'].map((tool, index) => (
              <Chip
                key={index}
                label={tool}
                sx={{
                  backgroundColor: '#121633',
                  border: `1px solid ${alpha('#00E5FF', 0.3)}`,
                  color: '#00E5FF',
                  fontSize: '1rem',
                  px: 2,
                  py: 3,
                  fontWeight: 500,
                }}
              />
            ))}
          </Box>
        </Container>
      </Box>

      {/* Powerful Features */}
      <Box id="features" sx={{ py: 12, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            sx={{
              fontSize: '2.8125rem',
              textAlign: 'center',
              mb: 2,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Powerful Features for Modern Development
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              mb: 6,
              color: '#B0B0B0',
              maxWidth: '700px',
              mx: 'auto',
            }}
          >
            Every feature is designed to make the development process a joy, not a chore.
          </Typography>
          <Grid container spacing={4}>
            {[
              {
                icon: <LightbulbIcon sx={{ fontSize: 40 }} />,
                title: 'Intelligent Scaffolding',
                description: 'Generate project structures, templates, and configurations with AI-powered analysis.',
              },
              {
                icon: <CodeIcon sx={{ fontSize: 40 }} />,
                title: 'AI-Powered Task Generation',
                description: 'Automatically break down projects into actionable tasks with AI-driven insights.',
              },
              {
                icon: <ShieldIcon sx={{ fontSize: 40 }} />,
                title: 'Automated Testing',
                description: 'Ensure code quality and reliability with comprehensive test coverage and validation.',
              },
              {
                icon: <RocketIcon sx={{ fontSize: 40 }} />,
                title: 'Deployment & Monitoring',
                description: 'Deploy applications with confidence and monitor performance with real-time insights.',
              },
            ].map((feature, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card
                  sx={{
                    backgroundColor: '#121633',
                    border: `1px solid ${alpha('#00E5FF', 0.2)}`,
                    borderRadius: 3,
                    p: 4,
                    height: '100%',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: '#00E5FF',
                      transform: 'translateY(-5px)',
                      boxShadow: `0 10px 30px ${alpha('#00E5FF', 0.2)}`,
                    },
                  }}
                >
                  <Box sx={{ color: '#00E5FF', mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h6" sx={{ color: '#E0E0E0', mb: 2, fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Built for Developer Productivity */}
      <Box sx={{ py: 12, backgroundColor: alpha('#00E5FF', 0.05), position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            sx={{
              fontSize: '2.8125rem',
              textAlign: 'center',
              mb: 2,
              fontWeight: 700,
              color: '#E0E0E0',
            }}
          >
            Built for Developer Productivity
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              mb: 6,
              color: '#B0B0B0',
              maxWidth: '700px',
              mx: 'auto',
            }}
          >
            Focus on building great products while we handle the complexity behind the scenes.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', mb: 8 }}>
            {[
              { value: '90%', label: 'Reduced Bugs' },
              { value: '5x', label: 'Faster Iteration' },
              { value: '100%', label: 'Secure Code' },
            ].map((stat, index) => (
              <Box key={index} sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h3"
                  sx={{
                    fontSize: '2.25rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 0.5,
                  }}
                >
                  {stat.value}
                </Typography>
                <Typography variant="body1" sx={{ color: '#B0B0B0' }}>
                  {stat.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* How It Works */}
      <Box sx={{ py: 12, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            sx={{
              fontSize: '2.8125rem',
              textAlign: 'center',
              mb: 2,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            How FullStack Method™ Works
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              mb: 6,
              color: '#B0B0B0',
              maxWidth: '700px',
              mx: 'auto',
            }}
          >
            A powerful AI-powered platform that transforms your project from idea to deployment.
          </Typography>
          <Grid container spacing={4}>
            {[
              {
                icon: <LightbulbIcon sx={{ fontSize: 40 }} />,
                title: 'Outline Your Vision',
                description: 'Describe your application idea in natural language, and FullStack Method™ will generate a detailed project plan.',
              },
              {
                icon: <BuildIcon sx={{ fontSize: 40 }} />,
                title: 'AI Generated Plans',
                description: 'FullStack Method™ generates a comprehensive plan, including architecture, technologies, and actionable tasks.',
              },
              {
                icon: <RocketIcon sx={{ fontSize: 40 }} />,
                title: 'Build & Iterate',
                description: 'Track progress, manage tasks, and iterate quickly with AI-powered insights and automated workflows.',
              },
            ].map((step, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    backgroundColor: '#121633',
                    border: `1px solid ${alpha('#00E5FF', 0.2)}`,
                    borderRadius: 3,
                    p: 4,
                    height: '100%',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: '#00E5FF',
                      transform: 'translateY(-5px)',
                      boxShadow: `0 10px 30px ${alpha('#00E5FF', 0.2)}`,
                    },
                  }}
                >
                  <Box sx={{ color: '#00E5FF', mb: 2, display: 'flex', justifyContent: 'center' }}>
                    {step.icon}
                  </Box>
                  <Typography variant="h6" sx={{ color: '#E0E0E0', mb: 2, fontWeight: 600 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', lineHeight: 1.6 }}>
                    {step.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <Typography variant="h5" sx={{ color: '#E0E0E0', mb: 3 }}>
              Ready to transform your development process?
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => router.push('/auth/signin')}
              sx={{
                background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
                color: '#000',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                '&:hover': {
                  background: 'linear-gradient(135deg, #00B2CC 0%, #00CC6A 100%)',
                },
              }}
            >
              Get Started
            </Button>
          </Box>
        </Container>
      </Box>

      {/* See FullStack Method™ in Action */}
      <Box sx={{ py: 12, backgroundColor: alpha('#00E5FF', 0.05), position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            sx={{
              fontSize: '2.8125rem',
              textAlign: 'center',
              mb: 2,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            See FullStack Method™ in Action
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              mb: 6,
              color: '#B0B0B0',
              maxWidth: '700px',
              mx: 'auto',
            }}
          >
            Discover how FullStack Method™ streamlines your workflow and accelerates development.
          </Typography>
          {/* Mock Dashboard Preview */}
          <Box
            sx={{
              mb: 6,
              animation: `${floatAnimation} 6s ease-in-out infinite`,
            }}
          >
            <Paper
              sx={{
                backgroundColor: '#121633',
                border: `2px solid ${alpha('#00E5FF', 0.3)}`,
                borderRadius: 3,
                p: 3,
                boxShadow: `0 20px 60px ${alpha('#00E5FF', 0.2)}`,
                overflow: 'hidden',
              }}
            >
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ color: '#00E5FF', fontWeight: 600 }}>
                  Project Dashboard
                </Typography>
                <Chip label="Live" size="small" sx={{ backgroundColor: '#00FF88', color: '#000', fontWeight: 600 }} />
              </Box>
              <Grid container spacing={2}>
                {[1, 2, 3, 4].map((i) => (
                  <Grid item xs={6} md={3} key={i}>
                    <Card
                      sx={{
                        backgroundColor: alpha('#0A0E27', 0.8),
                        border: `1px solid ${alpha('#00E5FF', 0.2)}`,
                      }}
                    >
                      <CardContent>
                        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                          Metric {i}
                        </Typography>
                        <Typography variant="h5" sx={{ color: '#00E5FF', fontWeight: 600 }}>
                          {i * 25}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={i * 25}
                          sx={{
                            mt: 1,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: alpha('#00E5FF', 0.1),
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: '#00E5FF',
                            },
                          }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1, height: 200, backgroundColor: alpha('#0A0E27', 0.8), borderRadius: 2, p: 2 }}>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                    Task Timeline
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: '80%' }}>
                    {[40, 60, 45, 80, 55, 70].map((height, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          flex: 1,
                          height: `${height}%`,
                          backgroundColor: '#00E5FF',
                          borderRadius: '4px 4px 0 0',
                          animation: `${pulseAnimation} 2s ease-in-out infinite`,
                          animationDelay: `${idx * 0.2}s`,
                        }}
                      />
                    ))}
                  </Box>
                </Box>
                <Box sx={{ flex: 1, height: 200, backgroundColor: alpha('#0A0E27', 0.8), borderRadius: 2, p: 2 }}>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                    Team Activity
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {['Alice', 'Bob', 'Charlie'].map((name, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#00E5FF',
                            animation: `${pulseAnimation} 2s ease-in-out infinite`,
                            animationDelay: `${idx * 0.3}s`,
                          }}
                        />
                        <Typography variant="caption" sx={{ color: '#E0E0E0' }}>
                          {name} completed a task
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>
          {/* Feature Cards Below */}
          <Grid container spacing={4}>
            {[
              {
                icon: <CodeIcon sx={{ fontSize: 40 }} />,
                title: 'Generate Tasks & Plans',
                description: 'FullStack Method™ generates comprehensive task breakdowns and project plans based on your requirements.',
              },
              {
                icon: <AssignmentIcon sx={{ fontSize: 40 }} />,
                title: 'Manage & Track Progress',
                description: 'Manage your development tasks, track progress, and collaborate with your team in real-time.',
              },
              {
                icon: <RocketIcon sx={{ fontSize: 40 }} />,
                title: 'Deploy & Monitor',
                description: 'Deploy your applications with confidence and monitor their performance with AI-powered insights.',
              },
            ].map((feature, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    backgroundColor: '#121633',
                    border: `1px solid ${alpha('#00E5FF', 0.2)}`,
                    borderRadius: 3,
                    p: 3,
                    height: '100%',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: '#00E5FF',
                      transform: 'translateY(-5px)',
                      boxShadow: `0 10px 30px ${alpha('#00E5FF', 0.2)}`,
                    },
                  }}
                >
                  <Box sx={{ color: '#00E5FF', mb: 2, display: 'flex', justifyContent: 'center' }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" sx={{ color: '#E0E0E0', mb: 1, fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Real Projects Built with FullStack Method™ */}
      <Box sx={{ py: 12, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            sx={{
              fontSize: '2.8125rem',
              textAlign: 'center',
              mb: 2,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Real Projects Built with FullStack Method™
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              mb: 6,
              color: '#B0B0B0',
              maxWidth: '700px',
              mx: 'auto',
            }}
          >
            Explore real-world applications built using our platform.
          </Typography>
          <Grid container spacing={3}>
            {[
              {
                title: 'E-commerce Platform',
                description: 'Complete online store with AI-powered inventory management and analytics.',
                tags: ['AI', 'E-commerce', 'Analytics'],
              },
              {
                title: 'Project Management Tool',
                description: 'Comprehensive task tracking and team collaboration platform.',
                tags: ['Task Management', 'Collaboration', 'Analytics'],
              },
              {
                title: 'Analytics Dashboard',
                description: 'Real-time data visualization and business intelligence platform.',
                tags: ['Analytics', 'Data', 'Dashboard'],
              },
              {
                title: 'Customer Portal',
                description: 'Self-service portal with AI-powered support and recommendations.',
                tags: ['AI', 'Portal', 'Support'],
              },
              {
                title: 'Content Management',
                description: 'AI-enhanced CMS with automated content generation and optimization.',
                tags: ['AI', 'CMS', 'Content'],
              },
              {
                title: 'API Gateway',
                description: 'Enterprise-grade API management with monitoring and analytics.',
                tags: ['API', 'Enterprise', 'Monitoring'],
              },
            ].map((project, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    backgroundColor: '#121633',
                    border: `1px solid ${alpha('#00E5FF', 0.2)}`,
                    borderRadius: 3,
                    p: 3,
                    height: '100%',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: '#00E5FF',
                      transform: 'translateY(-5px)',
                      boxShadow: `0 10px 30px ${alpha('#00E5FF', 0.2)}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      height: 150,
                      backgroundColor: alpha('#0A0E27', 0.8),
                      borderRadius: 2,
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${alpha('#00E5FF', 0.2)}`,
                    }}
                  >
                    <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
                      Project Preview
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ color: '#00E5FF', mb: 1, fontWeight: 600 }}>
                    {project.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 2, lineHeight: 1.6 }}>
                    {project.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {project.tags.map((tag, tagIndex) => (
                      <Chip
                        key={tagIndex}
                        label={tag}
                        size="small"
                        sx={{
                          backgroundColor: alpha('#00E5FF', 0.1),
                          color: '#00E5FF',
                          border: `1px solid ${alpha('#00E5FF', 0.3)}`,
                        }}
                      />
                    ))}
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Get Early Access */}
      <Box sx={{ py: 12, backgroundColor: alpha('#00E5FF', 0.05), position: 'relative', zIndex: 1 }}>
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{
              fontSize: '2.8125rem',
              textAlign: 'center',
              mb: 2,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Get Early Access
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              mb: 6,
              color: '#B0B0B0',
              maxWidth: '600px',
              mx: 'auto',
            }}
          >
            Join the waitlist and be among the first to experience the future of project management.
          </Typography>
          <Paper
            sx={{
              backgroundColor: '#121633',
              border: `2px solid ${alpha('#00E5FF', 0.3)}`,
              borderRadius: 4,
              p: 6,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(135deg, ${alpha('#00E5FF', 0.1)} 0%, ${alpha('#E91E63', 0.1)} 100%)`,
                zIndex: 0,
              },
            }}
          >
            <Box component="form" onSubmit={handleWaitlistSubmit} sx={{ position: 'relative', zIndex: 1 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#0A0E27',
                        color: '#E0E0E0',
                        '& fieldset': {
                          borderColor: alpha('#00E5FF', 0.3),
                        },
                        '&:hover fieldset': {
                          borderColor: alpha('#00E5FF', 0.5),
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#00E5FF',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: '#B0B0B0',
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#00E5FF',
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#0A0E27',
                        color: '#E0E0E0',
                        '& fieldset': {
                          borderColor: alpha('#00E5FF', 0.3),
                        },
                        '&:hover fieldset': {
                          borderColor: alpha('#00E5FF', 0.5),
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#00E5FF',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: '#B0B0B0',
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#00E5FF',
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#0A0E27',
                        color: '#E0E0E0',
                        '& fieldset': {
                          borderColor: alpha('#00E5FF', 0.3),
                        },
                        '&:hover fieldset': {
                          borderColor: alpha('#00E5FF', 0.5),
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#00E5FF',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: '#B0B0B0',
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#00E5FF',
                      },
                    }}
                  >
                    <InputLabel>Your Role</InputLabel>
                    <Select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      label="Your Role"
                    >
                      <MenuItem value="pm">Product Manager</MenuItem>
                      <MenuItem value="designer">Designer</MenuItem>
                      <MenuItem value="engineer">Engineer</MenuItem>
                      <MenuItem value="founder">Founder</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={waitlistLoading}
                    size="large"
                    sx={{
                      background: 'linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)',
                      color: '#000',
                      fontWeight: 600,
                      py: 1.5,
                      fontSize: '1.1rem',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #00B2CC 0%, #00CC6A 100%)',
                      },
                      '&:disabled': {
                        backgroundColor: alpha('#00E5FF', 0.5),
                      },
                    }}
                  >
                    {waitlistLoading ? 'Joining...' : 'Join the Waitlist'}
                  </Button>
                </Grid>
              </Grid>
              {waitlistSuccess && (
                <Typography sx={{ mt: 2, textAlign: 'center', color: '#00FF88', fontWeight: 600 }}>
                  ✓ Successfully added to waitlist!
                </Typography>
              )}
              {waitlistError && (
                <Typography sx={{ mt: 2, textAlign: 'center', color: '#FF1744' }}>
                  {waitlistError}
                </Typography>
              )}
            </Box>
          </Paper>
          {/* Benefit Cards */}
          <Grid container spacing={3} sx={{ mt: 4 }}>
            {[
              {
                icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />,
                title: 'Beta Testing',
                description: 'Get early access to new features and help shape the platform.',
              },
              {
                icon: <PeopleIcon sx={{ fontSize: 32 }} />,
                title: 'Community',
                description: 'Join a community of innovative developers and product builders.',
              },
              {
                icon: <RocketIcon sx={{ fontSize: 32 }} />,
                title: 'Early Access',
                description: 'Be among the first to experience the future of project management.',
              },
            ].map((benefit, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    backgroundColor: '#121633',
                    border: `1px solid ${alpha('#00E5FF', 0.2)}`,
                    borderRadius: 3,
                    p: 3,
                    height: '100%',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: '#00E5FF',
                      transform: 'translateY(-5px)',
                    },
                  }}
                >
                  <Box sx={{ color: '#00E5FF', mb: 2, display: 'flex', justifyContent: 'center' }}>
                    {benefit.icon}
                  </Box>
                  <Typography variant="h6" sx={{ color: '#E0E0E0', mb: 1, fontWeight: 600 }}>
                    {benefit.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', lineHeight: 1.6 }}>
                    {benefit.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          py: 8,
          borderTop: `1px solid ${alpha('#00E5FF', 0.2)}`,
          backgroundColor: '#0A0E27',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6}>
            <Grid item xs={12} md={4}>
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #00E5FF 0%, #E91E63 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                FullStack Method™
              </Typography>
              <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 3, lineHeight: 1.6 }}>
                An AI-powered project management platform designed to transform how you build products.
                Plan, execute, and deliver exceptional results.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <IconButton
                  sx={{
                    color: '#B0B0B0',
                    '&:hover': { color: '#00E5FF', backgroundColor: alpha('#00E5FF', 0.1) },
                  }}
                >
                  <LinkedInIcon />
                </IconButton>
                <IconButton
                  sx={{
                    color: '#B0B0B0',
                    '&:hover': { color: '#00E5FF', backgroundColor: alpha('#00E5FF', 0.1) },
                  }}
                >
                  <TwitterIcon />
                </IconButton>
                <IconButton
                  sx={{
                    color: '#B0B0B0',
                    '&:hover': { color: '#00E5FF', backgroundColor: alpha('#00E5FF', 0.1) },
                  }}
                >
                  <GitHubIcon />
                </IconButton>
                <IconButton
                  sx={{
                    color: '#B0B0B0',
                    '&:hover': { color: '#00E5FF', backgroundColor: alpha('#00E5FF', 0.1) },
                  }}
                >
                  <YouTubeIcon />
                </IconButton>
              </Box>
            </Grid>
            <Grid item xs={12} md={8}>
              <Grid container spacing={4}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="h6" sx={{ color: '#00E5FF', mb: 2, fontWeight: 600 }}>
                    Company
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {['Home', 'About Us', 'Careers', 'Contact'].map((link) => (
                      <Button
                        key={link}
                        variant="text"
                        sx={{
                          color: '#B0B0B0',
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          '&:hover': {
                            color: '#00E5FF',
                            backgroundColor: 'transparent',
                          },
                        }}
                      >
                        {link}
                      </Button>
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="h6" sx={{ color: '#00E5FF', mb: 2, fontWeight: 600 }}>
                    Product
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {['Features', 'Pricing', 'Integrations', 'How it Works'].map((link) => (
                      <Button
                        key={link}
                        variant="text"
                        sx={{
                          color: '#B0B0B0',
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          '&:hover': {
                            color: '#00E5FF',
                            backgroundColor: 'transparent',
                          },
                        }}
                      >
                        {link}
                      </Button>
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="h6" sx={{ color: '#00E5FF', mb: 2, fontWeight: 600 }}>
                    Legal
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((link) => (
                      <Button
                        key={link}
                        variant="text"
                        sx={{
                          color: '#B0B0B0',
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          '&:hover': {
                            color: '#00E5FF',
                            backgroundColor: 'transparent',
                          },
                        }}
                      >
                        {link}
                      </Button>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
          <Box
            sx={{
              mt: 6,
              pt: 4,
              borderTop: `1px solid ${alpha('#00E5FF', 0.2)}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
              © {new Date().getFullYear()} FullStack Method™. All rights reserved.
            </Typography>
            <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
              Made with ❤️ by FullStack Method™ Team
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
