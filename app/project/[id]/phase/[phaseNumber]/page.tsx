'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControlLabel,
  Switch,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Paper,
  Chip,
  IconButton,
  Fab,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Save as SaveIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
  FileDownload as FileDownloadIcon,
  ArrowForward as ArrowForwardIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { canEditPhase as canEditPhaseByRole } from '@/lib/rbac';
import { useNotification } from '@/components/providers/NotificationProvider';
import { canCompletePhase, getPhaseDependencyMessage, type PhaseStatus } from '@/lib/phaseDependencies';
import { calculatePhaseProgress } from '@/lib/phases/calculatePhaseProgress';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import KeyboardShortcutsDialog from '@/components/ui/KeyboardShortcutsDialog';
import logger from '@/lib/utils/logger';
import Phase1Form from '@/components/phases/Phase1Form';
import Phase2Form from '@/components/phases/Phase2Form';
import Phase3Form from '@/components/phases/Phase3Form';
import Phase4Form from '@/components/phases/Phase4Form';
import Phase5Form from '@/components/phases/Phase5Form';
import Phase6Form from '@/components/phases/Phase6Form';
import TemplateBasedPhaseForm from '@/components/phases/TemplateBasedPhaseForm';
import {
  generatePhase1Summary,
  generatePhase2Summary,
  generatePhase3Summary,
  generatePhase4Summary,
  generatePhase5Summary,
  generatePhase6Summary,
} from '@/lib/phaseSummaries';
import type {
  Phase1Data,
  Phase2Data,
  Phase3Data,
  Phase4Data,
  Phase5Data,
  Phase6Data,
} from '@/types/phases';

