'use client';

import { Box, Container, Typography, Link, IconButton, Divider } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { GitHub as GitHubIcon, LinkedIn as LinkedInIcon, Twitter as TwitterIcon } from '@mui/icons-material';

export default function LandingFooter() {
  const theme = useTheme();
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Become an Affiliate', href: '/affiliates' },
    { label: 'Contact', href: 'mailto:support@fullstackmethod.com' },
  ];

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        py: 4,
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.5),
        backdropFilter: 'blur(10px)',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {/* Logo and Copyright */}
          <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5,
              }}
            >
              FullStack Method™
            </Typography>
            <Typography variant="body2" color="text.secondary">
              © {currentYear} FullStack Method. All rights reserved.
            </Typography>
          </Box>

          {/* Links */}
          <Box
            sx={{
              display: 'flex',
              gap: { xs: 2, md: 4 },
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                underline="none"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'color 0.2s ease',
                  '&:hover': {
                    color: 'text.primary',
                  },
                }}
              >
                {link.label}
              </Link>
            ))}
          </Box>

          {/* Social Icons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              size="small"
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <GitHubIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <LinkedInIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <TwitterIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

