'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Box,
  Container,
  Typography,
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
  Chip,
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  LocalOffer as OfferIcon,
} from '@mui/icons-material';
import PricingCard from '@/components/landing/PricingCard';
import SignupModal from '@/components/landing/SignupModal';
import LandingHeader from '@/components/landing/LandingHeader';
import type { Package } from '@/lib/organizationContext';

function PricingPageContent() {
  const theme = useTheme();
  const searchParams = useSearchParams();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [signupModalOpen, setSignupModalOpen] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [affiliateDiscount, setAffiliateDiscount] = useState<{ type: string; value: number } | null>(null);

  // Capture ref parameter from URL and store in sessionStorage
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      sessionStorage.setItem('affiliate_code', refCode.toUpperCase());
      setAffiliateCode(refCode.toUpperCase());
      // Validate the affiliate code
      validateAffiliateCode(refCode.toUpperCase());
    } else {
      // Check if there's a stored affiliate code
      const storedCode = sessionStorage.getItem('affiliate_code');
      if (storedCode) {
        setAffiliateCode(storedCode);
        validateAffiliateCode(storedCode);
      }
    }
  }, [searchParams]);

  const validateAffiliateCode = async (code: string) => {
    try {
      const response = await fetch('/api/affiliates/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.code) {
          setAffiliateDiscount({
            type: data.code.discount_type,
            value: data.code.discount_value,
          });
        }
      }
    } catch (err) {
      console.error('Failed to validate affiliate code:', err);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

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
        setPackages(data.packages || []);
      }
    } catch (err) {
      console.error('Failed to load packages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePackageSelect = (pkg: Package) => {
    setSelectedPackage(pkg);
    setSignupModalOpen(true);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <LandingHeader />

      <Container maxWidth="xl" sx={{ py: { xs: 4, md: 8 }, px: { xs: 0, md: 3 } }}>
        {/* Header */}
        <Box sx={{ mb: 8, textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                fontWeight: 800,
                mb: 2,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Choose Your Plan
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: '700px', mx: 'auto' }}
            >
              Start with a free trial, then choose the plan that fits your team
            </Typography>
            {/* Show affiliate discount banner */}
            {affiliateCode && affiliateDiscount && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <Chip
                  icon={<OfferIcon />}
                  label={
                    affiliateDiscount.type === 'percentage'
                      ? `${affiliateDiscount.value}% discount applied with code: ${affiliateCode}`
                      : affiliateDiscount.type === 'fixed_amount'
                      ? `$${affiliateDiscount.value} off applied with code: ${affiliateCode}`
                      : `Special offer applied with code: ${affiliateCode}`
                  }
                  color="success"
                  sx={{ mt: 2, fontWeight: 600 }}
                />
              </motion.div>
            )}
          </motion.div>
        </Box>

        {/* Pricing Cards */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={4} sx={{ mb: 10 }}>
            {packages.map((pkg, index) => (
              <Grid 
                item 
                xs={12} 
                sm={6} 
                md={4} 
                key={pkg.id}
                sx={{ display: 'flex' }}
              >
                <Box sx={{ width: '100%' }}>
                  <PricingCard
                    pkg={pkg}
                    isPopular={index === 1}
                    delay={index * 0.1}
                    index={index}
                    onSelect={handlePackageSelect}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Comparison Table */}
        <Box sx={{ py: { xs: 6, md: 10 } }}>
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
              Compare with Competitors
            </Typography>
            <Typography
              variant="h6"
              align="center"
              color="text.secondary"
              sx={{ mb: 6, maxWidth: '700px', mx: 'auto' }}
            >
              See how FullStack Method™ stacks up against the competition
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
                  { feature: 'Project Templates', fsm: true, jira: true, linear: true, notion: true, asana: true },
                  { feature: 'Team Collaboration', fsm: true, jira: true, linear: true, notion: true, asana: true },
                  { feature: 'Task Management', fsm: true, jira: true, linear: true, notion: true, asana: true },
                  { feature: 'RBAC & Permissions', fsm: true, jira: true, linear: true, notion: true, asana: true },
                  { feature: 'API Access', fsm: true, jira: true, linear: true, notion: true, asana: true },
                  { feature: 'Real-time Analytics', fsm: true, jira: true, linear: true, notion: false, asana: true },
                  { feature: 'Multi-tenant Architecture', fsm: true, jira: true, linear: false, notion: false, asana: true },
                  { feature: 'GitHub Integration', fsm: true, jira: true, linear: true, notion: false, asana: false },
                  { feature: 'Audit Trails', fsm: true, jira: true, linear: false, notion: false, asana: false },
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
      </Container>

      {/* Signup Modal */}
      <SignupModal
        open={signupModalOpen}
        onClose={() => {
          setSignupModalOpen(false);
          setSelectedPackage(null);
        }}
        package={selectedPackage}
        affiliateCode={affiliateCode}
      />
    </Box>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    }>
      <PricingPageContent />
    </Suspense>
  );
}

