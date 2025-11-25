'use client';

import { useState } from 'react';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 64;

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0a0e27' }}>
      <TopBar onSidebarToggle={handleSidebarToggle} sidebarOpen={sidebarOpen} />
      <Sidebar open={sidebarOpen} onToggle={handleSidebarToggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: '64px', // TopBar height
          width: { sm: `calc(100% - ${sidebarOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED}px)` },
          transition: 'width 0.3s ease',
          overflow: 'auto',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

