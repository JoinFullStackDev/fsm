'use client';

import { useRouter } from 'next/navigation';
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography, Box } from '@mui/material';
import { Home as HomeIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const router = useRouter();

  const handleClick = (href: string) => {
    router.push(href);
  };

  return (
    <MuiBreadcrumbs
      separator={<ChevronRightIcon sx={{ fontSize: 16, color: '#B0B0B0' }} />}
      sx={{
        mb: 2,
        '& .MuiBreadcrumbs-ol': {
          flexWrap: 'nowrap',
        },
      }}
    >
      <Box
        component="span"
        onClick={() => handleClick('/dashboard')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          color: '#00E5FF',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
      >
        <HomeIcon sx={{ fontSize: 18, mr: { xs: 0, md: 0.5 } }} />
        <Typography 
          variant="body2" 
          sx={{ 
            color: '#00E5FF',
            display: { xs: 'none', md: 'block' },
          }}
        >
          Dashboard
        </Typography>
      </Box>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        if (isLast || !item.href) {
          return (
            <Typography
              key={index}
              variant="body2"
              sx={{
                color: isLast ? '#E0E0E0' : '#B0B0B0',
                fontWeight: isLast ? 600 : 400,
              }}
            >
              {item.label}
            </Typography>
          );
        }

        return (
          <Link
            key={index}
            component="button"
            variant="body2"
            onClick={() => item.href && handleClick(item.href)}
            sx={{
              color: '#00E5FF',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
}

