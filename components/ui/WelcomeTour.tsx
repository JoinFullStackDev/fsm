'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  IconButton,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  RocketLaunch as RocketLaunchIcon,
  AutoAwesome as AutoAwesomeIcon,
  Build as BuildIcon,
  PlayArrow as PlayArrowIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Keyboard as KeyboardIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Folder as FolderIcon,
  Code as CodeIcon,
  Description as DescriptionIcon,
  Person as PersonIcon,
  AccountCircle as AccountCircleIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Business as BusinessIcon,
  Contacts as ContactsIcon,
  TrendingUp as TrendingUpIcon,
  Article as ArticleIcon,
  School as SchoolIcon,
  SmartToy as SmartToyIcon,
  CloudUpload as CloudUploadIcon,
  Mouse as MouseIcon,
  ArrowRight as ArrowRightIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';

interface TourStep {
  title: string;
  description: string;
  content: React.ReactNode;
  icon: React.ReactNode;
  mockComponent: React.ReactNode;
}

interface WelcomeTourProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Animated mock components for new tour steps

// Step 1: Profile Setup - Full width with sidebar and form side by side
const MockProfileSetup = ({ theme }: { theme: any }) => {
  const [step, setStep] = useState(0);
  const [imageUploading, setImageUploading] = useState(false);
  
  useEffect(() => {
    const sequence = [
      { delay: 0, action: () => setStep(0) },
      { delay: 2000, action: () => setStep(1) },
      { delay: 4000, action: () => setStep(2) },
      { delay: 6000, action: () => { setStep(3); setImageUploading(true); } },
      { delay: 8000, action: () => { setImageUploading(false); setStep(0); } },
    ];
    
    let timeoutIds: NodeJS.Timeout[] = [];
    sequence.forEach(({ delay, action }) => {
      timeoutIds.push(setTimeout(action, delay));
    });
    return () => timeoutIds.forEach(clearTimeout);
  }, []);
  
  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        gap: 3,
        minHeight: '400px',
      }}
    >
      {/* Left Sidebar - Profile Image */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        style={{ flex: '0 0 250px' }}
      >
        <Card
          sx={{
            p: 3,
            height: '100%',
            backgroundColor: theme.palette.background.paper,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            animate={{
              scale: step === 3 ? [1, 1.1, 1] : 1,
              borderColor: step === 3 ? theme.palette.primary.main : theme.palette.divider,
            }}
            transition={{ duration: 0.3 }}
          >
            <Box
              sx={{
                width: 150,
                height: 150,
                borderRadius: '50%',
                border: `3px solid ${step === 3 ? theme.palette.primary.main : theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: step === 3 ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                position: 'relative',
                overflow: 'hidden',
                mb: 2,
              }}
            >
              {imageUploading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <CloudUploadIcon sx={{ fontSize: 60, color: theme.palette.primary.main }} />
                </motion.div>
              ) : (
                <AccountCircleIcon sx={{ fontSize: 120, color: theme.palette.text.secondary }} />
              )}
              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    backgroundColor: theme.palette.primary.main,
                    borderRadius: '50%',
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AddIcon sx={{ fontSize: 24, color: theme.palette.background.default }} />
                </motion.div>
              )}
            </Box>
          </motion.div>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
            Click to upload profile image
          </Typography>
        </Card>
      </motion.div>

      {/* Right Side - Form Fields */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { label: 'Full Name', value: 'John Doe', placeholder: 'Enter your full name' },
          { label: 'Email', value: 'john@example.com', placeholder: 'Enter your email' },
          { label: 'Bio', value: 'Product Manager & Designer', placeholder: 'Tell us about yourself' },
        ].map((field, index) => (
          <motion.div
            key={index}
            animate={{
              borderColor: step === index ? theme.palette.primary.main : theme.palette.divider,
              backgroundColor: step === index ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
            }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                p: 2,
                border: `2px solid ${step === index ? theme.palette.primary.main : theme.palette.divider}`,
                borderRadius: 2,
                backgroundColor: step === index ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
              }}
            >
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block', fontWeight: 500 }}>
                {field.label}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.primary, flex: 1 }}>
                  {step === index ? field.value : field.placeholder}
                </Typography>
                {step === index && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{
                      display: 'inline-block',
                      width: 2,
                      height: 16,
                      backgroundColor: theme.palette.text.primary,
                      marginLeft: 8,
                    }}
                  />
                )}
              </Box>
            </Card>
          </motion.div>
        ))}
        
        <motion.div
          animate={{
            backgroundColor: step === 3 ? theme.palette.primary.main : theme.palette.background.paper,
          }}
          style={{ marginTop: 'auto' }}
        >
          <Button
            fullWidth
            variant="contained"
            sx={{
              backgroundColor: step === 3 ? theme.palette.primary.main : theme.palette.background.paper,
              color: step === 3 ? theme.palette.background.default : theme.palette.text.primary,
              border: `2px solid ${step === 3 ? theme.palette.primary.main : theme.palette.divider}`,
              fontWeight: 600,
              py: 1.5,
            }}
          >
            Save Profile
          </Button>
        </motion.div>
      </Box>
    </Box>
  );
};

// Step 2: Admin Dashboard - Full width with sidebar nav, roles panel, and users panel
const MockAdminDashboard = ({ theme }: { theme: any }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [highlightedRole, setHighlightedRole] = useState<number | null>(null);
  const [highlightedUser, setHighlightedUser] = useState<number | null>(null);
  
  useEffect(() => {
    const sequence = [
      { delay: 0, action: () => setActiveTab(0) },
      { delay: 2000, action: () => { setActiveTab(1); setHighlightedRole(0); } },
      { delay: 3500, action: () => setHighlightedRole(1) },
      { delay: 5000, action: () => { setActiveTab(2); setHighlightedUser(0); } },
      { delay: 6500, action: () => setHighlightedUser(1) },
      { delay: 8000, action: () => { setActiveTab(0); setHighlightedRole(null); setHighlightedUser(null); } },
    ];
    
    let timeoutIds: NodeJS.Timeout[] = [];
    sequence.forEach(({ delay, action }) => {
      timeoutIds.push(setTimeout(action, delay));
    });
    return () => timeoutIds.forEach(clearTimeout);
  }, []);
  
  return (
    <Box sx={{ width: '100%', display: 'flex', gap: 2, minHeight: '400px' }}>
      {/* Left Sidebar - Navigation */}
      <Card
        sx={{
          flex: '0 0 200px',
          p: 2,
          backgroundColor: theme.palette.background.paper,
          border: `2px solid ${theme.palette.divider}`,
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {[
          { id: 0, label: 'Dashboard', icon: <DashboardIcon /> },
          { id: 1, label: 'Roles', icon: <SettingsIcon /> },
          { id: 2, label: 'Users', icon: <PersonIcon /> },
        ].map((item) => (
          <motion.div
            key={item.id}
            animate={{
              backgroundColor: activeTab === item.id ? alpha(theme.palette.primary.main, 0.2) : theme.palette.action.hover,
              borderColor: activeTab === item.id ? theme.palette.primary.main : theme.palette.divider,
            }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                p: 1.5,
                border: `2px solid ${activeTab === item.id ? theme.palette.primary.main : theme.palette.divider}`,
                borderRadius: 2,
                cursor: 'pointer',
                backgroundColor: activeTab === item.id ? alpha(theme.palette.primary.main, 0.2) : theme.palette.action.hover,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {item.icon}
                <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: activeTab === item.id ? 600 : 400 }}>
                  {item.label}
                </Typography>
              </Box>
            </Card>
          </motion.div>
        ))}
      </Card>

      {/* Middle Panel - Roles */}
      <AnimatePresence mode="wait">
        {activeTab === 1 && (
          <motion.div
            key="roles"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{ flex: 1 }}
          >
            <Card
              sx={{
                p: 3,
                height: '100%',
                backgroundColor: theme.palette.background.paper,
                border: `2px solid ${theme.palette.divider}`,
                borderRadius: 3,
              }}
            >
              <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 3, fontWeight: 600 }}>
                Custom Roles
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {['Project Manager', 'Developer', 'Designer'].map((role, idx) => (
                  <motion.div
                    key={idx}
                    animate={{
                      borderColor: highlightedRole === idx ? theme.palette.primary.main : theme.palette.divider,
                      backgroundColor: highlightedRole === idx ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      sx={{
                        p: 2,
                        border: `2px solid ${highlightedRole === idx ? theme.palette.primary.main : theme.palette.divider}`,
                        borderRadius: 2,
                        backgroundColor: highlightedRole === idx ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                          {role}
                        </Typography>
                        {highlightedRole === idx && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            <CheckCircleIcon sx={{ color: theme.palette.primary.main }} />
                          </motion.div>
                        )}
                      </Box>
                    </Card>
                  </motion.div>
                ))}
              </Box>
            </Card>
          </motion.div>
        )}

        {/* Right Panel - Users */}
        {activeTab === 2 && (
          <motion.div
            key="users"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{ flex: 1 }}
          >
            <Card
              sx={{
                p: 3,
                height: '100%',
                backgroundColor: theme.palette.background.paper,
                border: `2px solid ${theme.palette.divider}`,
                borderRadius: 3,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                  Users
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.background.default,
                  }}
                >
                  Add User
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {['john@example.com', 'jane@example.com', 'bob@example.com'].map((email, idx) => (
                  <motion.div
                    key={idx}
                    animate={{
                      borderColor: highlightedUser === idx ? theme.palette.primary.main : theme.palette.divider,
                      backgroundColor: highlightedUser === idx ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      sx={{
                        p: 2,
                        border: `2px solid ${highlightedUser === idx ? theme.palette.primary.main : theme.palette.divider}`,
                        borderRadius: 2,
                        backgroundColor: highlightedUser === idx ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <AccountCircleIcon sx={{ fontSize: 32, color: theme.palette.text.secondary }} />
                        <Typography variant="body2" sx={{ color: theme.palette.text.primary, flex: 1 }}>
                          {email}
                        </Typography>
                        <Chip label="Active" size="small" sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.2) }} />
                      </Box>
                    </Card>
                  </motion.div>
                ))}
              </Box>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

// Step 3: Companies, Contacts, Opportunities - Full width with tabs and panels side by side
const MockCompaniesOps = ({ theme }: { theme: any }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [highlightedCompany, setHighlightedCompany] = useState<number | null>(null);
  const [highlightedContact, setHighlightedContact] = useState<number | null>(null);
  const [highlightedOpp, setHighlightedOpp] = useState<number | null>(null);
  
  useEffect(() => {
    const sequence = [
      { delay: 0, action: () => { setActiveTab(0); setHighlightedCompany(0); } },
      { delay: 2000, action: () => setHighlightedCompany(1) },
      { delay: 3500, action: () => { setActiveTab(1); setHighlightedContact(0); } },
      { delay: 5000, action: () => setHighlightedContact(1) },
      { delay: 6500, action: () => { setActiveTab(2); setHighlightedOpp(0); } },
      { delay: 8000, action: () => { setActiveTab(0); setHighlightedCompany(null); setHighlightedContact(null); setHighlightedOpp(null); } },
    ];
    
    let timeoutIds: NodeJS.Timeout[] = [];
    sequence.forEach(({ delay, action }) => {
      timeoutIds.push(setTimeout(action, delay));
    });
    return () => timeoutIds.forEach(clearTimeout);
  }, []);
  
  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, minHeight: '400px' }}>
      {/* Tabs Navigation */}
      <Box sx={{ display: 'flex', gap: 1, borderBottom: `2px solid ${theme.palette.divider}` }}>
        {['Companies', 'Contacts', 'Opportunities'].map((tab, idx) => (
          <motion.div
            key={tab}
            animate={{
              borderBottomColor: activeTab === idx ? theme.palette.primary.main : 'transparent',
              color: activeTab === idx ? theme.palette.primary.main : theme.palette.text.secondary,
            }}
            transition={{ duration: 0.3 }}
          >
            <Typography
              variant="body1"
              sx={{
                px: 3,
                py: 1.5,
                fontWeight: activeTab === idx ? 600 : 400,
                borderBottom: `3px solid ${activeTab === idx ? theme.palette.primary.main : 'transparent'}`,
                cursor: 'pointer',
              }}
            >
              {tab}
            </Typography>
          </motion.div>
        ))}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.background.default,
          }}
        >
          Add New
        </Button>
      </Box>

      {/* Content Panels */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
        {/* Companies Panel */}
        {activeTab === 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ flex: 1 }}
          >
            <Card
              sx={{
                p: 3,
                height: '100%',
                backgroundColor: theme.palette.background.paper,
                border: `2px solid ${theme.palette.divider}`,
                borderRadius: 3,
              }}
            >
              <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 3, fontWeight: 600 }}>
                Companies
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {['Acme Corporation', 'TechStart Inc', 'Global Solutions'].map((company, idx) => (
                  <motion.div
                    key={idx}
                    animate={{
                      borderColor: highlightedCompany === idx ? theme.palette.primary.main : theme.palette.divider,
                      backgroundColor: highlightedCompany === idx ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      sx={{
                        p: 2,
                        border: `2px solid ${highlightedCompany === idx ? theme.palette.primary.main : theme.palette.divider}`,
                        borderRadius: 2,
                        backgroundColor: highlightedCompany === idx ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <BusinessIcon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                            {company}
                          </Typography>
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            Technology • San Francisco, CA
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  </motion.div>
                ))}
              </Box>
            </Card>
          </motion.div>
        )}

        {/* Contacts Panel */}
        {activeTab === 1 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ flex: 1 }}
          >
            <Card
              sx={{
                p: 3,
                height: '100%',
                backgroundColor: theme.palette.background.paper,
                border: `2px solid ${theme.palette.divider}`,
                borderRadius: 3,
              }}
            >
              <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 3, fontWeight: 600 }}>
                Company Contacts
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {['John Doe', 'Jane Smith', 'Bob Johnson'].map((name, idx) => (
                  <motion.div
                    key={idx}
                    animate={{
                      borderColor: highlightedContact === idx ? theme.palette.primary.main : theme.palette.divider,
                      backgroundColor: highlightedContact === idx ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      sx={{
                        p: 2,
                        border: `2px solid ${highlightedContact === idx ? theme.palette.primary.main : theme.palette.divider}`,
                        borderRadius: 2,
                        backgroundColor: highlightedContact === idx ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ContactsIcon sx={{ fontSize: 24, color: theme.palette.primary.main }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                            {name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            {name.toLowerCase().replace(' ', '.')}@acme.com
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  </motion.div>
                ))}
              </Box>
            </Card>
          </motion.div>
        )}

        {/* Opportunities Panel */}
        {activeTab === 2 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ flex: 1 }}
          >
            <Card
              sx={{
                p: 3,
                height: '100%',
                backgroundColor: theme.palette.background.paper,
                border: `2px solid ${theme.palette.divider}`,
                borderRadius: 3,
              }}
            >
              <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 3, fontWeight: 600 }}>
                Opportunities
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { name: 'Product Launch Partnership', value: '$50,000', prob: '75%' },
                  { name: 'Enterprise Contract', value: '$150,000', prob: '60%' },
                  { name: 'Consulting Project', value: '$25,000', prob: '90%' },
                ].map((opp, idx) => (
                  <motion.div
                    key={idx}
                    animate={{
                      borderColor: highlightedOpp === idx ? theme.palette.primary.main : theme.palette.divider,
                      backgroundColor: highlightedOpp === idx ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      sx={{
                        p: 2,
                        border: `2px solid ${highlightedOpp === idx ? theme.palette.primary.main : theme.palette.divider}`,
                        borderRadius: 2,
                        backgroundColor: highlightedOpp === idx ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                            {opp.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            {opp.value} • {opp.prob} Probability
                          </Typography>
                        </Box>
                        <TrendingUpIcon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
                      </Box>
                    </Card>
                  </motion.div>
                ))}
              </Box>
            </Card>
          </motion.div>
        )}
      </Box>
    </Box>
  );
};

// Step 4: Generate Template from PRD - Full width with PRD input, AI processing, and template preview side by side
const MockTemplateGeneration = ({ theme }: { theme: any }) => {
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const sequence = [
      { delay: 0, action: () => setStep(0) },
      { delay: 2000, action: () => setStep(1) },
      { delay: 4000, action: () => { setStep(2); setGenerating(true); } },
      { delay: 6000, action: () => { setStep(3); setGenerating(false); } },
      { delay: 8000, action: () => { setStep(0); setProgress(0); } },
    ];
    
    let timeoutIds: NodeJS.Timeout[] = [];
    sequence.forEach(({ delay, action }) => {
      timeoutIds.push(setTimeout(action, delay));
    });
    return () => timeoutIds.forEach(clearTimeout);
  }, []);
  
  useEffect(() => {
    if (generating) {
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 100));
      }, 200);
      return () => clearInterval(interval);
    }
  }, [generating]);
  
  const prdText = 'Build a mobile app for task management with user authentication, project creation, and real-time collaboration features.';
  
  useEffect(() => {
    if (step === 1) {
      let charIndex = 0;
      const typeInterval = setInterval(() => {
        if (charIndex < prdText.length) {
          setTyping(prdText.substring(0, charIndex + 1));
          charIndex++;
        } else {
          clearInterval(typeInterval);
        }
      }, 50);
      return () => clearInterval(typeInterval);
    } else {
      setTyping('');
    }
  }, [step, prdText]);
  
  return (
    <Box sx={{ width: '100%', display: 'flex', gap: 2, minHeight: '400px' }}>
      {/* Left Panel - PRD Input */}
      <Card
        sx={{
          flex: 1,
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `2px solid ${step >= 1 ? theme.palette.primary.main : theme.palette.divider}`,
          borderRadius: 3,
        }}
      >
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ArticleIcon sx={{ fontSize: 20 }} />
          PRD Input
        </Typography>
        <Box
          sx={{
            minHeight: 200,
            borderRadius: 2,
            border: `2px solid ${step === 1 ? theme.palette.primary.main : theme.palette.divider}`,
            p: 2,
            backgroundColor: step === 1 ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
          }}
        >
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, whiteSpace: 'pre-wrap' }}>
            {typing || 'Paste your PRD here...'}
            {step === 1 && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 16,
                  backgroundColor: theme.palette.text.primary,
                  marginLeft: 4,
                }}
              />
            )}
          </Typography>
        </Box>
        {step >= 2 && (
          <Button
            fullWidth
            variant="contained"
            startIcon={generating ? <AutoAwesomeIcon /> : <BuildIcon />}
            disabled={generating}
            sx={{
              mt: 2,
              backgroundColor: step === 2 ? theme.palette.primary.main : theme.palette.background.paper,
              color: step === 2 ? theme.palette.background.default : theme.palette.text.primary,
              border: `2px solid ${step === 2 ? theme.palette.primary.main : theme.palette.divider}`,
              fontWeight: 600,
            }}
          >
            {generating ? `Generating... ${progress}%` : 'Generate Template'}
          </Button>
        )}
        {generating && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              mt: 2,
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                backgroundColor: theme.palette.primary.main,
                borderRadius: 3,
              },
            }}
          />
        )}
      </Card>

      {/* Right Panel - Template Preview */}
      <Card
        sx={{
          flex: 1,
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `2px solid ${step === 3 ? theme.palette.primary.main : theme.palette.divider}`,
          borderRadius: 3,
        }}
      >
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600 }}>
          Generated Template
        </Typography>
        {step === 3 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card sx={{ p: 2, backgroundColor: alpha(theme.palette.primary.main, 0.1), border: `1px solid ${theme.palette.primary.main}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CheckCircleIcon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
                <Box>
                  <Typography variant="body1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                    Task Management App Template
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    6 phases • 24 fields configured
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6'].map((phase, idx) => (
                  <Chip
                    key={idx}
                    label={phase}
                    size="small"
                    sx={{
                      backgroundColor: alpha(theme.palette.primary.main, 0.2),
                      color: theme.palette.text.primary,
                      border: `1px solid ${theme.palette.primary.main}`,
                    }}
                  />
                ))}
              </Box>
            </Card>
          </motion.div>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: theme.palette.text.secondary }}>
            <Typography variant="body2">Template will appear here after generation</Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
};

