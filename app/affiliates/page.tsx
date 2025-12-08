'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  useTheme,
  alpha,
  Stack,
  Chip,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  Link as LinkIcon,
  Analytics as AnalyticsIcon,
  Support as SupportIcon,
  CheckCircle as CheckIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Star as StarIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';

const benefits = [
  {
    icon: MoneyIcon,
    title: 'Generous Commissions',
    description: 'Earn competitive commissions on every referral that converts to a paid subscription.',
  },
  {
    icon: LinkIcon,
    title: 'Unique Referral Links',
    description: 'Get your personalized tracking link to share with your audience and track conversions.',
  },
  {
    icon: AnalyticsIcon,
    title: 'Real-time Dashboard',
    description: 'Monitor your referrals, conversions, and earnings with our comprehensive analytics.',
  },
  {
    icon: SupportIcon,
    title: 'Dedicated Support',
    description: 'Access our affiliate support team to help maximize your earning potential.',
  },
];

const partnershipTiers = [
  {
    name: 'Starter Partner',
    commission: '10%',
    requirements: ['Active referral link', 'At least 1 conversion'],
    features: ['Basic analytics', 'Email support', 'Marketing materials'],
  },
  {
    name: 'Growth Partner',
    commission: '15%',
    requirements: ['5+ conversions', '3+ months active'],
    features: ['Advanced analytics', 'Priority support', 'Co-marketing opportunities'],
    featured: true,
  },
  {
    name: 'Elite Partner',
    commission: '20%',
    requirements: ['15+ conversions', '6+ months active'],
    features: ['Custom commission rates', 'Dedicated account manager', 'Exclusive promotions'],
  },
];

const platformHighlights = [
  'AI-powered project management',
  'Phase-based workflow methodology',
  'Blueprint & PRD generation',
  'Team collaboration tools',
  'Export to development tools',
  'Real-time analytics',
];

