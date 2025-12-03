'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography, useTheme, alpha } from '@mui/material';

interface BuildingOverlayProps {
  open: boolean;
  message?: string;
}

// 35 famous quotes
const quotes = [
  "The way to get started is to quit talking and begin doing. - Walt Disney",
  "Innovation distinguishes between a leader and a follower. - Steve Jobs",
  "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
  "It is during our darkest moments that we must focus to see the light. - Aristotle",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
  "The only way to do great work is to love what you do. - Steve Jobs",
  "If you can dream it, you can do it. - Walt Disney",
  "The best time to plant a tree was 20 years ago. The second best time is now. - Chinese Proverb",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Dream bigger. Do bigger.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Do something today that your future self will thank you for.",
  "Little things make big things happen.",
  "It's going to be hard, but hard does not mean impossible.",
  "Don't wait for opportunity. Create it.",
  "Sometimes we're tested not to show our weaknesses, but to discover our strengths.",
  "The key to success is to focus on goals, not obstacles.",
  "Dream it. Believe it. Build it.",
  "The only way to do great work is to love what you do. - Steve Jobs",
  "The journey of a thousand miles begins with one step. - Lao Tzu",
  "Believe you can and you're halfway there. - Theodore Roosevelt",
  "It does not matter how slowly you go as long as you do not stop. - Confucius",
  "The only impossible journey is the one you never begin. - Tony Robbins",
  "In the middle of difficulty lies opportunity. - Albert Einstein",
  "You miss 100% of the shots you don't take. - Wayne Gretzky",
  "The way to get started is to quit talking and begin doing. - Walt Disney",
  "Don't be afraid to give up the good to go for the great. - John D. Rockefeller",
  "Innovation is the ability to see change as an opportunity, not a threat. - Steve Jobs",
  "The only person you are destined to become is the person you decide to be. - Ralph Waldo Emerson",
];

export default function BuildingOverlay({ 
  open, 
  message = 'Building...' 
}: BuildingOverlayProps) {
  const theme = useTheme();
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Building blocks configuration - different heights for visual interest
  const blocks = [
    { height: 40, delay: 0 },
    { height: 60, delay: 0.1 },
    { height: 80, delay: 0.2 },
    { height: 50, delay: 0.3 },
    { height: 70, delay: 0.4 },
    { height: 90, delay: 0.5 },
    { height: 55, delay: 0.6 },
    { height: 75, delay: 0.7 },
  ];

  // Auto-advance quotes every 5 seconds (pauses on hover)
  useEffect(() => {
    if (!open || isPaused) return;

    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [open, isPaused]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.05,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.2,
      },
    },
  };

  // Continuous animation for blocks (loops while loading)
  // Using direct animation props instead of variants for continuous loop

  const textVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.3,
        duration: 0.4,
      },
    },
  };

  const quoteVariants = {
    enter: {
      opacity: 0,
      y: 20,
    },
    center: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut' as const,
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.3,
        ease: 'easeIn' as const,
      },
    },
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={containerVariants}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(theme.palette.background.default, 0.95),
            backdropFilter: 'blur(8px)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {/* Building Blocks Animation - Continuous loop */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 2,
                height: 120,
                position: 'relative',
              }}
            >
              {blocks.map((block, index) => (
                <motion.div
                  key={index}
                  animate={{
                    y: [0, -10, 0],
                    opacity: [1, 0.8, 1],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    delay: index * 0.1,
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut' as const,
                  }}
                  style={{
                    width: 30,
                    height: block.height,
                    backgroundColor: theme.palette.primary.main,
                    borderRadius: '4px',
                    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
                    position: 'relative',
                  }}
                >
                  {/* Add a subtle shine effect */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '30%',
                      background: `linear-gradient(to bottom, ${alpha('#fff', 0.3)}, transparent)`,
                      borderRadius: '4px 4px 0 0',
                    }}
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.2,
                    }}
                  />
                </motion.div>
              ))}
            </Box>

            {/* Text */}
            <motion.div
              variants={textVariants}
            >
              <Typography
                variant="h6"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  fontSize: '1.5rem',
                }}
              >
                {message}
              </Typography>
            </motion.div>

            {/* Quote Slider */}
            <Box
              sx={{
                maxWidth: '600px',
                width: '100%',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuoteIndex}
                  variants={quoteVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  style={{
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      color: theme.palette.text.secondary,
                      fontStyle: 'italic',
                      fontSize: '1rem',
                      px: 2,
                    }}
                  >
                    &ldquo;{quotes[currentQuoteIndex]}&rdquo;
                  </Typography>
                </motion.div>
              </AnimatePresence>
            </Box>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