// Step 5: Create First Project - Full width with form and template selector side by side
const MockCreateProject = ({ theme }: { theme: any }) => {
  const [focused, setFocused] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFocused((f) => (f + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Box sx={{ width: '100%', display: 'flex', gap: 2, minHeight: '400px' }}>
      {/* Left Panel - Project Form */}
      <Card
        sx={{
          flex: 1,
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `2px solid ${theme.palette.divider}`,
          borderRadius: 3,
        }}
      >
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 3, fontWeight: 600 }}>
          New Project
        </Typography>
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block', fontWeight: 500 }}>
            Project Name
          </Typography>
          <motion.div
            animate={{
              borderColor: focused === 0 ? theme.palette.primary.main : theme.palette.divider,
              backgroundColor: focused === 0 ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
            }}
            transition={{ duration: 0.3 }}
          >
            <Box
              sx={{
                height: 45,
                borderRadius: 2,
                border: `2px solid ${focused === 0 ? theme.palette.primary.main : theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                px: 2,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                My First Project
              </Typography>
              {focused === 0 && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{
                    display: 'inline-block',
                    width: 2,
                    height: 16,
                    backgroundColor: theme.palette.text.primary,
                    marginLeft: 8,
                  }}
                />
              )}
            </Box>
          </motion.div>
        </Box>
        <motion.div
          animate={{
            backgroundColor: focused === 2 ? theme.palette.primary.main : theme.palette.background.paper,
          }}
        >
          <Button
            fullWidth
            variant="contained"
            sx={{
              mt: 2,
              backgroundColor: focused === 2 ? theme.palette.primary.main : theme.palette.background.paper,
              color: focused === 2 ? theme.palette.background.default : theme.palette.text.primary,
              border: `2px solid ${focused === 2 ? theme.palette.primary.main : theme.palette.divider}`,
              fontWeight: 600,
              py: 1.5,
            }}
          >
            Create Project
          </Button>
        </motion.div>
      </Card>

      {/* Right Panel - Template Selector */}
      <Card
        sx={{
          flex: 1,
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `2px solid ${focused === 1 ? theme.palette.primary.main : theme.palette.divider}`,
          borderRadius: 3,
        }}
      >
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 3, fontWeight: 600 }}>
          Select Template
        </Typography>
        <motion.div
          animate={{
            borderColor: focused === 1 ? theme.palette.primary.main : theme.palette.divider,
            backgroundColor: focused === 1 ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
          }}
          transition={{ duration: 0.3 }}
        >
          <Card
            sx={{
              p: 2,
              border: `2px solid ${focused === 1 ? theme.palette.primary.main : theme.palette.divider}`,
              borderRadius: 2,
              backgroundColor: focused === 1 ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <BuildIcon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                  Task Management App Template
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  6 phases • 24 fields
                </Typography>
              </Box>
              {focused === 1 && (
                <CheckCircleIcon sx={{ fontSize: 24, color: theme.palette.primary.main }} />
              )}
            </Box>
          </Card>
        </motion.div>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {['E-commerce', 'SaaS Platform', 'Mobile App'].map((template, idx) => (
            <Chip
              key={idx}
              label={template}
              size="small"
              sx={{
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.secondary,
                border: `1px solid ${theme.palette.divider}`,
              }}
            />
          ))}
        </Box>
      </Card>
    </Box>
  );
};

// Step 6: Initiate Project Management - Full width with phases list and active phase detail side by side
const MockProjectManagement = ({ theme }: { theme: any }) => {
  const [activePhase, setActivePhase] = useState(0);
  const [progressValues, setProgressValues] = useState([0, 0, 0, 0, 0, 0]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((p) => {
        const next = (p + 1) % 6;
        setProgressValues((prev) => {
          const newValues = [...prev];
          if (next < prev.length) {
            newValues[next] = Math.min(prev[next] + 20, 100);
          }
          return newValues;
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  const phases = [
    { name: 'Concept Framing', icon: <RocketLaunchIcon sx={{ fontSize: 16 }} />, desc: 'Define the problem and value proposition' },
    { name: 'Product Strategy', icon: <AutoAwesomeIcon sx={{ fontSize: 16 }} />, desc: 'Personas, outcomes, and features' },
    { name: 'Rapid Prototype', icon: <BuildIcon sx={{ fontSize: 16 }} />, desc: 'Screens, flows, components' },
    { name: 'Analysis', icon: <DescriptionIcon sx={{ fontSize: 16 }} />, desc: 'Entities, APIs, acceptance criteria' },
    { name: 'Build Accelerator', icon: <CodeIcon sx={{ fontSize: 16 }} />, desc: 'Architecture and coding standards' },
    { name: 'QA & Hardening', icon: <CheckCircleIcon sx={{ fontSize: 16 }} />, desc: 'Testing and launch readiness' },
  ];
  
  return (
    <Box sx={{ width: '100%', display: 'flex', gap: 2, minHeight: '400px' }}>
      {/* Left Panel - Phases List */}
      <Card
        sx={{
          flex: '0 0 300px',
          p: 2,
          backgroundColor: theme.palette.background.paper,
          border: `2px solid ${theme.palette.divider}`,
          borderRadius: 3,
          overflowY: 'auto',
        }}
      >
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600 }}>
          Project Phases
        </Typography>
        {phases.map((phase, index) => (
          <motion.div
            key={index}
            animate={{ 
              opacity: index === activePhase ? 1 : 0.6,
              scale: index === activePhase ? 1.02 : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                mb: 1.5,
                backgroundColor: index === activePhase 
                  ? alpha(theme.palette.primary.main, 0.1)
                  : theme.palette.action.hover,
                border: `2px solid ${
                  index === activePhase 
                    ? theme.palette.primary.main 
                    : theme.palette.divider
                }`,
                borderRadius: 2,
                p: 1.5,
                cursor: 'pointer',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {phase.icon}
                <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: index === activePhase ? 600 : 400, flex: 1 }}>
                  {phase.name}
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                  {progressValues[index]}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progressValues[index]}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: index === activePhase 
                      ? theme.palette.primary.main
                      : theme.palette.text.primary,
                    borderRadius: 2,
                  },
                }}
              />
            </Card>
          </motion.div>
        ))}
      </Card>

      {/* Right Panel - Active Phase Detail */}
      <Card
        sx={{
          flex: 1,
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `2px solid ${theme.palette.primary.main}`,
          borderRadius: 3,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activePhase}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              {phases[activePhase].icon}
              <Typography variant="h5" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                {phases[activePhase].name}
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              {phases[activePhase].desc}
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block' }}>
                Progress
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progressValues[activePhase]}
                sx={{
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: theme.palette.primary.main,
                    borderRadius: 6,
                  },
                }}
              />
              <Typography variant="h4" sx={{ color: theme.palette.primary.main, mt: 1, fontWeight: 700 }}>
                {progressValues[activePhase]}%
              </Typography>
            </Box>
            <Button
              variant="contained"
              fullWidth
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.background.default,
                fontWeight: 600,
                py: 1.5,
              }}
            >
              Continue Phase
            </Button>
          </motion.div>
        </AnimatePresence>
      </Card>
    </Box>
  );
};

// Step 7: Knowledge Base & AI Tool - Full width with search, articles list, and AI response side by side
const MockKnowledgeBase = ({ theme }: { theme: any }) => {
  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  
  useEffect(() => {
    const sequence = [
      { delay: 0, action: () => { setStep(0); setSearchQuery(''); } },
      { delay: 2000, action: () => { setStep(1); setSearchQuery('project management'); } },
      { delay: 4000, action: () => { setStep(2); setAiThinking(true); } },
      { delay: 6000, action: () => { setStep(3); setAiThinking(false); } },
      { delay: 8000, action: () => { setStep(0); setSearchQuery(''); } },
    ];
    
    let timeoutIds: NodeJS.Timeout[] = [];
    sequence.forEach(({ delay, action }) => {
      timeoutIds.push(setTimeout(action, delay));
    });
    return () => timeoutIds.forEach(clearTimeout);
  }, []);
  
  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, minHeight: '400px' }}>
      {/* Search Bar */}
      <motion.div
        animate={{
          borderColor: step >= 1 ? theme.palette.primary.main : theme.palette.divider,
          backgroundColor: step >= 1 ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
        }}
      >
        <Box
          sx={{
            height: 50,
            borderRadius: 2,
            border: `2px solid ${step >= 1 ? theme.palette.primary.main : theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            px: 2,
            backgroundColor: step >= 1 ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 20, color: theme.palette.primary.main, mr: 1 }} />
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, flex: 1 }}>
            {searchQuery || 'Search knowledge base or ask AI...'}
          </Typography>
          {step >= 1 && (
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{
                display: 'inline-block',
                width: 2,
                height: 16,
                backgroundColor: theme.palette.text.primary,
                marginLeft: 8,
              }}
            />
          )}
        </Box>
      </motion.div>

      {/* Content Panels */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
        {/* Left Panel - Articles List */}
        <Card
          sx={{
            flex: '0 0 300px',
            p: 2,
            backgroundColor: theme.palette.background.paper,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600 }}>
            Knowledge Base
          </Typography>
          {step >= 1 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {['Project Management Basics', 'AI Tools Guide', 'Best Practices', 'Getting Started'].map((article, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card
                    sx={{
                      p: 1.5,
                      backgroundColor: theme.palette.action.hover,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DescriptionIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                      <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                        {article}
                      </Typography>
                    </Box>
                  </Card>
                </motion.div>
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: theme.palette.text.secondary }}>
              <Typography variant="body2">Search to find articles</Typography>
            </Box>
          )}
        </Card>

        {/* Right Panel - AI Response */}
        <Card
          sx={{
            flex: 1,
            p: 3,
            backgroundColor: theme.palette.background.paper,
            border: `2px solid ${step >= 2 ? theme.palette.primary.main : theme.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToyIcon sx={{ fontSize: 24, color: theme.palette.primary.main }} />
            AI Assistant
          </Typography>
          {step >= 2 ? (
            <AnimatePresence mode="wait">
              {aiThinking ? (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center', minHeight: 200 }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <SmartToyIcon sx={{ fontSize: 48, color: theme.palette.primary.main }} />
                    </motion.div>
                    <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
                      AI is thinking...
                    </Typography>
                  </Box>
                </motion.div>
              ) : (
                <motion.div
                  key="response"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card sx={{ p: 3, backgroundColor: alpha(theme.palette.primary.main, 0.05), border: `1px solid ${theme.palette.primary.main}` }}>
                    <Typography variant="body1" sx={{ color: theme.palette.text.primary, mb: 2 }}>
                      Based on your knowledge base, here are the best practices for project management:
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      {[
                        'Define clear project objectives',
                        'Break down work into manageable phases',
                        'Use AI tools to accelerate development',
                        'Maintain regular team communication',
                      ].map((tip, idx) => (
                        <Typography key={idx} variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                          • {tip}
                        </Typography>
                      ))}
                    </Box>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: theme.palette.text.secondary }}>
              <Typography variant="body2">Ask a question to get AI assistance</Typography>
            </Box>
          )}
        </Card>
      </Box>
    </Box>
  );
};

// Legacy components (keeping for reference but not used)
const MockDashboard = ({ theme }: { theme: any }) => {
  const [highlighted, setHighlighted] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlighted((prev) => (prev + 1) % 4);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    { label: 'Projects', count: '12', icon: <FolderIcon /> },
    { label: 'Templates', count: '5', icon: <BuildIcon /> },
  ];

  const projects = [
    { name: 'My First Project', status: 'In Progress', progress: 65 },
    { name: 'Product Launch', status: 'Planning', progress: 30 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        {/* Animated background gradient */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '100%',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 100%)`,
            pointerEvents: 'none',
          }}
        />
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3, position: 'relative', zIndex: 1 }}>
          {cards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: highlighted === index ? 1.05 : 1,
                boxShadow: highlighted === index 
                  ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`
                  : 'none',
              }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.5,
                repeat: highlighted === index ? Infinity : 0,
                repeatType: 'reverse',
              }}
            >
              <Card
                sx={{
                  flex: 1,
                  backgroundColor: highlighted === index 
                    ? alpha(theme.palette.primary.main, 0.1)
                    : theme.palette.action.hover,
                  border: `2px solid ${
                    highlighted === index 
                      ? theme.palette.primary.main 
                      : theme.palette.divider
                  }`,
                  borderRadius: 2,
                  p: 2,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {card.icon}
                  <Typography variant="caption" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                    {card.label}
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 700 }}>
                  {card.count}
                </Typography>
              </Card>
            </motion.div>
          ))}
        </Box>
        
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          {projects.map((project, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                borderColor: highlighted === index + 2 
                  ? theme.palette.primary.main 
                  : theme.palette.divider,
              }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
            >
              <Card
                sx={{
                  mb: 2,
                  backgroundColor: theme.palette.action.hover,
                  border: `2px solid ${
                    highlighted === index + 2 
                      ? theme.palette.primary.main 
                      : theme.palette.divider
                  }`,
                  borderRadius: 2,
                  p: 2,
                  transition: 'all 0.3s ease',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                    {project.name}
                  </Typography>
                  <Chip 
                    label={project.status} 
                    size="small" 
                    sx={{ 
                      backgroundColor: alpha(theme.palette.primary.main, 0.2),
                      color: theme.palette.text.primary,
                      fontSize: '0.7rem',
                    }} 
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={project.progress}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: theme.palette.primary.main,
                      borderRadius: 3,
                    },
                  }}
                />
              </Card>
            </motion.div>
          ))}
        </Box>
      </Box>
    </motion.div>
  );
};

const MockTemplateBuilder = ({ theme }: { theme: any }) => {
  const fields = ['Project Name', 'Description', 'Category'];
  const [typing, setTyping] = useState('');
  const [fieldIndex, setFieldIndex] = useState(0);
  const [activePhase, setActivePhase] = useState(0);
  
  useEffect(() => {
    let charIndex = 0;
    let currentField = fields[0];
    
    const typeInterval = setInterval(() => {
      if (charIndex < currentField.length) {
        setTyping(currentField.substring(0, charIndex + 1));
        charIndex++;
      } else {
        setTimeout(() => {
          setFieldIndex((i) => {
            const nextIndex = (i + 1) % fields.length;
            currentField = fields[nextIndex];
            charIndex = 0;
            setTyping('');
            return nextIndex;
          });
        }, 1000);
      }
    }, 100);
    
    return () => clearInterval(typeInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((p) => (p + 1) % 6);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const phases = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6'];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 1.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BuildIcon sx={{ fontSize: 18 }} />
            Template Builder
          </Typography>
          <motion.div
            key={fieldIndex}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Box
              sx={{
                height: 40,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                borderRadius: 2,
                border: `2px solid ${theme.palette.primary.main}`,
                display: 'flex',
                alignItems: 'center',
                px: 2,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontFamily: 'monospace' }}>
                {typing || fields[fieldIndex]}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{
                    display: 'inline-block',
                    width: 2,
                    height: 16,
                    backgroundColor: theme.palette.text.primary,
                    marginLeft: 4,
                  }}
                />
              </Typography>
            </Box>
          </motion.div>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {phases.map((phase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                backgroundColor: activePhase === index 
                  ? alpha(theme.palette.primary.main, 0.2)
                  : theme.palette.action.hover,
                borderColor: activePhase === index 
                  ? theme.palette.primary.main 
                  : theme.palette.divider,
              }}
              transition={{ 
                delay: index * 0.05,
                duration: 0.3,
              }}
            >
              <Chip 
                label={phase} 
                size="small" 
                sx={{ 
                  backgroundColor: activePhase === index 
                    ? alpha(theme.palette.primary.main, 0.2)
                    : theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  border: `2px solid ${
                    activePhase === index 
                      ? theme.palette.primary.main 
                      : theme.palette.divider
                  }`,
                  fontWeight: activePhase === index ? 600 : 400,
                  transition: 'all 0.3s ease',
                }} 
              />
            </motion.div>
          ))}
        </Box>
      </Box>
    </motion.div>
  );
};

const MockProjectForm = ({ theme }: { theme: any }) => {
  const [focused, setFocused] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFocused((f) => (f + 1) % 3);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block', fontWeight: 500 }}>
            Project Name
          </Typography>
          <motion.div
            animate={{
              borderColor: focused === 0 ? theme.palette.primary.main : theme.palette.divider,
              backgroundColor: focused === 0 
                ? alpha(theme.palette.primary.main, 0.1)
                : theme.palette.action.hover,
            }}
            transition={{ duration: 0.3 }}
          >
            <Box
              sx={{
                height: 40,
                borderRadius: 2,
                border: `2px solid ${focused === 0 ? theme.palette.primary.main : theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                px: 2,
                transition: 'all 0.3s ease',
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                My New Project
              </Typography>
            </Box>
          </motion.div>
        </Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block', fontWeight: 500 }}>
            Template
          </Typography>
          <motion.div
            animate={{
              borderColor: focused === 1 ? theme.palette.primary.main : theme.palette.divider,
              backgroundColor: focused === 1 
                ? alpha(theme.palette.primary.main, 0.1)
                : theme.palette.action.hover,
            }}
            transition={{ duration: 0.3 }}
          >
            <Box
              sx={{
                height: 40,
                borderRadius: 2,
                border: `2px solid ${focused === 1 ? theme.palette.primary.main : theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                px: 2,
                justifyContent: 'space-between',
                transition: 'all 0.3s ease',
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                Select Template...
              </Typography>
              <PlayArrowIcon sx={{ fontSize: 18, color: theme.palette.text.primary }} />
            </Box>
          </motion.div>
        </Box>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          animate={{
            backgroundColor: focused === 2 
              ? theme.palette.primary.main
              : theme.palette.background.paper,
            color: focused === 2 
              ? theme.palette.background.default
              : theme.palette.text.primary,
          }}
          transition={{ duration: 0.3 }}
        >
          <Button
            size="medium"
            variant="contained"
            fullWidth
            sx={{
              backgroundColor: focused === 2 
                ? theme.palette.primary.main
                : theme.palette.background.paper,
              color: focused === 2 
                ? theme.palette.background.default
                : theme.palette.text.primary,
              border: `2px solid ${focused === 2 ? theme.palette.primary.main : theme.palette.divider}`,
              fontWeight: 600,
              py: 1.5,
              transition: 'all 0.3s ease',
              '&:hover': { 
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.background.default,
                borderColor: theme.palette.primary.main,
              },
            }}
          >
            Create Project
          </Button>
        </motion.div>
      </Box>
    </motion.div>
  );
};

const MockProjectDashboard = ({ theme }: { theme: any }) => {
  const [activePhase, setActivePhase] = useState(0);
  const [progressValues, setProgressValues] = useState([100, 80, 60, 40, 20, 0]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((p) => {
        const next = (p + 1) % 6;
        // Animate progress when phase becomes active
        setProgressValues((prev) => {
          const newValues = [...prev];
          if (next < prev.length) {
            newValues[next] = Math.min(prev[next] + 5, 100);
          }
          return newValues;
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const phases = [
    { name: 'Concept Framing', icon: <RocketLaunchIcon sx={{ fontSize: 16 }} /> },
    { name: 'Product Strategy', icon: <AutoAwesomeIcon sx={{ fontSize: 16 }} /> },
    { name: 'Rapid Prototype', icon: <BuildIcon sx={{ fontSize: 16 }} /> },
    { name: 'Analysis', icon: <DescriptionIcon sx={{ fontSize: 16 }} /> },
    { name: 'Build Accelerator', icon: <CodeIcon sx={{ fontSize: 16 }} /> },
    { name: 'QA & Hardening', icon: <CheckCircleIcon sx={{ fontSize: 16 }} /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <DashboardIcon sx={{ fontSize: 20 }} />
          Project Phases
        </Typography>
        {phases.map((phase, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ 
              opacity: index === activePhase ? 1 : 0.5,
              x: 0,
              scale: index === activePhase ? 1.02 : 1,
            }}
            transition={{ 
              delay: index * 0.1,
              duration: 0.4,
            }}
          >
            <Card
              sx={{
                mb: 2,
                backgroundColor: index === activePhase 
                  ? alpha(theme.palette.primary.main, 0.1)
                  : theme.palette.action.hover,
                border: `2px solid ${
                  index === activePhase 
                    ? theme.palette.primary.main 
                    : theme.palette.divider
                }`,
                borderRadius: 2,
                p: 2,
                transition: 'all 0.3s ease',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {phase.icon}
                  <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: index === activePhase ? 600 : 400 }}>
                    {phase.name}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                  {progressValues[index]}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progressValues[index]}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: index === activePhase 
                      ? theme.palette.primary.main
                      : theme.palette.text.primary,
                    borderRadius: 4,
                  },
                }}
              />
            </Card>
          </motion.div>
        ))}
      </Box>
    </motion.div>
  );
};

const MockExportDialog = ({ theme }: { theme: any }) => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setExporting((e) => !e);
      if (!exporting) {
        setProgress(0);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [exporting]);

  useEffect(() => {
    if (exporting) {
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 100));
      }, 200);
      return () => clearInterval(progressInterval);
    }
  }, [exporting]);

  const files = [
    { name: 'phase-1.json', icon: <DescriptionIcon /> },
    { name: 'phase-2.json', icon: <DescriptionIcon /> },
    { name: 'cursor-prompt.md', icon: <CodeIcon /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <DownloadIcon sx={{ fontSize: 20 }} />
          Export Blueprint Bundle
        </Typography>
        <Box sx={{ mb: 3 }}>
          <motion.div
            animate={{
              backgroundColor: exporting 
                ? alpha(theme.palette.primary.main, 0.1)
                : theme.palette.action.hover,
              borderColor: exporting 
                ? theme.palette.primary.main 
                : theme.palette.divider,
            }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                p: 2,
                border: `2px solid ${exporting ? theme.palette.primary.main : theme.palette.divider}`,
                borderRadius: 2,
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FolderIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />
                <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 500, flex: 1 }}>
                  blueprint-bundle.zip
                </Typography>
                {exporting && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.primary.main,
                      }}
                    />
                  </motion.div>
                )}
              </Box>
              {exporting && (
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    mt: 2,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: theme.palette.primary.main,
                      borderRadius: 3,
                    },
                  }}
                />
              )}
            </Card>
          </motion.div>
          <Box sx={{ pl: 1 }}>
            {files.map((file, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                  <Box sx={{ color: theme.palette.text.secondary }}>
                    {file.icon}
                  </Box>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    {file.name}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </Box>
        </Box>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            size="medium"
            variant="contained"
            fullWidth
            startIcon={<DownloadIcon />}
            sx={{
              backgroundColor: exporting 
                ? theme.palette.primary.main
                : theme.palette.background.paper,
              color: exporting 
                ? theme.palette.background.default
                : theme.palette.text.primary,
              border: `2px solid ${exporting ? theme.palette.primary.main : theme.palette.divider}`,
              fontWeight: 600,
              py: 1.5,
              transition: 'all 0.3s ease',
              '&:hover': { 
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.background.default,
                borderColor: theme.palette.primary.main,
              },
            }}
          >
            {exporting ? `Exporting... ${progress}%` : 'Download Bundle'}
          </Button>
        </motion.div>
      </Box>
    </motion.div>
  );
};

const MockKeyboard = ({ theme }: { theme: any }) => {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [activeShortcut, setActiveShortcut] = useState(0);
  
  useEffect(() => {
    const shortcuts = [
      { keys: ['Ctrl', 'S'], action: 'Save phase data' },
      { keys: ['Ctrl', 'K'], action: 'Show shortcuts' },
      { keys: ['Esc'], action: 'Close dialogs' },
    ];
    let keyIndex = 0;
    const interval = setInterval(() => {
      const shortcut = shortcuts[activeShortcut];
      setPressedKey(shortcut.keys[keyIndex]);
      setTimeout(() => setPressedKey(null), 200);
      keyIndex = (keyIndex + 1) % shortcut.keys.length;
      if (keyIndex === 0) {
        setTimeout(() => {
          setActiveShortcut((s) => (s + 1) % shortcuts.length);
        }, 1000);
      }
    }, 600);
    return () => clearInterval(interval);
  }, [activeShortcut]);

  const shortcuts = [
    { keys: ['Ctrl', 'S'], action: 'Save phase data' },
    { keys: ['Ctrl', 'K'], action: 'Show shortcuts' },
    { keys: ['Esc'], action: 'Close dialogs' },
  ];

  const currentShortcut = shortcuts[activeShortcut];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <KeyboardIcon sx={{ fontSize: 20 }} />
          Keyboard Shortcuts
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mb: 2 }}>
          {currentShortcut.keys.map((key, index) => (
            <motion.div
              key={`${activeShortcut}-${index}`}
              animate={{
                scale: pressedKey === key ? 0.9 : 1,
                backgroundColor: pressedKey === key 
                  ? theme.palette.primary.main
                  : theme.palette.action.hover,
                color: pressedKey === key 
                  ? theme.palette.background.default
                  : theme.palette.text.primary,
              }}
              transition={{ duration: 0.1 }}
            >
              <Box
                sx={{
                  px: 2.5,
                  py: 1.5,
                  borderRadius: 2,
                  border: `2px solid ${
                    pressedKey === key 
                      ? theme.palette.primary.main
                      : theme.palette.divider
                  }`,
                  minWidth: 60,
                  textAlign: 'center',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                  {key}
                </Typography>
              </Box>
            </motion.div>
          ))}
        </Box>
        <motion.div
          key={activeShortcut}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, textAlign: 'center', fontWeight: 500 }}>
            {currentShortcut.action}
          </Typography>
        </motion.div>
      </Box>
    </motion.div>
  );
};

const getTourSteps = (theme: any): TourStep[] => [
  {
    title: 'Complete Your Profile',
    description: 'Set up your account',
    icon: <PersonIcon />,
    mockComponent: <MockProfileSetup theme={theme} />,
    content: <Box />, // Empty - no text content
  },
  {
    title: 'Admin Dashboard Setup',
    description: 'Create roles and add users',
    icon: <AdminPanelSettingsIcon />,
    mockComponent: <MockAdminDashboard theme={theme} />,
    content: <Box />, // Empty - no text content
  },
  {
    title: 'Manage Companies & Opportunities',
    description: 'Build your pipeline',
    icon: <BusinessIcon />,
    mockComponent: <MockCompaniesOps theme={theme} />,
    content: <Box />, // Empty - no text content
  },
  {
    title: 'Generate Template from PRD',
    description: 'AI-powered template creation',
    icon: <ArticleIcon />,
    mockComponent: <MockTemplateGeneration theme={theme} />,
    content: <Box />, // Empty - no text content
  },
  {
    title: 'Create Your First Project',
    description: 'Start your journey',
    icon: <PlayArrowIcon />,
    mockComponent: <MockCreateProject theme={theme} />,
    content: <Box />, // Empty - no text content
  },
  {
    title: 'Initiate Project Management',
    description: 'Work through phases',
    icon: <SettingsIcon />,
    mockComponent: <MockProjectManagement theme={theme} />,
    content: <Box />, // Empty - no text content
  },
  {
    title: 'Knowledge Base & AI Assistant',
    description: 'Learn and get help',
    icon: <SchoolIcon />,
    mockComponent: <MockKnowledgeBase theme={theme} />,
    content: <Box />, // Empty - no text content
  },
];

export default function WelcomeTour({ open, onClose, onComplete }: WelcomeTourProps) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const TOUR_STEPS = getTourSteps(theme);

  const handleNext = () => {
    if (activeStep === TOUR_STEPS.length - 1) {
      handleComplete();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleComplete = () => {
    onComplete();
    setActiveStep(0);
  };

  const handleSkip = () => {
    onComplete();
    setActiveStep(0);
  };

  return (
    <Dialog
      open={open}
      onClose={handleSkip}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.default,
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 3,
        },
      }}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.palette.background.paper,
          borderBottom: `2px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
          fontWeight: 600,
          fontFamily: 'var(--font-rubik), Rubik, sans-serif',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RocketLaunchIcon />
          Welcome Tour
        </Box>
        <IconButton
          onClick={handleSkip}
          size="small"
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {TOUR_STEPS.map((step, index) => (
            <Step key={index}>
              <StepLabel
                StepIconComponent={() => (
                  <motion.div
                    animate={{
                      scale: index === activeStep ? [1, 1.1, 1] : 1,
                      backgroundColor:
                        index === activeStep
                          ? theme.palette.text.primary
                          : index < activeStep
                          ? theme.palette.text.primary
                          : theme.palette.action.hover,
                    }}
                    transition={{
                      scale: { duration: 0.3 },
                      backgroundColor: { duration: 0.3 },
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor:
                          index === activeStep
                            ? theme.palette.text.primary
                            : index < activeStep
                            ? theme.palette.text.primary
                            : theme.palette.action.hover,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: index <= activeStep ? theme.palette.background.default : theme.palette.text.secondary,
                        fontWeight: 600,
                        border: index === activeStep ? `2px solid ${theme.palette.text.primary}` : `1px solid ${theme.palette.divider}`,
                        boxShadow: index === activeStep 
                          ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`
                          : 'none',
                      }}
                    >
                      {index < activeStep ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          <CheckCircleIcon fontSize="small" />
                        </motion.div>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {step.icon}
                        </Box>
                      )}
                    </Box>
                  </motion.div>
                )}
                sx={{
                  '& .MuiStepLabel-label': {
                    color: index === activeStep ? theme.palette.text.primary : index < activeStep ? theme.palette.text.primary : theme.palette.text.secondary,
                    fontWeight: index === activeStep ? 600 : 400,
                  },
                }}
              >
                {step.title}
              </StepLabel>
              <StepContent>
                <AnimatePresence mode="wait">
                  {index === activeStep && (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Paper
                        sx={{
                          p: 3,
                          backgroundColor: theme.palette.background.paper,
                          border: `2px solid ${theme.palette.divider}`,
                          borderRadius: 3,
                          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
                        }}
                      >
                        {step.mockComponent ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                          >
                            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              {step.mockComponent}
                            </Box>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                          >
                            {step.content}
                          </motion.div>
                        )}
                      </Paper>
                    </motion.div>
                  )}
                </AnimatePresence>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: `2px solid ${theme.palette.divider}` }}>
        <Button
          onClick={handleSkip}
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
            },
          }}
        >
          Skip Tour
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
          sx={{
            borderColor: theme.palette.divider,
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              borderColor: theme.palette.text.primary,
            },
            '&.Mui-disabled': {
              color: theme.palette.text.secondary,
              borderColor: theme.palette.divider,
            },
          }}
          variant="outlined"
        >
          Back
        </Button>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={handleNext}
            variant="contained"
            sx={{
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              fontWeight: 600,
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                borderColor: theme.palette.text.primary,
              },
            }}
          >
            {activeStep === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'}
          </Button>
        </motion.div>
      </DialogActions>
    </Dialog>
  );
}

