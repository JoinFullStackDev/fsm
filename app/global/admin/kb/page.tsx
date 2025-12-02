'use client';

import { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Article as ArticleIcon,
  Category as CategoryIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import ArticlesTab from '@/components/global-admin/kb/ArticlesTab';
import CategoriesTab from '@/components/global-admin/kb/CategoriesTab';
import AdministrationTab from '@/components/global-admin/kb/AdministrationTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`kb-tabpanel-${index}`}
      aria-labelledby={`kb-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function KnowledgeBaseAdminPage() {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  return (
    <Box>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{
          fontSize: '1.75rem',
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 3,
        }}
      >
        Knowledge Base Administration
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange} aria-label="KB admin tabs">
          <Tab
            icon={<ArticleIcon />}
            iconPosition="start"
            label="Articles"
            id="kb-tab-0"
            aria-controls="kb-tabpanel-0"
          />
          <Tab
            icon={<CategoryIcon />}
            iconPosition="start"
            label="Categories"
            id="kb-tab-1"
            aria-controls="kb-tabpanel-1"
          />
          <Tab
            icon={<SettingsIcon />}
            iconPosition="start"
            label="Administration"
            id="kb-tab-2"
            aria-controls="kb-tabpanel-2"
          />
        </Tabs>
      </Box>

      <TabPanel value={currentTab} index={0}>
        <ArticlesTab />
      </TabPanel>
      <TabPanel value={currentTab} index={1}>
        <CategoriesTab />
      </TabPanel>
      <TabPanel value={currentTab} index={2}>
        <AdministrationTab />
      </TabPanel>
    </Box>
  );
}