export default function PhasePage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const phaseNumber = parseInt(params.phaseNumber as string, 10);
  const supabase = createSupabaseClient();
  const { role } = useRole();
  const { showSuccess, showError } = useNotification();
  const [phaseData, setPhaseData] = useState<
    Phase1Data | Phase2Data | Phase3Data | Phase4Data | Phase5Data | Phase6Data | null
  >(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [projectName, setProjectName] = useState<string>('');
  const [phaseStatuses, setPhaseStatuses] = useState<PhaseStatus[]>([]);
  const [canComplete, setCanComplete] = useState(true);
  const [dependencyMessage, setDependencyMessage] = useState<string>('');
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [useTemplateForm, setUseTemplateForm] = useState(false);
  const [templateVersion, setTemplateVersion] = useState<string | null>(null);
  const [currentPhaseName, setCurrentPhaseName] = useState<string>('');
  const [totalPhases, setTotalPhases] = useState<number>(6);
  const [actualPhaseNumber, setActualPhaseNumber] = useState<number>(phaseNumber);
  const [phases, setPhases] = useState<Array<{ phase_number: number; phase_name: string }>>([]);
  const [fieldConfigs, setFieldConfigs] = useState<Array<{ field_key: string }>>([]);
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false);
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false);

  // Helper function to check if a value is meaningful (has content)
  const checkValue = useCallback((value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value)) {
      if (value.length === 0) return false;
      // For arrays of objects, check if at least one object has meaningful content
      if (value.length > 0 && typeof value[0] === 'object') {
        return value.some(item => {
          if (typeof item === 'object' && item !== null) {
            return Object.keys(item).some(key => checkValue(item[key]));
          }
          return checkValue(item);
        });
      }
      return true;
    }
    if (typeof value === 'object') {
      // Check if object has any non-empty values
      const keys = Object.keys(value);
      if (keys.length === 0) return false;
      // For nested objects, check if they have meaningful content
      return keys.some(key => checkValue(value[key]));
    }
    return true;
  }, []);

  // Calculate phase progress based on field values
  const calculateFieldBasedProgress = useCallback((): number => {
    if (!phaseData) return 0;

    // If we have field configs (template-based form), calculate based on those fields
    if (fieldConfigs.length > 0) {
      const totalFields = fieldConfigs.length;
      const completedFields = fieldConfigs.filter(config => {
        const fieldKey = config.field_key;
        const value = (phaseData as any)?.[fieldKey];
        return checkValue(value);
      }).length;

      return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
    }

    // Fallback to old calculation for non-template forms
    return calculatePhaseProgress(actualPhaseNumber, phaseData);
  }, [phaseData, fieldConfigs, actualPhaseNumber, checkValue]);

  const phaseProgress = useMemo(() => calculateFieldBasedProgress(), [calculateFieldBasedProgress]);
  const completedFieldsCount = useMemo(() => {
    if (fieldConfigs.length > 0 && phaseData) {
      return fieldConfigs.filter(config => {
        const fieldKey = config.field_key;
        const value = (phaseData as any)?.[fieldKey];
        return checkValue(value);
      }).length;
    }
    return 0;
  }, [phaseData, fieldConfigs, checkValue]);

  useEffect(() => {
    // Phase number validation removed - now supports any positive integer
    if (phaseNumber < 1) {
      setError('Invalid phase number');
      setLoading(false);
      return;
    }

    const loadPhase = async () => {
      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }

      // Load project via API route to avoid RLS recursion
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      if (!projectResponse.ok) {
        const errorData = await projectResponse.json();
        setError(errorData.error || 'Project not found');
        setLoading(false);
        return;
      }

      const projectData = await projectResponse.json();
      
      // Get user's database ID (users.id) from API route, not auth.uid()
      // The project_members.user_id references users.id, not users.auth_id
      let userDatabaseId: string | null = null;
      try {
        const userResponse = await fetch('/api/users/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          userDatabaseId = userData.id;
        }
      } catch (err) {
        logger.warn('[PhasePage] Failed to fetch user ID:', err);
      }
      
      // Fallback: if API fails, we'll check membership differently
      const userId = userDatabaseId || session.user.id;
      
      if (projectData) {
        setProjectName(projectData.name);
        
        logger.debug('[PhasePage] Project template_id:', projectData.template_id);
        logger.debug('[PhasePage] Phase number:', phaseNumber);
        logger.debug('[PhasePage] User database ID:', userDatabaseId);
        
        // Template detection will happen after we load the phase data
        // to ensure we use the correct phase_number from the database
      }
      
      // Determine which template to use for field configs (will be set after phase load)
      let templateToUse: string | null = null;

      // Load the current phase via API route to avoid RLS recursion
      const phaseResponse = await fetch(`/api/projects/${projectId}/phases/${phaseNumber}`);
      if (!phaseResponse.ok) {
        const errorData = await phaseResponse.json();
        setError(errorData.error || 'Phase not found');
        setLoading(false);
        return;
      }

      const currentPhaseData = await phaseResponse.json();

      // Use the actual phase_number from the database (in case URL doesn't match)
      const actualPhaseNumberFromDB = currentPhaseData.phase_number;
      setActualPhaseNumber(actualPhaseNumberFromDB);
      logger.debug('[PhasePage] URL phase_number:', phaseNumber, 'DB phase_number:', actualPhaseNumberFromDB);

      // Load all phase statuses via API route to check dependencies
      const phasesResponse = await fetch(`/api/projects/${projectId}/phases`);
      let allPhases: any[] = [];
      if (phasesResponse.ok) {
        const phasesData = await phasesResponse.json();
        allPhases = phasesData.phases || [];
      } else {
        logger.error('Error loading phase statuses:', await phasesResponse.json());
      }

      const statuses: PhaseStatus[] = allPhases.map((p: any) => ({
        phase_number: p.phase_number,
        completed: p.completed,
      }));
      setPhaseStatuses(statuses);
      
      // Set total phases count
      setTotalPhases(allPhases.length || 6);
        
      // Store phases for lookup
      setPhases((allPhases || []).map((p: any) => ({
        phase_number: p.phase_number,
        phase_name: p.phase_name || `Phase ${p.phase_number}`
      })));

      // Check if this phase can be completed
      const dependencyCheck = canCompletePhase(actualPhaseNumberFromDB, statuses);
      setCanComplete(dependencyCheck.canComplete);
      
      // Create phase names map from loaded phases
      const phaseNamesMap = (allPhases || []).reduce((acc: Record<number, string>, phase: any) => {
        acc[phase.phase_number] = phase.phase_name || `Phase ${phase.phase_number}`;
        return acc;
      }, {} as Record<number, string>);
      
      setDependencyMessage(getPhaseDependencyMessage(actualPhaseNumberFromDB, dependencyCheck.missingPhases, phaseNamesMap));

      // Use the phase data we already loaded
      const data = currentPhaseData;

      // Set current phase name from database, with fallback
      const phaseName = data.phase_name || `Phase ${actualPhaseNumberFromDB}`;
      setCurrentPhaseName(phaseName);

      // Initialize phase data - ensure it's an object, not null
      const phaseDataValue = data.data || {};
      setPhaseData(phaseDataValue as any);
      setCompleted(data.completed);
      setHasInitialLoadCompleted(true);
      setHasUserMadeChanges(false);
      
      logger.debug('[PhasePage] Phase data loaded:', {
        urlPhaseNumber: phaseNumber,
        dbPhaseNumber: actualPhaseNumberFromDB,
        phaseName,
        hasData: !!data.data,
        dataKeys: Object.keys(phaseDataValue),
        completed: data.completed
      });

      // NOW check for template field configs using the actual phase_number from database
      // ALWAYS use the project's template_id if it exists - don't try to detect
      if (projectData && projectData.template_id) {
        // Load field configs via API route to avoid RLS recursion
        // If this fails, continue without field configs (will use hardcoded forms)
        let fieldConfigs: any[] = [];
        try {
          const configsResponse = await fetch(`/api/admin/templates/${projectData.template_id}/field-configs?phase_number=${actualPhaseNumberFromDB}`);
          if (configsResponse.ok) {
            const configsData = await configsResponse.json();
            fieldConfigs = configsData.fieldConfigs || [];
          } else {
            // Silently fail - don't show error to user, just log it
            try {
              const errorData = await configsResponse.json();
              logger.warn('[PhasePage] Failed to load field configs (will use hardcoded forms):', errorData.error || 'Unknown error');
            } catch {
              logger.warn('[PhasePage] Failed to load field configs (will use hardcoded forms)');
            }
            // Continue without field configs - page will use hardcoded phase forms
          }
        } catch (fetchError) {
          // Network error or other fetch issue - silently continue
          logger.warn('[PhasePage] Error fetching field configs (will use hardcoded forms):', fetchError);
          // Continue without field configs
        }

        logger.debug('[PhasePage] Template field configs check (project has template_id):', {
          projectTemplateId: projectData.template_id,
          actualPhaseNumber: actualPhaseNumberFromDB,
          phaseName: phaseName,
          found: fieldConfigs?.length || 0,
          fieldKeys: fieldConfigs?.map((f: any) => f.field_key)
        });

        if (fieldConfigs && fieldConfigs.length > 0) {
          templateToUse = projectData.template_id;
          setFieldConfigs(fieldConfigs);
          logger.debug('[PhasePage] Using project template_id:', templateToUse, 'for phase', actualPhaseNumberFromDB);
        } else {
          logger.warn('[PhasePage] Project has template_id but no field configs found for phase', {
            templateId: projectData.template_id,
            phaseNumber: actualPhaseNumberFromDB,
            phaseName: phaseName
          });
        }
      } else if (projectData && !projectData.template_id) {
        // Project has no template_id - try to find the correct template by matching template_phases
        logger.debug('[PhasePage] Project has no template_id, attempting to detect template from phases');
        
        // Get all phases for this project via API route
        const projectPhasesResponse = await fetch(`/api/projects/${projectId}/phases`);
        let projectPhases: any[] = [];
        if (projectPhasesResponse.ok) {
          const phasesData = await projectPhasesResponse.json();
          projectPhases = phasesData.phases || [];
        }
        
        if (projectPhases && projectPhases.length > 0) {
          const projectPhaseNumbers = projectPhases.map((p: any) => p.phase_number).sort();
          const projectPhaseMap = new Map(projectPhases.map((p: any) => [p.phase_number, p.phase_name]));
          logger.debug('[PhasePage] Project phase numbers:', projectPhaseNumbers);
          logger.debug('[PhasePage] Project phase names:', Array.from(projectPhaseMap.entries()));
          
          // Get all templates that have template_phases matching these phase numbers
          // Load templates via API route to avoid RLS recursion
          const templatesResponse = await fetch('/api/admin/templates');
          let allTemplatePhases: any[] = [];
          if (templatesResponse.ok) {
            const templatesData = await templatesResponse.json();
            // We'll need to load template phases for each template
            // For now, skip this complex detection - it's not critical
            allTemplatePhases = [];
          }
          
          if (allTemplatePhases && allTemplatePhases.length > 0) {
            // Group by template_id and check how well they match
            const templateMatches = allTemplatePhases.reduce((acc: any, tp: any) => {
              if (!acc[tp.template_id]) {
                acc[tp.template_id] = {
                  phaseNumbers: new Set<number>(),
                  phaseNames: new Map<number, string>(),
                  exactMatches: 0
                };
              }
              acc[tp.template_id].phaseNumbers.add(tp.phase_number);
              acc[tp.template_id].phaseNames.set(tp.phase_number, tp.phase_name);
              
              // Check if phase name matches
              const projectPhaseName = projectPhaseMap.get(tp.phase_number);
              if (projectPhaseName && tp.phase_name === projectPhaseName) {
                acc[tp.template_id].exactMatches++;
              }
              
              return acc;
            }, {} as Record<string, { phaseNumbers: Set<number>; phaseNames: Map<number, string>; exactMatches: number }>);
            
            // Find the best match - prefer templates with:
            // 1. Most exact phase name matches
            // 2. Most phase number matches
            // 3. Prefer custom templates over default template, but use default if it's the only match
            let bestMatch: { templateId: string; score: number; matchCount: number; isDefault: boolean } | null = null;
            const defaultTemplateId = '19c71e39-85a2-46d3-b195-adbd5b955854';
            
            // First pass: find best match excluding default template
            for (const [templateId, match] of Object.entries(templateMatches)) {
              if (templateId === defaultTemplateId) {
                continue; // Skip default in first pass
              }
              
              const matchTyped = match as any;
              const matchCount = matchTyped.phaseNumbers.size;
              // Score: exact matches * 100 + phase count matches
              const score = matchTyped.exactMatches * 100 + matchCount;
              
              if (!bestMatch || score > bestMatch.score || (score === bestMatch.score && matchCount > bestMatch.matchCount)) {
                bestMatch = { templateId, score, matchCount, isDefault: false };
              }
            }
            
            // Second pass: if no custom template matched well, consider default template
            // Only use default if it has a good match (at least some exact matches or all phase numbers match)
            if (!bestMatch || bestMatch.score < 100) {
              const defaultMatch = templateMatches[defaultTemplateId];
              if (defaultMatch) {
                const matchCount = defaultMatch.phaseNumbers.size;
                const score = defaultMatch.exactMatches * 100 + matchCount;
                
                // Use default if it's better than current match, or if no match found
                if (!bestMatch || score >= bestMatch.score) {
                  bestMatch = { templateId: defaultTemplateId, score, matchCount, isDefault: true };
                  logger.debug('[PhasePage] Using default template as fallback:', {
                    score,
                    matchCount,
                    exactMatches: defaultMatch.exactMatches
                  });
                }
              }
            } else {
              logger.debug('[PhasePage] Using custom template, skipping default:', bestMatch.templateId);
            }
            
            logger.debug('[PhasePage] Template detection results:', {
              templateMatches: Object.fromEntries(
                Object.entries(templateMatches).map(([id, match]: [string, any]) => [
                  id, 
                  {
                    phases: Array.from(match.phaseNumbers),
                    phaseNames: Array.from(match.phaseNames.entries()),
                    exactMatches: match.exactMatches,
                    isDefault: id === '19c71e39-85a2-46d3-b195-adbd5b955854'
                  }
                ])
              ),
              bestMatch: bestMatch ? {
                templateId: bestMatch.templateId,
                score: bestMatch.score,
                matchCount: bestMatch.matchCount,
                isDefault: bestMatch.isDefault
              } : null
            });
            
            // Use the best match if it has field configs for the current phase
            if (bestMatch) {
              // Load field configs via API route
              const phaseConfigsResponse = await fetch(`/api/admin/templates/${bestMatch.templateId}/field-configs?phase_number=${actualPhaseNumberFromDB}`);
              let phaseConfigs: any[] = [];
              if (phaseConfigsResponse.ok) {
                const configsData = await phaseConfigsResponse.json();
                phaseConfigs = configsData.fieldConfigs || [];
              }
              
              if (phaseConfigs && phaseConfigs.length > 0) {
                templateToUse = bestMatch.templateId;
                setFieldConfigs(phaseConfigs);
                logger.debug('[PhasePage] Detected template from phases:', templateToUse, 'with score', bestMatch.score, 'and', bestMatch.matchCount, 'matching phases');
              }
            }
          }
        }
      }
      
      // Strategy 2: If no template_id or no field configs found, try default template (backward compatibility)
      if (!templateToUse) {
        // Load templates via API route to find default template
        const templatesResponse = await fetch('/api/admin/templates');
        let defaultTemplate: any = null;
        if (templatesResponse.ok) {
          const templatesData = await templatesResponse.json();
          defaultTemplate = templatesData.data?.find((t: any) => t.name === 'FullStack Method Default');
        }

        logger.debug('[PhasePage] Default template check:', {
          found: !!defaultTemplate,
          id: defaultTemplate?.id
        });

        if (defaultTemplate) {
          // Check if default template has field configs for this actual phase_number
          const configsResponse = await fetch(`/api/admin/templates/${defaultTemplate.id}/field-configs?phase_number=${actualPhaseNumberFromDB}`);
          let fieldConfigs: any[] = [];
          if (configsResponse.ok) {
            const configsData = await configsResponse.json();
            fieldConfigs = configsData.fieldConfigs || [];
          }

          logger.debug('[PhasePage] Default template field configs check:', {
            templateId: defaultTemplate.id,
            actualPhaseNumber: actualPhaseNumberFromDB,
            found: fieldConfigs?.length || 0
          });

          if (fieldConfigs && fieldConfigs.length > 0) {
            templateToUse = defaultTemplate.id;
            setFieldConfigs(fieldConfigs);
            logger.debug('[PhasePage] Using default template:', templateToUse);
          }
        }
      }
      
      // Strategy 3: Skip - too complex to implement via API routes
      // If no template found, will use hardcoded forms
      
      // Set template if found
      if (templateToUse) {
        logger.debug('[PhasePage] Final template selected:', templateToUse, 'for phase_number:', actualPhaseNumberFromDB);
        setTemplateId(templateToUse);
        setUseTemplateForm(true);
      } else {
        logger.debug('[PhasePage] No template with field configs found for phase_number:', actualPhaseNumberFromDB, 'will use hardcoded phase forms');
      }

      // Load saved document if it exists
      const savedDocument = (data.data as any)?.generated_document;
      if (savedDocument) {
        setSummary(savedDocument);
      }

      // Check if user is a project member (owner or in project_members table)
      // CRITICAL: Use userDatabaseId (users.id) not auth.uid() for membership checks
      // project_members.user_id references users.id, not users.auth_id
      const isProjectOwner = projectData?.owner_id === userDatabaseId;
      
      // Check if user is in project_members table via API route
      const membersResponse = await fetch(`/api/projects/${projectId}/members`);
      let isProjectMember = isProjectOwner;
      if (membersResponse.ok && userDatabaseId) {
        const membersData = await membersResponse.json();
        const members = membersData.members || [];
        // Compare with userDatabaseId (users.id), not auth.uid()
        isProjectMember = isProjectOwner || members.some((m: any) => m.user_id === userDatabaseId);
        logger.debug('[PhasePage] Membership check:', {
          userDatabaseId,
          isProjectOwner,
          members: members.map((m: any) => ({ user_id: m.user_id })),
          isProjectMember
        });
      } else if (!userDatabaseId) {
        logger.warn('[PhasePage] Cannot check membership: userDatabaseId not available');
      }

      // Check if user can edit this phase (by role and project membership)
      if (role) {
        setCanEdit(canEditPhaseByRole(role, phaseNumber, isProjectMember));
      } else {
        // If no role, allow editing if they're a project member
        setCanEdit(isProjectMember);
      }
      
      logger.debug('[PhasePage] Permission check result:', {
        role,
        isProjectMember,
        canEdit: role ? canEditPhaseByRole(role, phaseNumber, isProjectMember) : isProjectMember
      });

      setLoading(false);
    };

    if (projectId && phaseNumber) {
      loadPhase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, phaseNumber]); // Only re-run when projectId or phaseNumber changes

  const handleToggleComplete = async (newCompleted: boolean) => {
    if (!canEdit) {
      showError('You do not have permission to edit this phase');
      return;
    }

    // Check dependencies before allowing completion
    if (newCompleted && !canComplete) {
      showError(dependencyMessage);
      return;
    }

    setCompleted(newCompleted);
    
    // Auto-save the completion status
    const { error: updateError } = await supabase
      .from('project_phases')
      .update({
        completed: newCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .eq('phase_number', phaseNumber);

    if (updateError) {
      showError('Failed to update completion status: ' + updateError.message);
      setCompleted(!newCompleted); // Revert on error
    } else {
      // Reload phase statuses to update dependencies for other phases
      const { data: allPhases } = await supabase
        .from('project_phases')
        .select('phase_number, completed')
        .eq('project_id', projectId)
        .order('phase_number', { ascending: true });

      if (allPhases) {
        const statuses: PhaseStatus[] = allPhases.map((p: any) => ({
          phase_number: p.phase_number,
          completed: p.completed,
        }));
        setPhaseStatuses(statuses);
      }

      if (newCompleted) {
        showSuccess('Phase marked as completed!');
      } else {
        showSuccess('Phase marked as incomplete.');
      }
    }
  };

  const handleSave = async () => {
    if (!phaseData || !canEdit) return;

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('project_phases')
      .update({
        data: phaseData,
        completed,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .eq('phase_number', phaseNumber);

    if (updateError) {
      setError(updateError.message);
      showError('Failed to save: ' + updateError.message);
      setSaving(false);
    } else {
      showSuccess('Phase saved successfully!');
      setTimeout(() => {
        setSaving(false);
      }, 1000);
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 's',
      ctrl: true,
      action: () => {
        if (canEdit && !saving && phaseData) {
          handleSave();
        }
      },
    },
    {
      key: 's',
      meta: true, // Cmd+S on Mac
      action: () => {
        if (canEdit && !saving && phaseData) {
          handleSave();
        }
      },
    },
    {
      key: 'k',
      ctrl: true,
      action: () => {
        setShowShortcutsDialog(true);
      },
    },
    {
      key: 'k',
      meta: true, // Cmd+K on Mac
      action: () => {
        setShowShortcutsDialog(true);
      },
    },
    {
      key: 'Escape',
      action: () => {
        if (showSummary) {
          setShowSummary(false);
        }
        if (showShortcutsDialog) {
          setShowShortcutsDialog(false);
        }
      },
    },
  ]);

  const handleGenerateSummary = async () => {
    if (!phaseData) return;

    // Check if master_prompt exists
    const masterPrompt = (phaseData as any).master_prompt;
    
    setGeneratingSummary(true);
    try {
      let finalPrompt = '';
      
      if (masterPrompt && masterPrompt.trim()) {
        // Use master prompt - replace {{phase_data}} placeholder with formatted JSON
        const phaseDataJson = JSON.stringify(phaseData, null, 2);
        const promptWithData = masterPrompt.replace(/\{\{phase_data\}\}/g, phaseDataJson);
        
        // Include project name if available
        finalPrompt = projectName 
          ? `Project: ${projectName}\n\n${promptWithData}`
          : promptWithData;
      } else {
        // Use default prompt to generate client-ready document
        const phaseDataJson = JSON.stringify(phaseData, null, 2);
        const documentType = getDocumentTypeForPhase(phaseNumber);
        
        finalPrompt = `You are creating a professional, client-ready ${documentType} document.

Project Name: ${projectName || 'Unnamed Project'}

Phase Data:
${phaseDataJson}

Instructions:
- Create a comprehensive, professional ${documentType} document
- Format it as a polished business document suitable for client presentation
- Include all relevant information from the phase data
- Use clear headings, sections, and professional language
- Make it ready to share with stakeholders and clients
- Structure it logically with executive summary, detailed sections, and conclusions
- Ensure it's well-formatted and easy to read

Generate the complete ${documentType} document now:`;
      }

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          options: {
            context: `Generate client-ready document for Phase ${phaseNumber}: ${currentPhaseName || `Phase ${phaseNumber}`}`,
            phaseData: phaseData,
          },
          structured: false,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Failed to generate document');
      }

      const generatedDocument = json.result || json.response || 'Document generated successfully';
      setSummary(generatedDocument);
      
      // Save the document to phase data
      const updatedPhaseData = {
        ...phaseData,
        generated_document: generatedDocument,
        document_generated_at: new Date().toISOString(),
      };
      
      // Update phase data in database
      const { error: saveError } = await supabase
        .from('project_phases')
        .update({
          data: updatedPhaseData,
          updated_at: new Date().toISOString(),
        })
        .eq('project_id', projectId)
        .eq('phase_number', phaseNumber);

      if (saveError) {
        logger.error('Error saving document:', saveError);
        showError('Document generated but failed to save. Please try again.');
      } else {
        setPhaseData(updatedPhaseData as any);
        showSuccess('Client-ready document generated and saved!');
      }
      
      setShowSummary(true);
    } catch (err) {
      showError(`Failed to generate document: ${err instanceof Error ? err.message : 'Unknown error'}`);
      logger.error('Document generation error:', err);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const getDocumentTypeForPhase = (phaseNum: number): string => {
    switch (phaseNum) {
      case 1:
        return 'Concept Framing Document';
      case 2:
        return 'Product Strategy Document';
      case 3:
        return 'Rapid Prototype Definition Document';
      case 4:
        return 'Analysis & User Stories Document';
      case 5:
        return 'Build Accelerator Document';
      case 6:
        return 'QA & Hardening Document';
      default:
        return 'Phase Document';
    }
  };

  const handleDownloadDocument = () => {
    if (!summary) return;
    
    const documentType = getDocumentTypeForPhase(phaseNumber);
    const sanitizedProjectName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'project';
    const filename = `${sanitizedProjectName}_${documentType.replace(/\s+/g, '_').toLowerCase()}.md`;
    
    const blob = new Blob([summary], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showSuccess('Document downloaded!');
  };

  // Auto-save function (called on blur or manual save)
  const handleAutoSave = useCallback(async () => {
    if (!phaseData || !canEdit || saving || !hasInitialLoadCompleted || !hasUserMadeChanges) return;

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('project_phases')
      .update({
        data: phaseData,
        completed,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .eq('phase_number', phaseNumber);

    if (updateError) {
      setError(updateError.message);
      showError('Failed to save: ' + updateError.message);
    } else {
      showSuccess('Changes saved automatically');
      setHasUserMadeChanges(false); // Reset after successful save
    }
    setSaving(false);
  }, [phaseData, completed, canEdit, saving, hasInitialLoadCompleted, hasUserMadeChanges, projectId, phaseNumber, supabase, showError, showSuccess]);

  // Track when user makes changes (after initial load)
  useEffect(() => {
    if (!hasInitialLoadCompleted) return;
    
    // Mark that user has made changes
    setHasUserMadeChanges(true);
  }, [phaseData, completed, hasInitialLoadCompleted]);

  const renderPhaseForm = () => {
    if (!phaseData) return null;

    // Get the actual phase_number from the current phase data
    // We need to find it from the phaseData or use the URL phaseNumber
    // Actually, we should use the phaseNumber state or get it from the loaded phase
    // For now, use the URL phaseNumber but this should match what's in the database
    
    // Use template-based form if template is available and has field configs
    if (useTemplateForm && templateId && actualPhaseNumber) {
      // Removed verbose debug log that was causing console clutter on every render
      
      // Use templateId + phaseNumber as key to force re-render when template changes
      return (
        <ErrorBoundary>
          <TemplateBasedPhaseForm
            key={`template-${templateId}-phase-${actualPhaseNumber}`}
            templateId={templateId}
            phaseNumber={actualPhaseNumber}
            data={(phaseData as unknown as Record<string, unknown>) || {}}
            onChange={(data) => setPhaseData(data as unknown as typeof phaseData)}
            onBlur={handleAutoSave}
          />
        </ErrorBoundary>
      );
    }

    // Fall back to existing phase forms
    switch (phaseNumber) {
      case 1:
        return (
          <Phase1Form
            data={phaseData as Phase1Data}
            onChange={setPhaseData as (data: Phase1Data) => void}
          />
        );
      case 2:
        return (
          <Phase2Form
            data={phaseData as Phase2Data}
            onChange={setPhaseData as (data: Phase2Data) => void}
          />
        );
      case 3:
        return (
          <Phase3Form
            data={phaseData as Phase3Data}
            onChange={setPhaseData as (data: Phase3Data) => void}
          />
        );
      case 4:
        return (
          <Phase4Form
            data={phaseData as Phase4Data}
            onChange={setPhaseData as (data: Phase4Data) => void}
          />
        );
      case 5:
        return (
          <Phase5Form
            data={phaseData as Phase5Data}
            onChange={setPhaseData as (data: Phase5Data) => void}
          />
        );
      case 6:
        return (
          <Phase6Form
            data={phaseData as Phase6Data}
            onChange={setPhaseData as (data: Phase6Data) => void}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <>
        <Container>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  if (error && !phaseData) {
    return (
      <>
        <Container>
          <Alert severity="error" sx={{ mt: 4 }}>
            {error}
          </Alert>
        </Container>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 12 }}>
        <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 4 }, pb: { xs: 10, md: 4 }, px: { xs: 0, md: 3 } }}>
          <Box sx={{ px: { xs: 2, md: 0 } }}>
            <Breadcrumbs
              items={[
                { label: projectName || 'Project', href: `/project/${projectId}` },
                { label: `Phase ${phaseNumber}: ${currentPhaseName || `Phase ${phaseNumber}`}` },
              ]}
            />
          </Box>
          {/* Header with Back Button and Phase Info */}
          <Box sx={{ px: { xs: 2, md: 0 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: { xs: 'flex-start', md: 'space-between' }, gap: { xs: 2, md: 2 }, mb: 3, mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: { xs: '100%', md: 'auto' }, flex: { xs: 'none', md: '0 0 auto' } }}>
              <IconButton
                onClick={() => router.push(`/project/${projectId}`)}
                sx={{
                  color: theme.palette.text.primary,
                  border: `1px solid ${theme.palette.divider}`,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h4" sx={{ fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif', color: theme.palette.text.primary, mb: 0.5, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
                  Phase {phaseNumber}: {currentPhaseName || `Phase ${phaseNumber}`}
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                  {projectId}
                </Typography>
              </Box>
            </Box>
            {(() => {
              // Sort phases by phase_number to ensure correct order
              const sortedPhases = [...phases].sort((a, b) => a.phase_number - b.phase_number);
              
              if (sortedPhases.length === 0) return null;
              
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 0.5, width: { xs: '100%', md: 'auto' }, flex: { xs: 'none', md: '0 0 auto' } }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: theme.palette.text.secondary,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Navigate Phases
                  </Typography>
                  <Box sx={{ display: 'flex', gap: { xs: 1, md: 0.5 }, alignItems: 'center', flexWrap: 'nowrap', width: { xs: '100%', md: 'auto' } }}>
                    {sortedPhases.map((phase) => {
                      const isCurrentPhase = phase.phase_number === actualPhaseNumber;
                      return (
                        <Tooltip
                          key={phase.phase_number}
                          title={phase.phase_name || `Phase ${phase.phase_number}`}
                          arrow
                        >
                          <Button
                            variant={isCurrentPhase ? "contained" : "outlined"}
                            onClick={() => router.push(`/project/${projectId}/phase/${phase.phase_number}`)}
                            sx={{
                              flex: { xs: 1, md: 'none' },
                              minWidth: { xs: 0, md: 32 },
                              width: { xs: 'auto', md: 32 },
                              height: { xs: 40, md: 32 },
                              padding: 0,
                              borderColor: isCurrentPhase ? theme.palette.text.primary : theme.palette.divider,
                              backgroundColor: isCurrentPhase ? theme.palette.text.primary : 'transparent',
                              color: isCurrentPhase ? theme.palette.background.paper : theme.palette.text.primary,
                              fontWeight: isCurrentPhase ? 700 : 600,
                              fontSize: { xs: '0.875rem', md: '0.75rem' },
                              '&:hover': {
                                borderColor: theme.palette.text.primary,
                                backgroundColor: isCurrentPhase ? theme.palette.text.primary : theme.palette.action.hover,
                              },
                            }}
                          >
                            {phase.phase_number}
                          </Button>
                        </Tooltip>
                      );
                    })}
                  </Box>
                </Box>
              );
            })()}
          </Box>

          {/* Dependency Warning Alert - Full Width */}
          {!canComplete && !completed && dependencyMessage && (
            <Alert
              severity="warning"
              sx={{
                mb: 3,
                width: '100%',
                mx: { xs: 2, md: 0 },
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                '& .MuiAlert-icon': {
                  color: theme.palette.text.primary,
                },
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontSize: { xs: '0.875rem', md: '0.875rem' } }}>
                {dependencyMessage}
              </Typography>
            </Alert>
          )}

          {/* Phase Progress Bar */}
          <Box
            sx={{
              p: { xs: 1.5, md: 2 },
              mb: 3,
              mx: { xs: 2, md: 0 },
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 1, gap: { xs: 0.5, sm: 0 } }}>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 500, fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                {fieldConfigs.length > 0 
                  ? `Phase Progress: ${phaseProgress}% complete (${completedFieldsCount}/${fieldConfigs.length} fields)`
                  : `Overall Progress: Phase ${phaseNumber} of ${totalPhases}`}
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 600, fontSize: { xs: '0.875rem', md: '0.875rem' } }}>
                {phaseProgress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={phaseProgress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.palette.action.hover,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: theme.palette.text.primary,
                },
              }}
            />
          </Box>

          {/* Action Buttons - Sticky */}
          <Box
            sx={{
              p: { xs: 1.5, md: 2 },
              mb: 3,
              mx: { xs: 2, md: 0 },
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, md: 2 },
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' },
              position: 'sticky',
              top: { xs: 64, md: 80 },
              zIndex: 10,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 1.5, sm: 2 }, flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={completed}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      if (newValue && !canComplete) {
                        showError(dependencyMessage);
                        return;
                      }
                      handleToggleComplete(newValue);
                    }}
                    disabled={!canEdit || (!completed && !canComplete)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: theme.palette.text.primary,
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: theme.palette.text.primary,
                      },
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: theme.palette.text.primary, fontWeight: 500, fontSize: { xs: '0.875rem', md: '1rem' } }}>
                    Mark as Completed
                  </Typography>
                }
              />
              <Chip
                icon={completed ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : undefined}
                label={completed ? 'Completed' : 'In Progress'}
                sx={{
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  height: 28,
                  px: 1,
                  backgroundColor: completed ? theme.palette.text.primary : theme.palette.action.hover,
                  color: completed ? theme.palette.background.default : theme.palette.text.primary,
                  border: `1px solid ${completed ? theme.palette.text.primary : theme.palette.divider}`,
                  '& .MuiChip-icon': {
                    color: completed ? theme.palette.background.default : undefined,
                    fontSize: '16px',
                  },
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'flex-start', sm: 'flex-end' }, width: { xs: '100%', sm: 'auto' } }}>
              {phaseData && (phaseData as any).generated_document && (
                <Tooltip title="View Document">
                  <IconButton
                    onClick={() => {
                      setSummary((phaseData as any).generated_document);
                      setShowSummary(true);
                    }}
                    sx={{
                      color: theme.palette.text.primary,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    <DescriptionIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={generatingSummary 
                ? 'Generating...' 
                : !phaseData
                  ? 'No phase data available'
                  : (phaseData && (phaseData as any).generated_document) 
                    ? 'Regenerate Document' 
                    : 'Generate Document'}>
                <span>
                  <IconButton
                    onClick={handleGenerateSummary}
                    disabled={!phaseData || generatingSummary}
                    sx={{
                      color: theme.palette.text.primary,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                      '&.Mui-disabled': {
                        color: theme.palette.text.secondary,
                      },
                    }}
                  >
                    {generatingSummary ? (
                      <CircularProgress size={24} sx={{ color: 'inherit' }} />
                    ) : (phaseData && (phaseData as any).generated_document) ? (
                      <ReplayIcon />
                    ) : (
                      <DescriptionIcon />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={saving ? 'Saving...' : !canEdit ? 'You do not have permission to edit this phase' : 'Save'}>
                <span>
                  <IconButton
                    onClick={handleSave}
                    disabled={saving || !canEdit}
                    sx={{
                      color: '#4CAF50',
                      '&:hover': {
                        backgroundColor: '#4CAF5020',
                      },
                      '&.Mui-disabled': {
                        color: theme.palette.text.secondary,
                      },
                    }}
                  >
                    {saving ? <CircularProgress size={24} sx={{ color: '#4CAF50' }} /> : <SaveIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                mx: { xs: 2, md: 0 },
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
            >
              {error}
            </Alert>
          )}

          {!canEdit && (
            <Alert
              severity="warning"
              sx={{
                mb: 3,
                mx: { xs: 2, md: 0 },
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
            >
                You don&apos;t have permission to edit this phase based on your role.
            </Alert>
          )}

          {/* Phase Form */}
          {phaseData && (
            <Box sx={{ opacity: canEdit ? 1 : 0.6, width: '100%' }}>
              {renderPhaseForm()}
            </Box>
          )}
        </Container>

        {/* Sticky Action Buttons */}
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 16, md: 24 },
            right: { xs: 16, md: 24 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 1000,
          }}
        >
          <Fab
            onClick={handleGenerateSummary}
            disabled={!phaseData || generatingSummary}
            sx={{
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
              '&:hover': {
                backgroundColor: theme.palette.text.secondary,
              },
              '&.Mui-disabled': {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.secondary,
              },
            }}
            title="Generate Client Document"
          >
            {generatingSummary ? <CircularProgress size={24} sx={{ color: theme.palette.background.default }} /> : <DescriptionIcon />}
          </Fab>
          <Fab
            onClick={handleSave}
            disabled={saving || !canEdit}
            sx={{
              backgroundColor: '#4CAF50',
              color: theme.palette.background.paper,
              '&:hover': {
                backgroundColor: '#45a049',
              },
              '&.Mui-disabled': {
                backgroundColor: theme.palette.divider,
                color: theme.palette.text.secondary,
              },
            }}
          >
            {saving ? <CircularProgress size={24} sx={{ color: theme.palette.background.paper }} /> : <SaveIcon />}
          </Fab>
        </Box>

        <Dialog
          open={showSummary}
          onClose={() => setShowSummary(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            },
          }}
        >
          <DialogTitle
            sx={{
              backgroundColor: theme.palette.action.hover,
              borderBottom: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
              fontWeight: 600,
              fontFamily: 'var(--font-rubik), Rubik, sans-serif',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box>
              {getDocumentTypeForPhase(phaseNumber)}
              {phaseData && (phaseData as any).document_generated_at && (
                <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.secondary, fontWeight: 400, mt: 0.5 }}>
                  Generated: {new Date((phaseData as any).document_generated_at).toLocaleString()}
                </Typography>
              )}
            </Box>
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Box
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                fontSize: '0.9375rem',
                lineHeight: 1.8,
                maxHeight: '60vh',
                overflow: 'auto',
                p: 3,
                backgroundColor: theme.palette.background.default,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
                fontFamily: 'inherit',
                margin: 0,
              }}
            >
              {summary}
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Button
              onClick={handleDownloadDocument}
              startIcon={<FileDownloadIcon />}
              sx={{
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Download
            </Button>
            <Button
              onClick={() => {
                if (summary) {
                  navigator.clipboard.writeText(summary);
                  showSuccess('Document copied to clipboard!');
                }
              }}
              sx={{
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Copy
            </Button>
            <Button
              onClick={() => setShowSummary(false)}
              variant="outlined"
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
      <KeyboardShortcutsDialog
        open={showShortcutsDialog}
        onClose={() => setShowShortcutsDialog(false)}
        shortcuts={[
          {
            keys: ['ctrl', 's'],
            description: 'Save phase data',
            category: 'Phase Actions',
          },
          {
            keys: ['meta', 's'],
            description: 'Save phase data (Mac)',
            category: 'Phase Actions',
          },
          {
            keys: ['ctrl', 'k'],
            description: 'Show keyboard shortcuts',
            category: 'General',
          },
          {
            keys: ['meta', 'k'],
            description: 'Show keyboard shortcuts (Mac)',
            category: 'General',
          },
          {
            keys: ['Escape'],
            description: 'Close dialogs',
            category: 'General',
          },
        ]}
      />
    </ErrorBoundary>
  );
}

