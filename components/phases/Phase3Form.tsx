'use client';

import {
  TextField,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  IconButton,
  Grid,
  Chip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  PhoneAndroid as PhoneAndroidIcon,
  AccountTree as AccountTreeIcon,
  Widgets as WidgetsIcon,
  Palette as PaletteIcon,
  Navigation as NavigationIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { Phase3Data, Screen, Flow, Component } from '@/types/phases';

interface Phase3FormProps {
  data: Phase3Data;
  onChange: (data: Phase3Data) => void;
}

export default function Phase3Form({ data, onChange }: Phase3FormProps) {
  const updateField = <K extends keyof Phase3Data>(field: K, value: Phase3Data[K]) => {
    onChange({ ...data, [field]: value });
  };

  const addScreen = () => {
    const newScreen: Screen = {
      screen_key: '',
      title: '',
      description: '',
      roles: [],
      is_core: false,
    };
    updateField('screens', [...data.screens, newScreen]);
  };

  const updateScreen = (index: number, screen: Screen) => {
    const updated = [...data.screens];
    updated[index] = screen;
    updateField('screens', updated);
  };

  const removeScreen = (index: number) => {
    updateField('screens', data.screens.filter((_, i) => i !== index));
  };

  const addFlow = () => {
    const newFlow: Flow = {
      name: '',
      start_screen: '',
      end_screen: '',
      steps: [],
      notes: '',
    };
    updateField('flows', [...data.flows, newFlow]);
  };

  const updateFlow = (index: number, flow: Flow) => {
    const updated = [...data.flows];
    updated[index] = flow;
    updateField('flows', updated);
  };

  const removeFlow = (index: number) => {
    updateField('flows', data.flows.filter((_, i) => i !== index));
  };

  const addComponent = () => {
    const newComponent: Component = {
      name: '',
      description: '',
      props: {},
      state_behavior: '',
      used_on: [],
    };
    updateField('components', [...data.components, newComponent]);
  };

  const updateComponent = (index: number, component: Component) => {
    const updated = [...data.components];
    updated[index] = component;
    updateField('components', updated);
  };

  const removeComponent = (index: number) => {
    updateField('components', data.components.filter((_, i) => i !== index));
  };

  const SectionCard = ({
    title,
    icon,
    children,
    borderColor = '#00E5FF',
    fullWidth = false,
  }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    borderColor?: string;
    fullWidth?: boolean;
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
        {/* Screens - Full Width Grid */}
        <Grid item xs={12}>
          <SectionCard
            title="Screens"
            icon={<PhoneAndroidIcon />}
            borderColor="#00E5FF"
            fullWidth
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.screens.map((screen, index) => (
                <Grid item xs={12} md={6} lg={4} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#121633',
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#00E5FF' }}>
                          {screen.title || `Screen ${index + 1}`}
                        </Typography>
                        <IconButton
                          onClick={() => removeScreen(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="Screen Key"
                        value={screen.screen_key}
                        onChange={(e) => updateScreen(index, { ...screen, screen_key: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Title"
                        value={screen.title}
                        onChange={(e) => updateScreen(index, { ...screen, title: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Description"
                        value={screen.description}
                        onChange={(e) => updateScreen(index, { ...screen, description: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Roles (comma-separated)"
                        value={screen.roles.join(', ')}
                        onChange={(e) => updateScreen(index, { ...screen, roles: e.target.value.split(',').map(s => s.trim()) })}
                        margin="normal"
                        size="small"
                        placeholder="admin, pm, designer"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={screen.is_core}
                            onChange={(e) => updateScreen(index, { ...screen, is_core: e.target.checked })}
                            sx={{
                              color: '#00E5FF',
                              '&.Mui-checked': {
                                color: '#00E5FF',
                              },
                            }}
                          />
                        }
                        label={<Typography sx={{ color: '#E0E0E0', fontSize: '0.875rem' }}>Core Screen</Typography>}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addScreen}
                variant="outlined"
                sx={{
                  borderColor: '#00E5FF',
                  color: '#00E5FF',
                  '&:hover': {
                    borderColor: '#00E5FF',
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  },
                }}
              >
                Add Screen
              </Button>
              <AIAssistButton
                label="AI Suggest Screens"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Suggest screens for this application. Return as JSON array of screen objects with screen_key, title, description, roles (array), and is_core (boolean). ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate screen inventory for rapid prototype definition.',
                        phaseData: data,
                      },
                      structured: true,
                    }),
                  });
                  const json = await response.json();
                  if (!response.ok) throw new Error(json.error);
                  return JSON.stringify(json.result, null, 2);
                }}
                onAccept={(result) => {
                  try {
                    const screens = JSON.parse(result);
                    if (Array.isArray(screens)) {
                      updateField('screens', [...data.screens, ...screens]);
                    }
                  } catch {}
                }}
                context="AI will suggest screens based on your application requirements"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* User Flows - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="User Flows"
            icon={<AccountTreeIcon />}
            borderColor="#E91E63"
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.flows.map((flow, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#121633',
                      border: '1px solid rgba(233, 30, 99, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#E91E63', fontWeight: 600 }}>
                          {flow.name || `Flow ${index + 1}`}
                        </Typography>
                        <IconButton
                          onClick={() => removeFlow(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="Name"
                        value={flow.name}
                        onChange={(e) => updateFlow(index, { ...flow, name: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            label="Start Screen"
                            value={flow.start_screen}
                            onChange={(e) => updateFlow(index, { ...flow, start_screen: e.target.value })}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            label="End Screen"
                            value={flow.end_screen}
                            onChange={(e) => updateFlow(index, { ...flow, end_screen: e.target.value })}
                            size="small"
                          />
                        </Grid>
                      </Grid>
                      <TextField
                        fullWidth
                        label="Steps (one per line)"
                        multiline
                        rows={3}
                        value={flow.steps.join('\n')}
                        onChange={(e) => updateFlow(index, { ...flow, steps: e.target.value.split('\n').filter(s => s.trim()) })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Notes"
                        multiline
                        rows={2}
                        value={flow.notes}
                        onChange={(e) => updateFlow(index, { ...flow, notes: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addFlow}
                variant="outlined"
                sx={{
                  borderColor: '#E91E63',
                  color: '#E91E63',
                  '&:hover': {
                    borderColor: '#E91E63',
                    backgroundColor: 'rgba(233, 30, 99, 0.1)',
                  },
                }}
              >
                Add Flow
              </Button>
              <AIAssistButton
                label="AI Generate Flows"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate user flows based on screens. Return as JSON array of flow objects with name, start_screen, end_screen, steps (array), and notes. ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate user flows for rapid prototype definition.',
                        phaseData: data,
                      },
                      structured: true,
                    }),
                  });
                  const json = await response.json();
                  if (!response.ok) throw new Error(json.error);
                  return JSON.stringify(json.result, null, 2);
                }}
                onAccept={(result) => {
                  try {
                    const flows = JSON.parse(result);
                    if (Array.isArray(flows)) {
                      updateField('flows', [...data.flows, ...flows]);
                    }
                  } catch {}
                }}
                context="AI will generate user flows based on your screens"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* Components - Full Width Grid */}
        <Grid item xs={12}>
          <SectionCard
            title="Components"
            icon={<WidgetsIcon />}
            borderColor="#00FF88"
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.components.map((component, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#121633',
                      border: '1px solid rgba(0, 255, 136, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#00FF88', fontWeight: 600 }}>
                          {component.name || `Component ${index + 1}`}
                        </Typography>
                        <IconButton
                          onClick={() => removeComponent(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="Name"
                        value={component.name}
                        onChange={(e) => updateComponent(index, { ...component, name: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Description"
                        value={component.description}
                        onChange={(e) => updateComponent(index, { ...component, description: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Props (JSON format)"
                        multiline
                        rows={3}
                        value={JSON.stringify(component.props, null, 2)}
                        onChange={(e) => {
                          try {
                            const props = JSON.parse(e.target.value);
                            updateComponent(index, { ...component, props });
                          } catch {}
                        }}
                        margin="normal"
                        size="small"
                        placeholder='{"prop1": "string", "prop2": "number"}'
                      />
                      <TextField
                        fullWidth
                        label="State Behavior"
                        multiline
                        rows={2}
                        value={component.state_behavior}
                        onChange={(e) => updateComponent(index, { ...component, state_behavior: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Used On (comma-separated)"
                        value={component.used_on.join(', ')}
                        onChange={(e) => updateComponent(index, { ...component, used_on: e.target.value.split(',').map(s => s.trim()) })}
                        margin="normal"
                        size="small"
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addComponent}
                variant="outlined"
                sx={{
                  borderColor: '#00FF88',
                  color: '#00FF88',
                  '&:hover': {
                    borderColor: '#00FF88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                  },
                }}
              >
                Add Component
              </Button>
              <AIAssistButton
                label="AI Suggest Components"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Suggest reusable components based on screens. Return as JSON array of component objects with name, description, props (object), state_behavior, and used_on (array). ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate component inventory for rapid prototype definition.',
                        phaseData: data,
                      },
                      structured: true,
                    }),
                  });
                  const json = await response.json();
                  if (!response.ok) throw new Error(json.error);
                  return JSON.stringify(json.result, null, 2);
                }}
                onAccept={(result) => {
                  try {
                    const components = JSON.parse(result);
                    if (Array.isArray(components)) {
                      updateField('components', [...data.components, ...components]);
                    }
                  } catch {}
                }}
                context="AI will suggest reusable components based on your screens"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* Design Tokens & Navigation - Side by Side */}
        <Grid item xs={12} md={6}>
          <SectionCard
            title="Design Tokens"
            icon={<PaletteIcon />}
            borderColor="#2196F3"
          >
            <TextField
              fullWidth
              multiline
              rows={8}
              label="Design Tokens (JSON format)"
              value={JSON.stringify(data.design_tokens || {}, null, 2)}
              onChange={(e) => {
                try {
                  const tokens = JSON.parse(e.target.value);
                  updateField('design_tokens', tokens);
                } catch {}
              }}
              placeholder='{"colors": {}, "spacing": {}, "typography": {}}'
            />
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard
            title="Navigation"
            icon={<NavigationIcon />}
            borderColor="#FF6B35"
          >
            <TextField
              fullWidth
              label="Primary Navigation (comma-separated)"
              value={data.navigation?.primary_nav?.join(', ') || ''}
              onChange={(e) => updateField('navigation', {
                ...data.navigation,
                primary_nav: e.target.value.split(',').map(s => s.trim()),
              })}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              label="Secondary Navigation (comma-separated)"
              value={data.navigation?.secondary_nav?.join(', ') || ''}
              onChange={(e) => updateField('navigation', {
                ...data.navigation,
                secondary_nav: e.target.value.split(',').map(s => s.trim()),
              })}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Route Map (JSON format)"
              value={JSON.stringify(data.navigation?.route_map || {}, null, 2)}
              onChange={(e) => {
                try {
                  const routeMap = JSON.parse(e.target.value);
                  updateField('navigation', {
                    ...data.navigation,
                    route_map: routeMap,
                  });
                } catch {}
              }}
              margin="normal"
              size="small"
              placeholder='{"route1": "/path1", "route2": "/path2"}'
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
