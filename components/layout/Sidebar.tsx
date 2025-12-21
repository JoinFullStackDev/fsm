'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  IconButton,
  Typography,
  Divider,
  Collapse,
  Tooltip,
  useMediaQuery,
  Popover,
  Paper,
  MenuList,
  MenuItem,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Description as DescriptionIcon,
  Article as ArticleIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  Contacts as ContactsIcon,
  TrendingUp as TrendingUpIcon,
  DashboardCustomize as DashboardCustomizeIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  Groups as GroupsIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';
import { useRole } from '@/lib/hooks/useRole';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import { useThemeMode } from '@/components/providers/ThemeContextProvider';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { Project } from '@/types/project';

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 64;

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

interface Template {
  id: string;
  name: string;
}

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const { mode: themeMode } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { role } = useRole();
  const { organization, features } = useOrganization();
  const supabase = createSupabaseClient();
  
  // Determine which logo/icon to use based on theme mode
  const isLightMode = themeMode === 'light';
  const logoToUse = isLightMode 
    ? (organization?.logo_light_url || organization?.logo_url) 
    : organization?.logo_url;
  const iconToUse = isLightMode 
    ? (organization?.icon_light_url || organization?.icon_url) 
    : organization?.icon_url;
  const defaultLogo = isLightMode ? '/fullstack_logo_black.svg' : '/fullstack_logo.svg';
  const defaultIcon = isLightMode ? '/fullstack_icon_black.svg' : '/fullstack_icon.svg';
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projectManagementProjects, setProjectManagementProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectTaskProgress, setProjectTaskProgress] = useState<Record<string, { completed: number; total: number }>>({});
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [templatesExpanded, setTemplatesExpanded] = useState(false);
  const [projectManagementExpanded, setProjectManagementExpanded] = useState(false);
  const [projectsPopoverAnchor, setProjectsPopoverAnchor] = useState<HTMLElement | null>(null);
  const [templatesPopoverAnchor, setTemplatesPopoverAnchor] = useState<HTMLElement | null>(null);
  const [projectManagementPopoverAnchor, setProjectManagementPopoverAnchor] = useState<HTMLElement | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinDirection, setSpinDirection] = useState<'forward' | 'reverse'>('forward');
  const prevOpenRef = useRef(open);

  // Handle spin animation when sidebar state changes
  useEffect(() => {
    if (prevOpenRef.current !== open) {
      // Only animate when closing
      if (!open) {
        // Closing: icon spins freely and slows to a stop
        setSpinDirection('reverse');
        setIsSpinning(true);
        // Animation will naturally slow to stop via CSS timing function
      } else {
        // Opening: no animation
        setIsSpinning(false);
      }
      prevOpenRef.current = open;
    }
  }, [open]);

  // Load all projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        // Use API route to avoid RLS recursion issues
        // Add cache-busting to ensure fresh data
        const response = await fetch(`/api/projects?limit=1000&t=${Date.now()}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          setLoading(false);
          return;
        }

        const data = await response.json();
        // API returns { data: [...] } not { projects: [...] }
        const projectsList = data.data || data.projects || [];
        
        setProjects(projectsList as Project[]);
      } catch (error) {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
    
    // Refresh projects every 30 seconds to catch new projects
    const interval = setInterval(loadProjects, 30000);
    return () => clearInterval(interval);
  }, [supabase]);

  // Load task progress for each project
  useEffect(() => {
    const loadProjectTaskProgress = async () => {
      if (projects.length === 0) return;

      const progressMap: Record<string, { completed: number; total: number }> = {};

      for (const project of projects) {
        try {
          const { data: tasks } = await supabase
            .from('project_tasks')
            .select('id, status')
            .eq('project_id', project.id);

          if (tasks && tasks.length > 0) {
            const total = tasks.length;
            const completed = tasks.filter((t: { status: string }) => t.status === 'done').length;
            progressMap[project.id] = { completed, total };
          } else {
            progressMap[project.id] = { completed: 0, total: 0 };
          }
        } catch (error) {
          console.error(`Error loading tasks for project ${project.id}:`, error);
          progressMap[project.id] = { completed: 0, total: 0 };
        }
      }

      setProjectTaskProgress(progressMap);
    };

    loadProjectTaskProgress();
  }, [projects, supabase]);

  // Load templates lazily - only when sidebar is opened or after initial page load
  // This reduces unnecessary API calls on page load
  // All roles can now view and create templates
  useEffect(() => {
    // Delay loading templates to allow page to load first (lazy load)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/templates?limit=100', {
          cache: 'default', // Use browser cache
        });
        if (response.ok) {
          const data = await response.json();
          const templatesList = (data.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }));
          setTemplates(templatesList);
        }
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    }, open ? 500 : 2000); // Load faster if sidebar is already open

    return () => clearTimeout(timer);
  }, [open]);

  // Load projects for project management (same as regular projects)
  useEffect(() => {
    // Reuse the same projects list for project management
    setProjectManagementProjects(projects);
  }, [projects]);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    if (path === '/projects') {
      return pathname === '/projects';
    }
    if (path === '/project-management') {
      return pathname?.startsWith('/project-management');
    }
    if (path === '/templates') {
      return pathname === '/templates';
    }
    if (path === '/teams') {
      return pathname?.startsWith('/teams');
    }
    if (path === '/ops/companies') {
      return pathname?.startsWith('/ops/companies');
    }
    if (path === '/ops/opportunities') {
      return pathname === '/ops/opportunities';
    }
    if (path === '/ops/contacts') {
      return pathname === '/ops/contacts';
    }
    if (path === '/dashboards') {
      return pathname?.startsWith('/dashboards');
    }
    if (path === '/workflows') {
      return pathname?.startsWith('/workflows');
    }
    return pathname === path;
  };

  const isProjectActive = (projectId: string) => {
    return pathname?.startsWith(`/project/${projectId}`) && 
           !pathname?.includes('/phase/') && 
           !pathname?.includes('/settings') && 
           !pathname?.includes('/members') && 
           !pathname?.includes('/exports');
  };

  const isTemplateActive = (templateId: string) => {
    return pathname?.includes(`/templates/${templateId}/`);
  };

  const isProjectManagementActive = (projectId: string) => {
    return pathname === `/project-management/${projectId}` || pathname?.startsWith(`/project-management/${projectId}/`);
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? open : true}
      onClose={isMobile ? onToggle : undefined}
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
      sx={{
        width: isMobile ? DRAWER_WIDTH : (open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED),
        flexShrink: 0,
        zIndex: (theme) => isMobile ? theme.zIndex.modal : theme.zIndex.drawer,
        '& .MuiDrawer-paper': {
          width: isMobile ? DRAWER_WIDTH : (open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED),
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          borderRight: `1px solid ${theme.palette.divider}`,
          transition: isMobile ? 'transform 0.3s ease' : 'width 0.3s ease',
          overflowX: 'hidden',
          pt: '64px', // Account for TopBar height
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Logo/Icon Section */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          padding: { xs: '12px 16px', md: '8px 16px' },
          minHeight: { xs: 56, md: 48 },
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: open ? 'auto' : '100%',
            height: 40,
            minHeight: 40,
          }}
        >
          {open ? (
            logoToUse ? (
              <Box
                component="img"
                src={logoToUse}
                alt="Company Logo"
                sx={{
                  height: 40,
                  width: 'auto',
                  maxWidth: 140,
                  objectFit: 'contain',
                  display: 'block',
                }}
                onError={() => {
                  setLogoError(true);
                }}
              />
            ) : logoError ? (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.text.primary,
                }}
              >
                FSM
              </Typography>
            ) : (
              <Box
                component="img"
                src={defaultLogo}
                alt="FullStack Logo"
                sx={{
                  height: 40,
                  width: 'auto',
                  maxWidth: 140,
                  objectFit: 'contain',
                  display: 'block',
                }}
                onError={() => {
                  setLogoError(true);
                }}
              />
            )
          ) : (
            iconToUse ? (
              <Box
                component="img"
                src={iconToUse}
                alt="Company Icon"
                sx={{
                  height: 32,
                  width: 32,
                  objectFit: 'contain',
                  display: 'block',
                  transformOrigin: 'center center',
                  animation: isSpinning && spinDirection === 'reverse' 
                    ? 'spinFree 2s cubic-bezier(0.4, 0, 0.2, 1)' 
                    : 'none',
                  '@keyframes spinFree': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(-1080deg)' }, // 3 full rotations
                  },
                }}
                onError={() => {
                  setIconError(true);
                }}
              />
            ) : iconError ? (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: 'primary.main',
                  fontSize: '24px',
                }}
              >
                F
              </Typography>
            ) : (
              <Box
                component="img"
                src={defaultIcon}
                alt="FullStack Icon"
                sx={{
                  height: 32,
                  width: 32,
                  objectFit: 'contain',
                  display: 'block',
                  transformOrigin: 'center center',
                  animation: isSpinning && spinDirection === 'reverse' 
                    ? 'spinFree 2s cubic-bezier(0.4, 0, 0.2, 1)' 
                    : 'none',
                  '@keyframes spinFree': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(-1080deg)' }, // 3 full rotations
                  },
                }}
                onError={() => {
                  setIconError(true);
                }}
              />
            )
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <List sx={{ pt: { xs: 0.5, md: 0.5 } }}>
        {/* Dashboard */}
        <ListItem disablePadding>
          <Tooltip
            title="Dashboard"
            placement="right"
            arrow
            disableHoverListener={open}
            disableFocusListener={open}
            disableTouchListener={open}
          >
            <ListItemButton
              onClick={() => handleNavigate('/dashboard')}
              selected={isActive('/dashboard')}
              sx={{
                minHeight: 48,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.action.hover,
                  borderLeft: `1px solid ${theme.palette.text.primary}`,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                },
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  justifyContent: 'center',
                  color: isActive('/dashboard') ? theme.palette.text.primary : theme.palette.text.secondary,
                }}
              >
                <DashboardIcon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              {open && <ListItemText primary="Dashboard" primaryTypographyProps={{ fontSize: '0.75rem' }} />}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        {/* Projects */}
        <ListItem disablePadding>
          <Box sx={{ width: '100%' }}>
            <Tooltip
              title="Projects"
              placement="right"
              arrow
              disableHoverListener={open}
              disableFocusListener={open}
              disableTouchListener={open}
            >
              <ListItemButton
                onClick={(e) => {
                  if (!open && projects.length > 0) {
                    // When collapsed, show popover instead of navigating
                    setProjectsPopoverAnchor(e.currentTarget);
                  } else {
                    handleNavigate('/projects');
                  }
                }}
                selected={isActive('/projects')}
                sx={{
                  minHeight: 48,
                  pr: open && projects.length > 0 ? 0.5 : 2,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.action.hover,
                    borderLeft: `1px solid ${theme.palette.text.primary}`,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: open ? 40 : 40,
                    justifyContent: 'center',
                    color: isActive('/projects') ? theme.palette.text.primary : theme.palette.text.secondary,
                  }}
                >
                  <FolderIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                {open && <ListItemText primary="Projects" primaryTypographyProps={{ fontSize: '0.75rem' }} />}
                {open && projects.length > 0 && (
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectsExpanded(!projectsExpanded);
                    }}
                    size="small"
                    aria-label={projectsExpanded ? 'Collapse projects submenu' : 'Expand projects submenu'}
                    sx={{
                      ml: 'auto',
                      p: 0.5,
                      color: theme.palette.text.secondary,
                      '&:hover': {
                        backgroundColor: 'transparent',
                        color: theme.palette.text.primary,
                      },
                    }}
                  >
                    <Tooltip title={projectsExpanded ? 'Collapse projects' : 'Expand projects'} placement="right" arrow>
                      {projectsExpanded ? (
                        <ExpandMoreIcon sx={{ fontSize: 20 }} />
                      ) : (
                        <ChevronRightIcon sx={{ fontSize: 20 }} />
                      )}
                    </Tooltip>
                  </IconButton>
                )}
              </ListItemButton>
            </Tooltip>
            {open && projects.length > 0 && (
              <Collapse in={projectsExpanded} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {projects.map((project) => {
                    const progress = projectTaskProgress[project.id] || { completed: 0, total: 6 };
                    return (
                      <Tooltip
                        key={project.id}
                        title={`${project.name} - ${progress.completed}/${progress.total} tasks complete`}
                        placement="right"
                        arrow
                      >
                        <ListItemButton
                          onClick={() => {
                            handleNavigate(`/project/${project.id}`);
                          }}
                          selected={isProjectActive(project.id)}
                          sx={{
                            pl: 4,
                            minHeight: 40,
                            '&.Mui-selected': {
                              backgroundColor: theme.palette.action.hover,
                              '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                              },
                            },
                            '&:hover': {
                              backgroundColor: theme.palette.action.hover,
                            },
                          }}
                        >
                          <ListItemText
                            primary={project.name}
                            primaryTypographyProps={{
                              fontSize: '0.75rem',
                            }}
                          />
                          {progress.total > 0 && (
                            <Chip
                              label={`${progress.completed}/${progress.total}`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                minWidth: 40,
                                backgroundColor: progress.completed === progress.total 
                                  ? theme.palette.success.main 
                                  : theme.palette.action.hover,
                                color: progress.completed === progress.total 
                                  ? theme.palette.background.paper 
                                  : theme.palette.text.primary,
                                fontWeight: 600,
                                ml: 1,
                              }}
                            />
                          )}
                        </ListItemButton>
                      </Tooltip>
                    );
                  })}
                </List>
              </Collapse>
            )}
          </Box>
        </ListItem>

        {/* Project Management */}
        <ListItem disablePadding>
          <Box sx={{ width: '100%' }}>
            <Tooltip
              title="Task Management"
              placement="right"
              arrow
              disableHoverListener={open}
              disableFocusListener={open}
              disableTouchListener={open}
            >
              <ListItemButton
                onClick={(e) => {
                  if (!open && projectManagementProjects.length > 0) {
                    // When collapsed, show popover instead of navigating
                    setProjectManagementPopoverAnchor(e.currentTarget);
                  } else {
                    handleNavigate('/project-management');
                  }
                }}
                selected={isActive('/project-management')}
                sx={{
                  minHeight: 48,
                  pr: open && projectManagementProjects.length > 0 ? 0.5 : 2,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.action.hover,
                    borderLeft: `1px solid ${theme.palette.text.primary}`,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: open ? 40 : 40,
                    justifyContent: 'center',
                    color: isActive('/project-management') ? theme.palette.text.primary : theme.palette.text.secondary,
                  }}
                >
                  <AssignmentIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                {open && <ListItemText primary="Task Management" primaryTypographyProps={{ fontSize: '0.75rem' }} />}
                {open && projectManagementProjects.length > 0 && (
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectManagementExpanded(!projectManagementExpanded);
                    }}
                    size="small"
                    aria-label={projectManagementExpanded ? 'Collapse task management submenu' : 'Expand task management submenu'}
                    sx={{
                      ml: 'auto',
                      p: 0.5,
                      color: theme.palette.text.secondary,
                      '&:hover': {
                        backgroundColor: 'transparent',
                        color: theme.palette.text.primary,
                      },
                    }}
                  >
                    <Tooltip title={projectManagementExpanded ? 'Collapse task management' : 'Expand task management'} placement="right" arrow>
                      {projectManagementExpanded ? (
                        <ExpandMoreIcon sx={{ fontSize: 20 }} />
                      ) : (
                        <ChevronRightIcon sx={{ fontSize: 20 }} />
                      )}
                    </Tooltip>
                  </IconButton>
                )}
              </ListItemButton>
            </Tooltip>
            {open && projectManagementProjects.length > 0 && (
              <Collapse in={projectManagementExpanded} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {projectManagementProjects.map((project) => {
                    const progress = projectTaskProgress[project.id] || { completed: 0, total: 6 };
                    return (
                      <Tooltip
                        key={project.id}
                        title={`${project.name} - ${progress.completed}/${progress.total} tasks complete`}
                        placement="right"
                        arrow
                      >
                        <ListItemButton
                          onClick={() => {
                            handleNavigate(`/project-management/${project.id}`);
                          }}
                          selected={isProjectManagementActive(project.id)}
                          sx={{
                            pl: 4,
                            minHeight: 40,
                            '&.Mui-selected': {
                              backgroundColor: theme.palette.action.hover,
                              '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                              },
                            },
                            '&:hover': {
                              backgroundColor: theme.palette.action.hover,
                            },
                          }}
                        >
                          <ListItemText
                            primary={project.name}
                            primaryTypographyProps={{
                              fontSize: '0.75rem',
                            }}
                          />
                          {progress.total > 0 && (
                            <Chip
                              label={`${progress.completed}/${progress.total}`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                minWidth: 40,
                                backgroundColor: progress.completed === progress.total 
                                  ? theme.palette.success.main 
                                  : theme.palette.action.hover,
                                color: progress.completed === progress.total 
                                  ? theme.palette.background.paper 
                                  : theme.palette.text.primary,
                                fontWeight: 600,
                                ml: 1,
                              }}
                            />
                          )}
                        </ListItemButton>
                      </Tooltip>
                    );
                  })}
                </List>
              </Collapse>
            )}
          </Box>
        </ListItem>

        {/* Templates (All roles can view and create templates) */}
        <ListItem disablePadding>
            <Box sx={{ width: '100%' }}>
              <Tooltip
                title="Templates"
                placement="right"
                arrow
                disableHoverListener={open}
                disableFocusListener={open}
                disableTouchListener={open}
              >
                <ListItemButton
                  onClick={(e) => {
                    if (!open && templates.length > 0) {
                      // When collapsed, show popover instead of navigating
                      setTemplatesPopoverAnchor(e.currentTarget);
                    } else {
                      handleNavigate('/templates');
                    }
                  }}
                  selected={isActive('/templates')}
                  sx={{
                    minHeight: 48,
                    pr: open && templates.length > 0 ? 0.5 : 2,
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.hover,
                      borderLeft: `1px solid ${theme.palette.text.primary}`,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: open ? 40 : 40,
                      justifyContent: 'center',
                      color: isActive('/templates') ? theme.palette.text.primary : theme.palette.text.secondary,
                    }}
                  >
                    <DescriptionIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  {open && <ListItemText primary="Templates" primaryTypographyProps={{ fontSize: '0.75rem' }} />}
                  {open && templates.length > 0 && (
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        setTemplatesExpanded(!templatesExpanded);
                      }}
                      size="small"
                      aria-label={templatesExpanded ? 'Collapse templates submenu' : 'Expand templates submenu'}
                      sx={{
                        ml: 'auto',
                        p: 0.5,
                        color: theme.palette.text.secondary,
                        '&:hover': {
                          backgroundColor: 'transparent',
                          color: theme.palette.text.primary,
                        },
                      }}
                    >
                      <Tooltip title={templatesExpanded ? 'Collapse templates' : 'Expand templates'} placement="right" arrow>
                        {templatesExpanded ? (
                          <ExpandMoreIcon sx={{ fontSize: 20 }} />
                        ) : (
                          <ChevronRightIcon sx={{ fontSize: 20 }} />
                        )}
                      </Tooltip>
                    </IconButton>
                  )}
                </ListItemButton>
              </Tooltip>
              {open && templates.length > 0 && (
                <Collapse in={templatesExpanded} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {templates.map((template) => (
                      <ListItemButton
                        key={template.id}
                        onClick={() => {
                          handleNavigate(`/templates/${template.id}/builder`);
                        }}
                        selected={isTemplateActive(template.id)}
                        sx={{
                          pl: 4,
                          minHeight: 40,
                          '&.Mui-selected': {
                            backgroundColor: theme.palette.action.hover,
                            '&:hover': {
                              backgroundColor: theme.palette.action.hover,
                            },
                          },
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                      >
                        <ListItemText
                          primary={template.name}
                          primaryTypographyProps={{
                            fontSize: '0.75rem',
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              )}
            </Box>
          </ListItem>

        {/* Custom Dashboards Section - Only show if custom_dashboards_enabled is true */}
        {features?.custom_dashboards_enabled === true && (
          <>
            <Divider sx={{ my: 1, borderColor: theme.palette.divider }} />
            {open && (
              <Box sx={{ px: 2, py: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  Dashboards
                </Typography>
              </Box>
            )}
            <ListItem disablePadding>
              <Tooltip
                title="Dashboards"
                placement="right"
                arrow
                disableHoverListener={open}
                disableFocusListener={open}
                disableTouchListener={open}
              >
                <ListItemButton
                  onClick={() => handleNavigate('/dashboards')}
                  selected={isActive('/dashboards')}
                  sx={{
                    minHeight: 48,
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.hover,
                      borderLeft: `1px solid ${theme.palette.text.primary}`,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      justifyContent: 'center',
                      color: isActive('/dashboards') ? theme.palette.text.primary : theme.palette.text.secondary,
                    }}
                  >
                    <DashboardCustomizeIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  {open && <ListItemText primary="Dashboards" primaryTypographyProps={{ fontSize: '0.75rem' }} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          </>
        )}

        {/* Workflows Section - Only show if workflows_enabled is true */}
        {features?.workflows_enabled === true && (
          <>
            <Divider sx={{ my: 1, borderColor: theme.palette.divider }} />
            {open && (
              <Box sx={{ px: 2, py: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  Automation
                </Typography>
              </Box>
            )}
            <ListItem disablePadding>
              <Tooltip
                title="Workflows"
                placement="right"
                arrow
                disableHoverListener={open}
                disableFocusListener={open}
                disableTouchListener={open}
              >
                <ListItemButton
                  onClick={() => handleNavigate('/workflows')}
                  selected={isActive('/workflows')}
                  sx={{
                    minHeight: 48,
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.hover,
                      borderLeft: `1px solid ${theme.palette.text.primary}`,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      justifyContent: 'center',
                      color: isActive('/workflows') ? theme.palette.text.primary : theme.palette.text.secondary,
                    }}
                  >
                    <AccountTreeIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  {open && <ListItemText primary="Workflows" primaryTypographyProps={{ fontSize: '0.75rem' }} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          </>
        )}

        {/* Ops Tool Section - Only show if ops_tool_enabled is true */}
        {features?.ops_tool_enabled === true && (
          <>
            <Divider sx={{ my: 1, borderColor: theme.palette.divider }} />
            {open && (
              <Box sx={{ px: 2, py: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  Ops Tool
                </Typography>
              </Box>
            )}

            {/* Companies */}
            <ListItem disablePadding>
              <Tooltip
                title="Companies"
                placement="right"
                arrow
                disableHoverListener={open}
                disableFocusListener={open}
                disableTouchListener={open}
              >
                <ListItemButton
                  onClick={() => handleNavigate('/ops/companies')}
                  selected={isActive('/ops/companies')}
                  sx={{
                    minHeight: 48,
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.hover,
                      borderLeft: `1px solid ${theme.palette.text.primary}`,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      justifyContent: 'center',
                      color: isActive('/ops/companies') ? theme.palette.text.primary : theme.palette.text.secondary,
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  {open && <ListItemText primary="Companies" primaryTypographyProps={{ fontSize: '0.75rem' }} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>

            {/* Opportunities */}
            <ListItem disablePadding>
              <Tooltip
                title="Opportunities"
                placement="right"
                arrow
                disableHoverListener={open}
                disableFocusListener={open}
                disableTouchListener={open}
              >
                <ListItemButton
                  onClick={() => handleNavigate('/ops/opportunities')}
                  selected={isActive('/ops/opportunities')}
                  sx={{
                    minHeight: 48,
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.hover,
                      borderLeft: `1px solid ${theme.palette.text.primary}`,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      justifyContent: 'center',
                      color: isActive('/ops/opportunities') ? theme.palette.text.primary : theme.palette.text.secondary,
                    }}
                  >
                    <TrendingUpIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  {open && <ListItemText primary="Opportunities" primaryTypographyProps={{ fontSize: '0.75rem' }} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>

            {/* Contacts */}
            <ListItem disablePadding>
              <Tooltip
                title="Contacts"
                placement="right"
                arrow
                disableHoverListener={open}
                disableFocusListener={open}
                disableTouchListener={open}
              >
                <ListItemButton
                  onClick={() => handleNavigate('/ops/contacts')}
                  selected={isActive('/ops/contacts')}
                  sx={{
                    minHeight: 48,
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.hover,
                      borderLeft: `1px solid ${theme.palette.text.primary}`,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      justifyContent: 'center',
                      color: isActive('/ops/contacts') ? theme.palette.text.primary : theme.palette.text.secondary,
                    }}
                  >
                    <ContactsIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  {open && <ListItemText primary="Contacts" primaryTypographyProps={{ fontSize: '0.75rem' }} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          </>
        )}
      </List>
      </Box>

      {/* Projects Popover - Shows when sidebar is collapsed */}
      <Popover
        open={Boolean(projectsPopoverAnchor)}
        anchorEl={projectsPopoverAnchor}
        onClose={() => {
          setProjectsPopoverAnchor(null);
        }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        disableRestoreFocus
      >
        <Paper
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            minWidth: 200,
            maxHeight: 400,
            overflow: 'auto',
          }}
        >
          <MenuList dense>
            <MenuItem
              onClick={() => {
                handleNavigate('/projects');
                setProjectsPopoverAnchor(null);
              }}
              sx={{
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemText primary="View All Projects" primaryTypographyProps={{ fontSize: '0.75rem' }} />
            </MenuItem>
            {projects.length > 0 && (
              <>
                <Divider sx={{ borderColor: theme.palette.divider }} />
                {projects.map((project) => {
                  const progress = projectTaskProgress[project.id] || { completed: 0, total: 6 };
                  return (
                    <Tooltip
                      key={project.id}
                      title={`${project.name} - ${progress.completed}/${progress.total} tasks complete`}
                      placement="right"
                      arrow
                    >
                      <MenuItem
                        onClick={() => {
                          handleNavigate(`/project/${project.id}`);
                          setProjectsPopoverAnchor(null);
                        }}
                        selected={isProjectActive(project.id)}
                        sx={{
                          color: isProjectActive(project.id) ? theme.palette.text.primary : theme.palette.text.secondary,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                          '&.Mui-selected': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                      >
                        <ListItemText
                          primary={project.name}
                          primaryTypographyProps={{
                            fontSize: '0.75rem',
                          }}
                        />
                        {progress.total > 0 && (
                          <Chip
                            label={`${progress.completed}/${progress.total}`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              minWidth: 40,
                              backgroundColor: progress.completed === progress.total 
                                ? theme.palette.success.main 
                                : theme.palette.action.hover,
                              color: progress.completed === progress.total 
                                ? theme.palette.background.paper 
                                : theme.palette.text.primary,
                              fontWeight: 600,
                              ml: 1,
                            }}
                          />
                        )}
                      </MenuItem>
                    </Tooltip>
                  );
                })}
              </>
            )}
          </MenuList>
        </Paper>
      </Popover>

      {/* Templates Popover - Shows when sidebar is collapsed */}
      <Popover
        open={Boolean(templatesPopoverAnchor)}
        anchorEl={templatesPopoverAnchor}
        onClose={() => {
          setTemplatesPopoverAnchor(null);
        }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        disableRestoreFocus
      >
        <Paper
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            minWidth: 200,
            maxHeight: 400,
            overflow: 'auto',
          }}
        >
          <MenuList dense>
            <MenuItem
              onClick={() => {
                handleNavigate('/templates');
                setTemplatesPopoverAnchor(null);
              }}
              sx={{
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemText primary="View All Templates" primaryTypographyProps={{ fontSize: '0.75rem' }} />
            </MenuItem>
            {templates.length > 0 && (
              <>
                <Divider sx={{ borderColor: theme.palette.divider }} />
                {templates.map((template) => (
                  <MenuItem
                    key={template.id}
                    onClick={() => {
                      handleNavigate(`/templates/${template.id}/builder`);
                      setTemplatesPopoverAnchor(null);
                    }}
                    selected={isTemplateActive(template.id)}
                    sx={{
                      color: isTemplateActive(template.id) ? theme.palette.text.primary : theme.palette.text.secondary,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                      '&.Mui-selected': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    <ListItemText
                      primary={template.name}
                      primaryTypographyProps={{
                        fontSize: '0.75rem',
                      }}
                    />
                  </MenuItem>
                ))}
              </>
            )}
          </MenuList>
        </Paper>
      </Popover>

      {/* Project Management Popover - Shows when sidebar is collapsed */}
      <Popover
        open={Boolean(projectManagementPopoverAnchor)}
        anchorEl={projectManagementPopoverAnchor}
        onClose={() => {
          setProjectManagementPopoverAnchor(null);
        }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        disableRestoreFocus
      >
        <Paper
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            minWidth: 200,
            maxHeight: 400,
            overflow: 'auto',
          }}
        >
          <MenuList dense>
            <MenuItem
              onClick={() => {
                handleNavigate('/project-management');
                setProjectManagementPopoverAnchor(null);
              }}
              sx={{
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemText primary="View All Projects" primaryTypographyProps={{ fontSize: '0.75rem' }} />
            </MenuItem>
            {projectManagementProjects.length > 0 && (
              <>
                <Divider sx={{ borderColor: theme.palette.divider }} />
                {projectManagementProjects.map((project) => {
                  const progress = projectTaskProgress[project.id] || { completed: 0, total: 6 };
                  return (
                    <Tooltip
                      key={project.id}
                      title={`${project.name} - ${progress.completed}/${progress.total} tasks complete`}
                      placement="right"
                      arrow
                    >
                      <MenuItem
                        onClick={() => {
                          handleNavigate(`/project-management/${project.id}`);
                          setProjectManagementPopoverAnchor(null);
                        }}
                        selected={isProjectManagementActive(project.id)}
                        sx={{
                          color: isProjectManagementActive(project.id) ? theme.palette.text.primary : theme.palette.text.secondary,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                          '&.Mui-selected': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                      >
                        <ListItemText
                          primary={project.name}
                          primaryTypographyProps={{
                            fontSize: '0.75rem',
                          }}
                        />
                        {progress.total > 0 && (
                          <Chip
                            label={`${progress.completed}/${progress.total}`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              minWidth: 40,
                              backgroundColor: progress.completed === progress.total 
                                ? theme.palette.success.main 
                                : theme.palette.action.hover,
                              color: progress.completed === progress.total 
                                ? theme.palette.background.paper 
                                : theme.palette.text.primary,
                              fontWeight: 600,
                              ml: 1,
                            }}
                          />
                        )}
                      </MenuItem>
                    </Tooltip>
                  );
                })}
              </>
            )}
          </MenuList>
        </Paper>
      </Popover>

      {/* Bottom Navigation Items */}
      <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}>
        <List>
          {/* Teams */}
          <ListItem disablePadding>
            <Tooltip
              title="Teams"
              placement="right"
              arrow
              disableHoverListener={open}
              disableFocusListener={open}
              disableTouchListener={open}
            >
              <ListItemButton
                onClick={() => handleNavigate('/teams')}
                selected={isActive('/teams')}
                sx={{
                  minHeight: 48,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.action.hover,
                    borderLeft: `1px solid ${theme.palette.text.primary}`,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: open ? 40 : 40,
                    justifyContent: 'center',
                    color: isActive('/teams') ? theme.palette.text.primary : theme.palette.text.secondary,
                  }}
                >
                  <GroupsIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                {open && <ListItemText primary="Teams" primaryTypographyProps={{ fontSize: '0.75rem' }} />}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        </List>
      </Box>
      </Box>
    </Drawer>
  );
}

