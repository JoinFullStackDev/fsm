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
} from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon,
  Star as StarIcon,
  Rocket as RocketIcon,
  Business as BusinessIcon,
  WorkspacePremium as PremiumIcon,
  AutoAwesome as EnterpriseIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { PackageFeatures } from '@/lib/organizationContext';

interface Package {
  id: string;
  name: string;
  price_per_user_monthly: number;
  features: PackageFeatures;
  display_order: number;
}

interface PricingCardProps {
  pkg: Package;
  isPopular?: boolean;
  delay?: number;
  index?: number;
}

export default function PricingCard({ pkg, isPopular = false, delay = 0, index = 0 }: PricingCardProps) {
  const theme = useTheme();
  const router = useRouter();

  // Get icon and color tint based on index
  const getPlanDetails = (index: number) => {
    const plans = [
      { icon: StarIcon, color: theme.palette.warning.main, tint: alpha(theme.palette.warning.main, 0.05) },
      { icon: RocketIcon, color: theme.palette.primary.main, tint: alpha(theme.palette.primary.main, 0.05) },
      { icon: BusinessIcon, color: theme.palette.info.main, tint: alpha(theme.palette.info.main, 0.05) },
      { icon: PremiumIcon, color: theme.palette.secondary.main, tint: alpha(theme.palette.secondary.main, 0.05) },
      { icon: EnterpriseIcon, color: theme.palette.success.main, tint: alpha(theme.palette.success.main, 0.05) },
    ];
    return plans[index % plans.length];
  };

  const planDetails = getPlanDetails(index);
  const PlanIcon = planDetails.icon;

  const getFeatureList = (features: PackageFeatures) => {
    const list: string[] = [];
    
    // Module features
    if (features.ai_features_enabled) list.push('AI Features');
    if (features.analytics_enabled) list.push('Analytics');
    if (features.api_access_enabled) list.push('API Access');
    if (features.ops_tool_enabled) list.push('Ops Tool');
    if (features.export_features_enabled) list.push('Export Features');
    
    // Limits
    if (features.max_projects !== null) {
      list.push(`${features.max_projects} Projects`);
    } else {
      list.push('Unlimited Projects');
    }
    
    if (features.max_users !== null) {
      list.push(`${features.max_users} Users`);
    } else {
      list.push('Unlimited Users');
    }
    
    if (features.max_templates !== null) {
      list.push(`${features.max_templates} Templates`);
    } else {
      list.push('Unlimited Templates');
    }
    
    // Support level
    const supportLevel = features.support_level 
      ? features.support_level.charAt(0).toUpperCase() + features.support_level.slice(1)
      : 'Community';
    list.push(`${supportLevel} Support`);
    
    return list;
  };

  const features = getFeatureList(pkg.features);

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      whileHover={{ scale: 1.05, y: -12 }}
      style={{ height: '100%' }}
    >
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: isPopular
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`
            : `linear-gradient(135deg, ${planDetails.tint} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
          border: isPopular
            ? `2px solid ${theme.palette.primary.main}`
            : `1px solid ${alpha(planDetails.color, 0.3)}`,
          borderRadius: 3,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 4px 16px ${alpha(planDetails.color, 0.1)}`,
          '&:hover': {
            boxShadow: `0 16px 64px ${alpha(planDetails.color, isPopular ? 0.4 : 0.25)}`,
            borderColor: isPopular ? theme.palette.primary.main : planDetails.color,
          },
        }}
      >
        {isPopular && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: delay + 0.2 }}
          >
            <Chip
              icon={<StarIcon sx={{ fontSize: 16 }} />}
              label="Most Popular"
              color="primary"
              size="small"
              sx={{
                position: 'absolute',
                top: 5,
                right: 8,
                fontWeight: 700,
                fontSize: '0.75rem',
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                zIndex: 1,
              }}
            />
          </motion.div>
        )}
        <CardContent sx={{ flexGrow: 1, p: 2.5, pt: isPopular ? 4.5 : 2.5, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <motion.div
              whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
              transition={{ duration: 0.5 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  backgroundColor: alpha(planDetails.color, 0.1),
                  border: `2px solid ${alpha(planDetails.color, 0.3)}`,
                }}
              >
                <PlanIcon sx={{ fontSize: 28, color: planDetails.color }} />
              </Box>
            </motion.div>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', flex: 1 }}>
              {pkg.name}
            </Typography>
          </Box>
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                display: 'inline',
                color: planDetails.color,
                fontSize: '1.5rem',
              }}
            >
              ${pkg.price_per_user_monthly.toFixed(2)}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: 'inline', ml: 0.5, fontSize: '0.75rem' }}
            >
              /mo
            </Typography>
          </Box>
          <List dense sx={{ flexGrow: 1, mb: 2 }}>
            {features.slice(0, 4).map((feature, index) => (
              <ListItem key={index} disableGutters sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <CheckCircleIcon sx={{ fontSize: 14, color: theme.palette.success.main }} />
                </ListItemIcon>
                <ListItemText
                  primary={feature}
                  primaryTypographyProps={{
                    variant: 'body2',
                    sx: { fontSize: '0.75rem' },
                  }}
                />
              </ListItem>
            ))}
          </List>
          <Button
            fullWidth
            variant={isPopular ? 'contained' : 'outlined'}
            size="small"
            onClick={() => {
              sessionStorage.setItem('selectedPackageId', pkg.id);
              router.push('/auth/signup');
            }}
            sx={{
              mt: 'auto',
              py: 1,
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Get Started
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

