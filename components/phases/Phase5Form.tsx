'use client';

import {
  TextField,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Architecture as ArchitectureIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { Phase5Data } from '@/types/phases';

interface Phase5FormProps {
  data: Phase5Data;
  onChange: (data: Phase5Data) => void;
}

export default function Phase5Form({ data, onChange }: Phase5FormProps) {
  const updateField = <K extends keyof Phase5Data>(field: K, value: Phase5Data[K]) => {
    onChange({ ...data, [field]: value });
  };

  const SectionCard = ({
    title,
    icon,
    children,
    borderColor = '#00E5FF',
  }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    borderColor?: string;
  }) => (
    <Card
      sx={{
        border: `2px solid ${borderColor}40`,
        borderLeft: `4px solid ${borderColor}`,
        backgroundColor: '#1A1F3A',
        height: '100%',
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: `${borderColor}80`,
          boxShadow: `0 8px 32px ${borderColor}20`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box sx={{ color: borderColor }}>{icon}</Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#E0E0E0' }}>
            {title}
          </Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {/* Folder Structure - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="Folder Structure"
            icon={<FolderIcon />}
            borderColor="#00E5FF"
          >
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                multiline
                rows={12}
                label="Folder Structure"
                value={data.folder_structure}
                onChange={(e) => updateField('folder_structure', e.target.value)}
                placeholder="Define the folder structure for the project..."
              />
              <AIAssistButton
                label="AI Generate"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate a folder structure for a ${data.architecture_instructions || 'Next.js'} application. Return as plain text showing the folder tree structure. ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate folder structure for build accelerator phase.',
                        phaseData: data,
                      },
                    }),
                  });
                  const json = await response.json();
                  if (!response.ok) throw new Error(json.error);
                  return json.result;
                }}
                onAccept={(result) => updateField('folder_structure', result)}
                context="AI will generate a folder structure based on your architecture"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* Architecture Instructions - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="Architecture Instructions"
            icon={<ArchitectureIcon />}
            borderColor="#E91E63"
          >
            <TextField
              fullWidth
              multiline
              rows={12}
              label="Architecture Instructions"
              value={data.architecture_instructions}
              onChange={(e) => updateField('architecture_instructions', e.target.value)}
              placeholder="Preferred architecture pattern, file-based routing, etc..."
            />
          </SectionCard>
        </Grid>

        {/* Coding Standards - Left Column */}
        <Grid item xs={12} md={6}>
          <SectionCard
            title="Coding Standards"
            icon={<CodeIcon />}
            borderColor="#00FF88"
          >
            <TextField
              fullWidth
              multiline
              rows={12}
              label="Coding Standards & Patterns"
              value={data.coding_standards}
              onChange={(e) => updateField('coding_standards', e.target.value)}
              placeholder="TypeScript, hooks, separation of concerns..."
            />
          </SectionCard>
        </Grid>

        {/* Environment Setup - Right Column */}
        <Grid item xs={12} md={6}>
          <SectionCard
            title="Environment Setup"
            icon={<SettingsIcon />}
            borderColor="#FF6B35"
          >
            <TextField
              fullWidth
              multiline
              rows={12}
              label="Environment Setup Instructions"
              value={data.env_setup}
              onChange={(e) => updateField('env_setup', e.target.value)}
              placeholder="Environment variables required, basic secrets (described, not actual secrets)..."
            />
          </SectionCard>
        </Grid>
      </Grid>

      {/* Master Prompt Section */}
      <Card
        sx={{
          borderLeft: '4px solid',
          borderLeftColor: 'secondary.main',
          backgroundColor: 'rgba(233, 30, 99, 0.05)',
          mt: 3,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'secondary.main' }}>
              Master Prompt (Optional)
            </Typography>
            <HelpTooltip title="Customize how AI generates the phase summary. Use {{phase_data}} placeholder to inject phase data. If not provided, uses default summary format." />
          </Box>
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Master Prompt"
            value={data.master_prompt || ''}
            onChange={(e) => updateField('master_prompt', e.target.value)}
            placeholder="Enter a custom prompt for AI summary generation. Use {{phase_data}} to include phase data..."
            variant="outlined"
            helperText="Use {{phase_data}} placeholder to inject phase data into your prompt. Leave empty to use default summary format."
          />
        </CardContent>
      </Card>
    </Box>
  );
}
