'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, Typography, Box, useTheme, alpha } from '@mui/material';
import { ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  delay?: number;
}

export default function FeatureCard({ icon, title, description, delay = 0 }: FeatureCardProps) {
  const theme = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      whileHover={{ scale: 1.02, y: -4 }}
    >
      <Card
        sx={{
          height: '100%',
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          borderRadius: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.2)}`,
          },
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 2,
              color: theme.palette.primary.main,
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {description}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  );
}

