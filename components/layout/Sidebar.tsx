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
  Popover,
  Paper,
  MenuList,
  MenuItem,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Description as DescriptionIcon,
  Article as ArticleIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon,
  Contacts as ContactsIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useRole } from '@/lib/hooks/useRole';
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
  const { role } = useRole();
  const supabase = createSupabaseClient();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projectManagementProjects, setProjectManagementProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTasksCount, setMyTasksCount] = useState(0);
  const [projectsPopoverAnchor, setProjectsPopoverAnchor] = useState<HTMLElement | null>(null);
  const [templatesPopoverAnchor, setTemplatesPopoverAnchor] = useState<HTMLElement | null>(null);
  const [projectManagementPopoverAnchor, setProjectManagementPopoverAnchor] = useState<HTMLElement | null>(null);
  const projectsPopoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const templatesPopoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const projectManagementPopoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', session.user.id)
          .single();

        if (!userData) {
          setLoading(false);
          return;
        }

        // Get owned projects
        const { data: ownedProjects } = await supabase
          .from('projects')
          .select('*')
          .eq('owner_id', userData.id)
          .order('name', { ascending: true });

        // Get member projects
        const { data: memberProjects } = await supabase
          .from('project_members')
          .select('project_id, projects(*)')
          .eq('user_id', userData.id);

        const owned = ownedProjects || [];
        const member = (memberProjects || []).map((mp: any) => mp.projects).filter(Boolean);
        const allProjects = [...owned, ...member];
        
        // Remove duplicates
        const uniqueProjects = Array.from(
          new Map(allProjects.map((p: any) => [p.id, p])).values()
        ) as Project[];
        
        setProjects(uniqueProjects);
      } catch (error) {
        console.error('Error loading projects:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [supabase]);

  // Load all templates (admin and PM only)
  useEffect(() => {
    const loadTemplates = async () => {
      if (role !== 'admin' && role !== 'pm') {
        setTemplates([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('project_templates')
          .select('id, name')
          .order('name', { ascending: true });

        if (!error && data) {
          setTemplates(data);
        }
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    };

    loadTemplates();
  }, [role, supabase]);

  // Load projects for project management (same as regular projects)
  useEffect(() => {
    // Reuse the same projects list for project management
    setProjectManagementProjects(projects);
  }, [projects]);

  // Load task count for "My Tasks" badge
  useEffect(() => {
    const loadMyTasksCount = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setMyTasksCount(0);
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', session.user.id)
          .single();

        if (!userData) {
          setMyTasksCount(0);
          return;
        }

        // Get all projects user is a member of
        const { data: ownedProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('owner_id', userData.id);

        const { data: memberProjects } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', userData.id);

        const allProjectIds = new Set<string>();
        (ownedProjects || []).forEach((p) => allProjectIds.add(p.id));
        (memberProjects || []).forEach((mp: any) => allProjectIds.add(mp.project_id));

        if (allProjectIds.size === 0) {
          setMyTasksCount(0);
          return;
        }

        // Calculate date range: today to 14 days from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const twoWeeksFromNow = new Date(today);
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

        // Get tasks assigned to user with due dates in the next 2 weeks
        const { data: tasksData } = await supabase
          .from('project_tasks')
          .select('due_date')
          .in('project_id', Array.from(allProjectIds))
          .eq('assignee_id', userData.id)
          .in('status', ['todo', 'in_progress'])
          .not('due_date', 'is', null);

        if (tasksData) {
          const filteredTasks = tasksData.filter((task) => {
            if (!task.due_date) return false;
            const dueDate = new Date(task.due_date);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate >= today && dueDate <= twoWeeksFromNow;
          });
          setMyTasksCount(filteredTasks.length);
        } else {
          setMyTasksCount(0);
        }
      } catch (error) {
        console.error('Error loading my tasks count:', error);
        setMyTasksCount(0);
      }
    };

    loadMyTasksCount();
    // Refresh count every minute
    const interval = setInterval(loadMyTasksCount, 60000);
    return () => clearInterval(interval);
  }, [supabase]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (projectsPopoverTimeoutRef.current) {
        clearTimeout(projectsPopoverTimeoutRef.current);
      }
      if (templatesPopoverTimeoutRef.current) {
        clearTimeout(templatesPopoverTimeoutRef.current);
      }
      if (projectManagementPopoverTimeoutRef.current) {
        clearTimeout(projectManagementPopoverTimeoutRef.current);
      }
    };
  }, []);

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
    if (path === '/admin/templates') {
      return pathname === '/admin/templates';
    }
    if (path === '/my-tasks') {
      return pathname === '/my-tasks';
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
    return pathname?.includes(`/admin/templates/${templateId}/`);
  };

  const isProjectManagementActive = (projectId: string) => {
    return pathname === `/project-management/${projectId}` || pathname?.startsWith(`/project-management/${projectId}/`);
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
        flexShrink: 0,
        zIndex: (theme) => theme.zIndex.drawer,
        '& .MuiDrawer-paper': {
        width: open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
        boxSizing: 'border-box',
        backgroundColor: '#000',
        borderRight: '2px solid rgba(0, 229, 255, 0.2)',
        transition: 'width 0.3s ease',
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
          padding: '16px',
          minHeight: 64,
          borderBottom: '2px solid rgba(0, 229, 255, 0.2)',
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
            logoError ? (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  background: '#00E5FF',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                FSM
              </Typography>
            ) : (
              <Box
                component="img"
                src="/fullstack_logo.svg"
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
            iconError ? (
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
                src="/fullstack_icon.svg"
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
        {open && (
          <IconButton
            onClick={onToggle}
            sx={{
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
              },
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      {/* Collapse button when sidebar is collapsed */}
      {!open && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px',
            borderBottom: '2px solid rgba(0, 229, 255, 0.2)',
          }}
        >
          <IconButton
            onClick={onToggle}
            sx={{
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
              },
            }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <List sx={{ pt: 1 }}>
        {/* Dashboard */}
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => handleNavigate('/dashboard')}
            selected={isActive('/dashboard')}
            sx={{
              minHeight: 48,
              '&.Mui-selected': {
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                borderLeft: '3px solid',
                borderLeftColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.15)',
                },
              },
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                justifyContent: 'center',
                color: isActive('/dashboard') ? 'primary.main' : 'text.secondary',
              }}
            >
              <DashboardIcon />
            </ListItemIcon>
            {open && <ListItemText primary="Dashboard" />}
          </ListItemButton>
        </ListItem>

        {/* Projects */}
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              if (projects.length > 0) {
                // If has projects, show popover on hover instead of navigating
                return;
              }
              handleNavigate('/projects');
            }}
            onMouseEnter={(e) => {
              if (projects.length > 0) {
                // Clear any existing timeout
                if (projectsPopoverTimeoutRef.current) {
                  clearTimeout(projectsPopoverTimeoutRef.current);
                  projectsPopoverTimeoutRef.current = null;
                }
                setProjectsPopoverAnchor(e.currentTarget);
              }
            }}
            onMouseLeave={() => {
              if (projects.length > 0) {
                // Add delay before closing to allow mouse to move to popover
                projectsPopoverTimeoutRef.current = setTimeout(() => {
                  setProjectsPopoverAnchor(null);
                }, 200);
              }
            }}
            selected={isActive('/projects')}
            sx={{
              minHeight: 48,
              '&.Mui-selected': {
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                borderLeft: '3px solid',
                borderLeftColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.15)',
                },
              },
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: open ? 40 : 40,
                justifyContent: 'center',
                color: isActive('/projects') ? 'primary.main' : 'text.secondary',
              }}
            >
              <FolderIcon />
            </ListItemIcon>
            {open && <ListItemText primary="Projects" />}
          </ListItemButton>
        </ListItem>

        {/* Project Management */}
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              if (projectManagementProjects.length > 0) {
                // If has projects, show popover on hover instead of navigating
                return;
              }
              handleNavigate('/project-management');
            }}
            onMouseEnter={(e) => {
              if (projectManagementProjects.length > 0) {
                // Clear any existing timeout
                if (projectManagementPopoverTimeoutRef.current) {
                  clearTimeout(projectManagementPopoverTimeoutRef.current);
                  projectManagementPopoverTimeoutRef.current = null;
                }
                setProjectManagementPopoverAnchor(e.currentTarget);
              }
            }}
            onMouseLeave={() => {
              if (projectManagementProjects.length > 0) {
                // Add delay before closing to allow mouse to move to popover
                projectManagementPopoverTimeoutRef.current = setTimeout(() => {
                  setProjectManagementPopoverAnchor(null);
                }, 200);
              }
            }}
            selected={isActive('/project-management')}
            sx={{
              minHeight: 48,
              '&.Mui-selected': {
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                borderLeft: '3px solid',
                borderLeftColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.15)',
                },
              },
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: open ? 40 : 40,
                justifyContent: 'center',
                color: isActive('/project-management') ? 'primary.main' : 'text.secondary',
              }}
            >
              <AssignmentIcon />
            </ListItemIcon>
            {open && <ListItemText primary="Project Management" />}
          </ListItemButton>
        </ListItem>

        {/* Templates (Admin and PM only) */}
        {(role === 'admin' || role === 'pm') && (
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                if (templates.length > 0) {
                  // If has templates, show popover on hover instead of navigating
                  return;
                }
                handleNavigate('/admin/templates');
              }}
              onMouseEnter={(e) => {
                if (templates.length > 0) {
                  // Clear any existing timeout
                  if (templatesPopoverTimeoutRef.current) {
                    clearTimeout(templatesPopoverTimeoutRef.current);
                    templatesPopoverTimeoutRef.current = null;
                  }
                  setTemplatesPopoverAnchor(e.currentTarget);
                }
              }}
              onMouseLeave={() => {
                if (templates.length > 0) {
                  // Add delay before closing to allow mouse to move to popover
                  templatesPopoverTimeoutRef.current = setTimeout(() => {
                    setTemplatesPopoverAnchor(null);
                  }, 200);
                }
              }}
              selected={isActive('/admin/templates')}
              sx={{
                minHeight: 48,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  borderLeft: '3px solid',
                  borderLeftColor: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 229, 255, 0.15)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.05)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: open ? 40 : 40,
                  justifyContent: 'center',
                  color: isActive('/admin/templates') ? 'primary.main' : 'text.secondary',
                }}
              >
                <DescriptionIcon />
              </ListItemIcon>
              {open && <ListItemText primary="Templates" />}
            </ListItemButton>
          </ListItem>
        )}

        {/* Ops Tool Section */}
        <Divider sx={{ my: 1, borderColor: 'rgba(0, 229, 255, 0.2)' }} />
        {open && (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
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
          <ListItemButton
            onClick={() => handleNavigate('/ops/companies')}
            selected={isActive('/ops/companies')}
            sx={{
              minHeight: 48,
              '&.Mui-selected': {
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                borderLeft: '3px solid',
                borderLeftColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.15)',
                },
              },
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                justifyContent: 'center',
                color: isActive('/ops/companies') ? 'primary.main' : 'text.secondary',
              }}
            >
              <BusinessIcon />
            </ListItemIcon>
            {open && <ListItemText primary="Companies" />}
          </ListItemButton>
        </ListItem>

        {/* Opportunities */}
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => handleNavigate('/ops/opportunities')}
            selected={isActive('/ops/opportunities')}
            sx={{
              minHeight: 48,
              '&.Mui-selected': {
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                borderLeft: '3px solid',
                borderLeftColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.15)',
                },
              },
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                justifyContent: 'center',
                color: isActive('/ops/opportunities') ? 'primary.main' : 'text.secondary',
              }}
            >
              <TrendingUpIcon />
            </ListItemIcon>
            {open && <ListItemText primary="Opportunities" />}
          </ListItemButton>
        </ListItem>

        {/* Contacts */}
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => handleNavigate('/ops/contacts')}
            selected={isActive('/ops/contacts')}
            sx={{
              minHeight: 48,
              '&.Mui-selected': {
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                borderLeft: '3px solid',
                borderLeftColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.15)',
                },
              },
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                justifyContent: 'center',
                color: isActive('/ops/contacts') ? 'primary.main' : 'text.secondary',
              }}
            >
              <ContactsIcon />
            </ListItemIcon>
            {open && <ListItemText primary="Contacts" />}
          </ListItemButton>
        </ListItem>
      </List>

      {/* Projects Popover - Shows on hover regardless of sidebar state */}
      <Popover
        open={Boolean(projectsPopoverAnchor)}
        anchorEl={projectsPopoverAnchor}
        onClose={() => {
          if (projectsPopoverTimeoutRef.current) {
            clearTimeout(projectsPopoverTimeoutRef.current);
            projectsPopoverTimeoutRef.current = null;
          }
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
        sx={{
          pointerEvents: 'none',
          '& .MuiPopover-paper': {
            pointerEvents: 'auto',
          },
        }}
        PaperProps={{
          onMouseEnter: () => {
            // Clear timeout when mouse enters popover
            if (projectsPopoverTimeoutRef.current) {
              clearTimeout(projectsPopoverTimeoutRef.current);
              projectsPopoverTimeoutRef.current = null;
            }
          },
          onMouseLeave: () => {
            // Close popover when mouse leaves
            setProjectsPopoverAnchor(null);
          },
        }}
      >
        <Paper
          sx={{
            backgroundColor: '#000',
            border: '1px solid rgba(0, 229, 255, 0.3)',
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
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                },
              }}
            >
              <ListItemText primary="All Projects" />
            </MenuItem>
            <Divider sx={{ borderColor: 'rgba(0, 229, 255, 0.2)' }} />
            {projects.map((project) => (
              <MenuItem
                key={project.id}
                onClick={() => {
                  handleNavigate(`/project/${project.id}`);
                  setProjectsPopoverAnchor(null);
                }}
                selected={isProjectActive(project.id)}
                sx={{
                  color: isProjectActive(project.id) ? 'primary.main' : 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(0, 229, 255, 0.15)',
                  },
                }}
              >
                <ListItemText
                  primary={project.name}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                  }}
                />
              </MenuItem>
            ))}
          </MenuList>
        </Paper>
      </Popover>

      {/* Templates Popover - Shows on hover regardless of sidebar state */}
      <Popover
        open={Boolean(templatesPopoverAnchor)}
        anchorEl={templatesPopoverAnchor}
        onClose={() => {
          if (templatesPopoverTimeoutRef.current) {
            clearTimeout(templatesPopoverTimeoutRef.current);
            templatesPopoverTimeoutRef.current = null;
          }
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
        sx={{
          pointerEvents: 'none',
          '& .MuiPopover-paper': {
            pointerEvents: 'auto',
          },
        }}
        PaperProps={{
          onMouseEnter: () => {
            // Clear timeout when mouse enters popover
            if (templatesPopoverTimeoutRef.current) {
              clearTimeout(templatesPopoverTimeoutRef.current);
              templatesPopoverTimeoutRef.current = null;
            }
          },
          onMouseLeave: () => {
            // Close popover when mouse leaves
            setTemplatesPopoverAnchor(null);
          },
        }}
      >
        <Paper
          sx={{
            backgroundColor: '#000',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            minWidth: 200,
            maxHeight: 400,
            overflow: 'auto',
          }}
        >
          <MenuList dense>
            <MenuItem
              onClick={() => {
                handleNavigate('/admin/templates');
                setTemplatesPopoverAnchor(null);
              }}
              sx={{
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                },
              }}
            >
              <ListItemText primary="All Templates" />
            </MenuItem>
            {templates.length > 0 && (
              <>
                <Divider sx={{ borderColor: 'rgba(0, 229, 255, 0.2)' }} />
                {templates.map((template) => (
                  <MenuItem
                    key={template.id}
                    onClick={() => {
                      handleNavigate(`/admin/templates/${template.id}/builder`);
                      setTemplatesPopoverAnchor(null);
                    }}
                    selected={isTemplateActive(template.id)}
                    sx={{
                      color: isTemplateActive(template.id) ? 'primary.main' : 'text.secondary',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 229, 255, 0.1)',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(0, 229, 255, 0.15)',
                      },
                    }}
                  >
                    <ListItemText
                      primary={template.name}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                      }}
                    />
                  </MenuItem>
                ))}
              </>
            )}
          </MenuList>
        </Paper>
      </Popover>

      {/* Project Management Popover - Shows on hover regardless of sidebar state */}
      <Popover
        open={Boolean(projectManagementPopoverAnchor)}
        anchorEl={projectManagementPopoverAnchor}
        onClose={() => {
          if (projectManagementPopoverTimeoutRef.current) {
            clearTimeout(projectManagementPopoverTimeoutRef.current);
            projectManagementPopoverTimeoutRef.current = null;
          }
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
        sx={{
          pointerEvents: 'none',
          '& .MuiPopover-paper': {
            pointerEvents: 'auto',
          },
        }}
        PaperProps={{
          onMouseEnter: () => {
            // Clear timeout when mouse enters popover
            if (projectManagementPopoverTimeoutRef.current) {
              clearTimeout(projectManagementPopoverTimeoutRef.current);
              projectManagementPopoverTimeoutRef.current = null;
            }
          },
          onMouseLeave: () => {
            // Close popover when mouse leaves
            setProjectManagementPopoverAnchor(null);
          },
        }}
      >
        <Paper
          sx={{
            backgroundColor: '#000',
            border: '1px solid rgba(0, 229, 255, 0.3)',
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
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                },
              }}
            >
              <ListItemText primary="All Projects" />
            </MenuItem>
            {projectManagementProjects.length > 0 && (
              <>
                <Divider sx={{ borderColor: 'rgba(0, 229, 255, 0.2)' }} />
                {projectManagementProjects.map((project) => (
                  <MenuItem
                    key={project.id}
                    onClick={() => {
                      handleNavigate(`/project-management/${project.id}`);
                      setProjectManagementPopoverAnchor(null);
                    }}
                    selected={isProjectManagementActive(project.id)}
                    sx={{
                      color: isProjectManagementActive(project.id) ? 'primary.main' : 'text.secondary',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 229, 255, 0.1)',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(0, 229, 255, 0.15)',
                      },
                    }}
                  >
                    <ListItemText
                      primary={project.name}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                      }}
                    />
                  </MenuItem>
                ))}
              </>
            )}
          </MenuList>
        </Paper>
      </Popover>
      </Box>

      {/* My Tasks - Bottom Navigation Item */}
      <Box sx={{ borderTop: '1px solid rgba(0, 229, 255, 0.1)', flexShrink: 0 }}>
        <List>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => handleNavigate('/my-tasks')}
              selected={isActive('/my-tasks')}
              sx={{
                minHeight: 48,
                position: 'relative',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  borderLeft: '3px solid',
                  borderLeftColor: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 229, 255, 0.15)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.05)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: open ? 40 : 40,
                  justifyContent: 'center',
                  color: isActive('/my-tasks') ? 'primary.main' : 'text.secondary',
                }}
              >
                <ScheduleIcon />
              </ListItemIcon>
              {open && (
                <>
                  <ListItemText primary="My Tasks" />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ml: 'auto',
                      mr: 1,
                      minWidth: 20,
                      height: 20,
                      borderRadius: '10px',
                      backgroundColor: '#FF1744',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      px: 0.75,
                    }}
                  >
                    {myTasksCount}
                  </Box>
                </>
              )}
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
      </Box>
    </Drawer>
  );
}

