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
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
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
}

export default function PricingCard({ pkg, isPopular = false, delay = 0 }: PricingCardProps) {
  const theme = useTheme();
  const router = useRouter();

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
      whileHover={{ scale: 1.03, y: -8 }}
    >
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: isPopular
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
          border: isPopular
            ? `2px solid ${theme.palette.primary.main}`
            : `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          borderRadius: 3,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: `0 12px 48px ${alpha(theme.palette.primary.main, isPopular ? 0.3 : 0.15)}`,
          },
        }}
      >
        {isPopular && (
          <Chip
            label="Most Popular"
            color="primary"
            size="small"
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              fontWeight: 600,
            }}
          />
        )}
        <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 1, fontSize: '1rem' }}>
            {pkg.name}
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                display: 'inline',
                color: theme.palette.primary.main,
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

