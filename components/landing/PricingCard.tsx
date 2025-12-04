'use client';

import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Box,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon,
  Star as StarIcon,
  Rocket as RocketIcon,
  Business as BusinessIcon,
  WorkspacePremium as PremiumIcon,
  AutoAwesome as EnterpriseIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { Package, PackageFeatures } from '@/lib/organizationContext';

interface PricingCardProps {
  pkg: Package;
  isPopular?: boolean;
  delay?: number;
  index?: number;
  onSelect?: (pkg: Package) => void;
}

// Define all possible features with labels
const ALL_FEATURES = [
  { key: 'ai_features_enabled', label: 'AI Features' },
  { key: 'ai_task_generator_enabled', label: 'AI Task Generator' },
  { key: 'analytics_enabled', label: 'Analytics & Reporting' },
  { key: 'api_access_enabled', label: 'API Access' },
  { key: 'ops_tool_enabled', label: 'Ops Tools' },
  { key: 'export_features_enabled', label: 'Export Features' },
  { key: 'custom_dashboards_enabled', label: 'Custom Dashboards' },
] as const;

// Additional capabilities that come with the platform
const PLATFORM_FEATURES = [
  'Phase-based project structure',
  'Team collaboration',
  'Time tracking',
  'Document generation',
];

export default function PricingCard({ pkg, isPopular = false, delay = 0, index = 0, onSelect }: PricingCardProps) {
  const theme = useTheme();
  const router = useRouter();

  // Get icon and color tint based on index
  const getPlanDetails = (index: number) => {
    const plans = [
      { icon: StarIcon, color: theme.palette.warning.main, tint: alpha(theme.palette.warning.main, 0.08) },
      { icon: RocketIcon, color: theme.palette.primary.main, tint: alpha(theme.palette.primary.main, 0.08) },
      { icon: BusinessIcon, color: theme.palette.info.main, tint: alpha(theme.palette.info.main, 0.08) },
      { icon: PremiumIcon, color: theme.palette.secondary.main, tint: alpha(theme.palette.secondary.main, 0.08) },
      { icon: EnterpriseIcon, color: theme.palette.success.main, tint: alpha(theme.palette.success.main, 0.08) },
    ];
    return plans[index % plans.length];
  };

  const planDetails = getPlanDetails(index);
  const PlanIcon = planDetails.icon;

  // Show monthly price by default, or yearly if monthly not available
  const pricingModel = pkg.pricing_model || 'per_user';
  const monthlyPrice = pricingModel === 'per_user' 
    ? pkg.price_per_user_monthly 
    : pkg.base_price_monthly;
  const yearlyPrice = pricingModel === 'per_user' 
    ? pkg.price_per_user_yearly 
    : pkg.base_price_yearly;
  
  const displayPrice = monthlyPrice || yearlyPrice || 0;
  const displaySuffix = monthlyPrice 
    ? (pricingModel === 'per_user' ? '/user/mo' : '/mo')
    : (pricingModel === 'per_user' ? '/user/yr' : '/yr');
  
  const hasBothPrices = monthlyPrice && yearlyPrice;

  // Get limits text
  const getLimitsText = (features: PackageFeatures) => {
    const limits: string[] = [];
    
    if (features.max_projects !== null) {
      limits.push(`${features.max_projects} projects`);
    } else {
      limits.push('Unlimited projects');
    }
    
    if (features.max_users !== null) {
      limits.push(`${features.max_users} users`);
    } else {
      limits.push('Unlimited users');
    }
    
    if (features.max_templates !== null) {
      limits.push(`${features.max_templates} templates`);
    } else {
      limits.push('Unlimited templates');
    }
    
    return limits;
  };

  const limits = getLimitsText(pkg.features);
  const supportLevel = pkg.features.support_level 
    ? pkg.features.support_level.charAt(0).toUpperCase() + pkg.features.support_level.slice(1)
    : 'Community';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      whileHover={{ y: -8 }}
      style={{ height: '100%', width: '100%' }}
    >
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: isPopular
            ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${theme.palette.background.paper} 100%)`
            : theme.palette.background.paper,
          border: isPopular
            ? `2px solid ${theme.palette.primary.main}`
            : `1px solid ${alpha(theme.palette.divider, 0.3)}`,
          borderRadius: 3,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isPopular 
            ? `0 8px 40px ${alpha(theme.palette.primary.main, 0.25)}`
            : `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
          '&:hover': {
            boxShadow: isPopular
              ? `0 16px 60px ${alpha(theme.palette.primary.main, 0.35)}`
              : `0 12px 40px ${alpha(planDetails.color, 0.2)}`,
            borderColor: isPopular ? theme.palette.primary.main : planDetails.color,
          },
        }}
      >
        <CardContent sx={{ flexGrow: 1, p: 3, pt: 3, display: 'flex', flexDirection: 'column' }}>
          {isPopular && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <Chip
                icon={<StarIcon sx={{ fontSize: 16 }} />}
                label="Most Popular"
                color="primary"
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  px: 1,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
                }}
              />
            </Box>
          )}
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: 3,
                backgroundColor: alpha(planDetails.color, 0.1),
                border: `2px solid ${alpha(planDetails.color, 0.2)}`,
                mb: 2,
              }}
            >
              <PlanIcon sx={{ fontSize: 28, color: planDetails.color }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {pkg.name}
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Typography
                variant="h3"
                component="span"
                sx={{
                  fontWeight: 800,
                  color: planDetails.color,
                }}
              >
                ${displayPrice.toFixed(2)}
              </Typography>
              <Typography
                variant="body2"
                component="span"
                color="text.secondary"
                sx={{ ml: 0.5 }}
              >
                {displaySuffix}
              </Typography>
            </Box>
            {hasBothPrices && (
              <Typography variant="caption" color="text.secondary">
                or ${yearlyPrice.toFixed(2)}{pricingModel === 'per_user' ? '/user/yr' : '/yr'} (save ~17%)
              </Typography>
            )}
          </Box>

          {/* Limits */}
          <Box sx={{ mb: 2, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              {limits.map((limit, idx) => (
                <Chip
                  key={idx}
                  label={limit}
                  size="small"
                  sx={{
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                    fontWeight: 500,
                    fontSize: '0.7rem',
                  }}
                />
              ))}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Features */}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, mb: 1, display: 'block' }}>
              Features
            </Typography>
            <List dense sx={{ py: 0 }}>
              {ALL_FEATURES.map((feature) => {
                const isEnabled = pkg.features[feature.key as keyof PackageFeatures];
                return (
                  <ListItem key={feature.key} disableGutters sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      {isEnabled ? (
                        <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
                      ) : (
                        <CancelIcon sx={{ fontSize: 18, color: alpha(theme.palette.text.secondary, 0.3) }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={feature.label}
                      primaryTypographyProps={{
                        variant: 'body2',
                        sx: { 
                          fontWeight: isEnabled ? 500 : 400,
                          color: isEnabled ? 'text.primary' : alpha(theme.palette.text.secondary, 0.5),
                          textDecoration: isEnabled ? 'none' : 'line-through',
                        },
                      }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>

          {/* Support Level */}
          <Box sx={{ mt: 2, mb: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {supportLevel} Support
            </Typography>
          </Box>

          {/* CTA Button */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={() => {
              if (onSelect) {
                onSelect(pkg);
              } else {
                sessionStorage.setItem('selectedPackageId', pkg.id);
                router.push('/auth/signup');
              }
            }}
            sx={{
              mt: 'auto',
              py: 1.5,
              fontWeight: 700,
              fontSize: '1rem',
              borderRadius: 2,
              backgroundColor: '#1a1a1a',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#333333',
              },
            }}
          >
            Get Started
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
