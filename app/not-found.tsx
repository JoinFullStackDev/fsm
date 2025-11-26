'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Button, Container } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Home as HomeIcon, Dashboard as DashboardIcon, FolderOpen as FolderIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';

export default function NotFound() {
  const theme = useTheme();
  const router = useRouter();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Generate particle data once
  const particles = Array.from({ length: 50 }).map(() => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 5 + Math.random() * 10,
    translateY: -20 - Math.random() * 40,
    translateX: -10 - Math.random() * 20,
  }));

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        p: 3,
      }}
    >
      {/* Animated Background Particles */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        {particles.map((particle, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: 2,
              height: 2,
              backgroundColor: theme.palette.text.primary,
              opacity: 0.3,
              borderRadius: '50%',
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              animation: `float${i} ${particle.duration}s infinite ease-in-out`,
              animationDelay: `${particle.delay}s`,
              [`@keyframes float${i}`]: {
                '0%, 100%': {
                  transform: 'translateY(0) translateX(0)',
                  opacity: 0.3,
                },
                '50%': {
                  transform: `translateY(${particle.translateY}px) translateX(${particle.translateX}px)`,
                  opacity: 0.6,
                },
              },
            }}
          />
        ))}
      </Box>

      {/* Animated Grid Background */}
      <Box
        sx={{
          position: 'absolute',
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
          transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
          transition: 'transform 0.1s ease-out',
        }}
      />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {/* Animated 404 Text */}
          <Box
            sx={{
              position: 'relative',
              mb: 2,
            }}
          >
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '8rem', sm: '12rem', md: '16rem' },
                fontWeight: 700,
                color: theme.palette.text.primary,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                position: 'relative',
                textShadow: `
                  0 0 10px ${theme.palette.text.primary}40,
                  0 0 20px ${theme.palette.text.primary}30,
                  0 0 30px ${theme.palette.text.primary}20
                `,
                animation: 'glow 2s ease-in-out infinite alternate',
                '@keyframes glow': {
                  '0%': {
                    textShadow: `
                      0 0 10px ${theme.palette.text.primary}40,
                      0 0 20px ${theme.palette.text.primary}30,
                      0 0 30px ${theme.palette.text.primary}20
                    `,
                  },
                  '100%': {
                    textShadow: `
                      0 0 20px ${theme.palette.text.primary}60,
                      0 0 30px ${theme.palette.text.primary}50,
                      0 0 40px ${theme.palette.text.primary}40
                    `,
                  },
                },
              }}
            >
              404
            </Typography>
            
            {/* Glitch Effect Overlay */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                animation: 'glitch 3s infinite',
                '@keyframes glitch': {
                  '0%, 90%, 100%': {
                    transform: 'translate(0)',
                    opacity: 0,
                  },
                  '91%': {
                    transform: 'translate(-2px, 2px)',
                    opacity: 0.3,
                  },
                  '92%': {
                    transform: 'translate(2px, -2px)',
                    opacity: 0.3,
                  },
                  '93%': {
                    transform: 'translate(-2px, -2px)',
                    opacity: 0.3,
                  },
                  '94%': {
                    transform: 'translate(2px, 2px)',
                    opacity: 0.3,
                  },
                  '95%': {
                    transform: 'translate(0)',
                    opacity: 0,
                  },
                },
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '8rem', sm: '12rem', md: '16rem' },
                  fontWeight: 700,
                  color: theme.palette.text.primary,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                404
              </Typography>
            </Box>
          </Box>

          {/* Animated Orbiting Circles */}
          <Box
            sx={{
              position: 'relative',
              width: 200,
              height: 200,
              mx: 'auto',
              mb: 4,
            }}
          >
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.text.primary,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  animation: `orbit ${3 + i * 2}s linear infinite`,
                  animationDelay: `${i * 0.5}s`,
                  '@keyframes orbit': {
                    '0%': {
                      transform: 'translate(-50%, -50%) rotate(0deg) translateX(100px) rotate(0deg)',
                    },
                    '100%': {
                      transform: 'translate(-50%, -50%) rotate(360deg) translateX(100px) rotate(-360deg)',
                    },
                  },
                }}
              />
            ))}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: theme.palette.text.primary,
                boxShadow: `0 0 20px ${theme.palette.text.primary}60`,
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': {
                    transform: 'translate(-50%, -50%) scale(1)',
                    opacity: 1,
                  },
                  '50%': {
                    transform: 'translate(-50%, -50%) scale(1.2)',
                    opacity: 0.7,
                  },
                },
              }}
            />
          </Box>

          {/* Message */}
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="h4"
              component="h2"
              sx={{
                fontSize: { xs: '1.5rem', sm: '2rem' },
                fontWeight: 600,
                color: theme.palette.text.primary,
                mb: 2,
              }}
            >
              Page Not Found
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: { xs: '1rem', sm: '1.125rem' },
                maxWidth: 500,
                mx: 'auto',
              }}
            >
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
              Let&apos;s get you back on track.
            </Typography>
          </Box>

          {/* CTA Buttons */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              flexWrap: 'wrap',
              justifyContent: 'center',
              mt: 2,
            }}
          >
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => router.push('/dashboard')}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outlined"
              startIcon={<FolderIcon />}
              onClick={() => router.push('/projects')}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              View Projects
            </Button>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => router.back()}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              Go Back
            </Button>
          </Box>
        </Box>
      </Container>

    </Box>
  );
}