export default function AffiliatesLandingPage() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
      <LandingHeader />

      {/* Hero Section */}
      <Box
        sx={{
          pt: { xs: 12, md: 16 },
          pb: { xs: 8, md: 12 },
          background: `radial-gradient(ellipse at top left, ${alpha(theme.palette.primary.main, 0.15)} 0%, transparent 50%),
                       radial-gradient(ellipse at bottom right, ${alpha(theme.palette.secondary.main, 0.1)} 0%, transparent 50%)`,
        }}
      >
        <Container maxWidth="lg">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Box sx={{ textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
              <Chip
                icon={<StarIcon sx={{ fontSize: 16 }} />}
                label="Partner Program"
                color="primary"
                sx={{ mb: 3, fontWeight: 600 }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '4rem' },
                  fontWeight: 800,
                  mb: 3,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1.2,
                }}
              >
                Earn by Sharing FullStack Method™
              </Typography>
              <Typography
                variant="h5"
                sx={{ color: 'text.secondary', mb: 4, fontWeight: 400, lineHeight: 1.6 }}
              >
                Join our affiliate program and earn generous commissions for every customer you refer.
                Help teams ship products faster while growing your income.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => router.push('/affiliates/apply')}
                    sx={{
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      borderRadius: 2,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                      boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`,
                    }}
                  >
                    Apply Now
                  </Button>
                </motion.div>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => router.push('/pricing')}
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: 2,
                    borderWidth: 2,
                    '&:hover': { borderWidth: 2 },
                  }}
                >
                  View Pricing
                </Button>
              </Stack>
            </Box>
          </motion.div>
        </Container>
      </Box>

      {/* Benefits Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Typography
            variant="h2"
            sx={{
              textAlign: 'center',
              fontWeight: 700,
              mb: 2,
              fontSize: { xs: '2rem', md: '2.5rem' },
            }}
          >
            Why Partner With Us?
          </Typography>
          <Typography
            variant="h6"
            sx={{ textAlign: 'center', color: 'text.secondary', mb: 6, maxWidth: 600, mx: 'auto' }}
          >
            Everything you need to succeed as an affiliate partner
          </Typography>
        </motion.div>

        <Grid container spacing={4}>
          {benefits.map((benefit, index) => (
            <Grid item xs={12} sm={6} md={3} key={benefit.title}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card
                  sx={{
                    height: '100%',
                    p: 3,
                    textAlign: 'center',
                    background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 3,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
                      borderColor: theme.palette.primary.main,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <benefit.icon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {benefit.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {benefit.description}
                  </Typography>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Partnership Tiers Section */}
      <Box sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.03), py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Typography
              variant="h2"
              sx={{
                textAlign: 'center',
                fontWeight: 700,
                mb: 2,
                fontSize: { xs: '2rem', md: '2.5rem' },
              }}
            >
              Partnership Tiers
            </Typography>
            <Typography
              variant="h6"
              sx={{ textAlign: 'center', color: 'text.secondary', mb: 6, maxWidth: 600, mx: 'auto' }}
            >
              Grow with us and unlock higher commission rates
            </Typography>
          </motion.div>

          <Grid container spacing={4} justifyContent="center">
            {partnershipTiers.map((tier, index) => (
              <Grid item xs={12} md={4} key={tier.name}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card
                    sx={{
                      height: '100%',
                      position: 'relative',
                      overflow: 'visible',
                      border: tier.featured
                        ? `2px solid ${theme.palette.primary.main}`
                        : `1px solid ${theme.palette.divider}`,
                      borderRadius: 3,
                      transition: 'all 0.3s ease',
                      transform: tier.featured ? 'scale(1.05)' : 'none',
                      zIndex: tier.featured ? 1 : 0,
                      '&:hover': {
                        transform: tier.featured ? 'scale(1.08)' : 'scale(1.02)',
                        boxShadow: `0 16px 48px ${alpha(theme.palette.primary.main, 0.2)}`,
                      },
                    }}
                  >
                    {tier.featured && (
                      <Chip
                        label="Most Popular"
                        color="primary"
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: -12,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontWeight: 600,
                        }}
                      />
                    )}
                    <CardContent sx={{ p: 4 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                        {tier.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 3 }}>
                        <Typography
                          variant="h2"
                          sx={{
                            fontWeight: 800,
                            color: theme.palette.primary.main,
                          }}
                        >
                          {tier.commission}
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'text.secondary', ml: 1 }}>
                          commission
                        </Typography>
                      </Box>

                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
                        Requirements
                      </Typography>
                      <Stack spacing={0.5} sx={{ mb: 3 }}>
                        {tier.requirements.map((req) => (
                          <Box key={req} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                            <Typography variant="body2">{req}</Typography>
                          </Box>
                        ))}
                      </Stack>

                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
                        Features
                      </Typography>
                      <Stack spacing={0.5}>
                        {tier.features.map((feature) => (
                          <Box key={feature} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                            <Typography variant="body2">{feature}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Platform Capabilities Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  fontSize: { xs: '2rem', md: '2.5rem' },
                }}
              >
                What You&apos;ll Be Promoting
              </Typography>
              <Typography variant="h6" sx={{ color: 'text.secondary', mb: 4 }}>
                FullStack Method™ is a comprehensive platform that helps teams plan, design, and build products faster.
              </Typography>
              <Stack spacing={2}>
                {platformHighlights.map((highlight, index) => (
                  <motion.div
                    key={highlight}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        }}
                      >
                        <CheckIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {highlight}
                      </Typography>
                    </Box>
                  </motion.div>
                ))}
              </Stack>
            </motion.div>
          </Grid>
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Card
                sx={{
                  p: 4,
                  background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  borderRadius: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <TrendingUpIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      High Conversion
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Our product sells itself
                    </Typography>
                  </Box>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={6}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>
                      30%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Trial to Paid
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>
                      90%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Customer Retention
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>
                      $199
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg. Yearly Value
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>
                      12mo
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Cookie Duration
                    </Typography>
                  </Grid>
                </Grid>
              </Card>
            </motion.div>
          </Grid>
        </Grid>
      </Container>

      {/* CTA Section */}
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
        }}
      >
        <Container maxWidth="md">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <PeopleIcon sx={{ fontSize: 64, color: 'white', opacity: 0.8, mb: 2 }} />
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 700,
                  color: 'white',
                  mb: 2,
                  fontSize: { xs: '2rem', md: '2.5rem' },
                }}
              >
                Ready to Start Earning?
              </Typography>
              <Typography
                variant="h6"
                sx={{ color: 'rgba(255,255,255,0.9)', mb: 4, maxWidth: 500, mx: 'auto' }}
              >
                Apply to become an affiliate partner today and start earning commissions on every referral.
              </Typography>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => router.push('/affiliates/apply')}
                  sx={{
                    px: 5,
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: 2,
                    backgroundColor: 'white',
                    color: theme.palette.primary.main,
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.9)',
                    },
                  }}
                >
                  Apply Now
                </Button>
              </motion.div>
            </Box>
          </motion.div>
        </Container>
      </Box>

      <LandingFooter />
    </Box>
  );
}

