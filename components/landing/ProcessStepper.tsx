'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Card,
  CardContent,
  useTheme,
  alpha,
  Grid,
} from '@mui/material';
import {
  Lightbulb as LightbulbIcon,
  Description as DescriptionIcon,
  Architecture as ArchitectureIcon,
  Code as CodeIcon,
  BugReport as BugReportIcon,
  Rocket as RocketIcon,
} from '@mui/icons-material';

const phases = [
  {
    id: 1,
    name: 'Problem Definition',
    icon: LightbulbIcon,
    description: 'Define the problem and validate market need',
    mockContent: 'User Research • Market Analysis • Problem Statement',
  },
  {
    id: 2,
    name: 'Solution Design',
    icon: DescriptionIcon,
    description: 'Create PRDs, user stories, and specifications',
    mockContent: 'PRD Generated • 12 User Stories • ERD Created',
  },
  {
    id: 3,
    name: 'Architecture Planning',
    icon: ArchitectureIcon,
    description: 'Design system architecture and data models',
    mockContent: 'System Architecture • Database Schema • API Design',
  },
  {
    id: 4,
    name: 'Development',
    icon: CodeIcon,
    description: 'Build features with AI-assisted code generation',
    mockContent: 'Components Built • Tests Written • Documentation',
  },
  {
    id: 5,
    name: 'Testing & QA',
    icon: BugReportIcon,
    description: 'Test, debug, and ensure quality',
    mockContent: '23 Tests Passing • 5 Bugs Fixed • Coverage 85%',
  },
  {
    id: 6,
    name: 'Launch',
    icon: RocketIcon,
    description: 'Deploy and monitor your product',
    mockContent: 'Deployed to Production • Monitoring Active • Users Growing',
  },
];

export default function ProcessStepper() {
  const theme = useTheme();
  const [activePhase, setActivePhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((prev) => (prev + 1) % phases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Grid container spacing={4}>
      <Grid item xs={12} md={6}>
        <Stepper activeStep={activePhase} orientation="vertical">
          {phases.map((phase, index) => {
            const Icon = phase.icon;
            return (
              <Step key={phase.id}>
                <StepLabel
                  onClick={() => setActivePhase(index)}
                  sx={{
                    cursor: 'pointer',
                    '& .MuiStepLabel-label': {
                      fontWeight: activePhase === index ? 600 : 400,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon
                      sx={{
                        color: activePhase === index ? theme.palette.primary.main : 'text.secondary',
                      }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: activePhase === index ? 600 : 400 }}>
                      {phase.name}
                    </Typography>
                  </Box>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {phase.description}
                  </Typography>
                </StepContent>
              </Step>
            );
          })}
        </Stepper>
      </Grid>
      <Grid item xs={12} md={6}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activePhase}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
                border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                borderRadius: 3,
                minHeight: 300,
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  {React.createElement(phases[activePhase].icon, {
                    sx: { fontSize: 40, color: theme.palette.primary.main },
                  })}
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {phases[activePhase].name}
                  </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  {phases[activePhase].description}
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: alpha(theme.palette.primary.main, 0.1),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {phases[activePhase].mockContent}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </Grid>
    </Grid>
  );
}

