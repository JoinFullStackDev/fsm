'use client';

import {
  TextField,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Grid,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Storage as StorageIcon,
  Api as ApiIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { Phase4Data, Entity, APISpec, UserStory, AcceptanceCriteria } from '@/types/phases';

interface Phase4FormProps {
  data: Phase4Data;
  onChange: (data: Phase4Data) => void;
}

export default function Phase4Form({ data, onChange }: Phase4FormProps) {
  const updateField = <K extends keyof Phase4Data>(field: K, value: Phase4Data[K]) => {
    onChange({ ...data, [field]: value });
  };

  const addEntity = () => {
    const newEntity: Entity = {
      name: '',
      description: '',
      key_fields: [],
      relationships: [],
    };
    updateField('entities', [...data.entities, newEntity]);
  };

  const updateEntity = (index: number, entity: Entity) => {
    const updated = [...data.entities];
    updated[index] = entity;
    updateField('entities', updated);
  };

  const removeEntity = (index: number) => {
    updateField('entities', data.entities.filter((_, i) => i !== index));
  };

  const addAPISpec = () => {
    const newAPISpec: APISpec = {
      endpoint: '',
      method: 'GET',
      path: '',
      description: '',
      request_params: {},
      body_schema: {},
      response_schema: {},
      error_codes: [],
    };
    updateField('api_spec', [...data.api_spec, newAPISpec]);
  };

  const updateAPISpec = (index: number, spec: APISpec) => {
    const updated = [...data.api_spec];
    updated[index] = spec;
    updateField('api_spec', updated);
  };

  const removeAPISpec = (index: number) => {
    updateField('api_spec', data.api_spec.filter((_, i) => i !== index));
  };

  const addUserStory = () => {
    const newStory: UserStory = {
      user_role: '',
      statement: '',
    };
    updateField('user_stories', [...data.user_stories, newStory]);
  };

  const updateUserStory = (index: number, story: UserStory) => {
    const updated = [...data.user_stories];
    updated[index] = story;
    updateField('user_stories', updated);
  };

  const removeUserStory = (index: number) => {
    updateField('user_stories', data.user_stories.filter((_, i) => i !== index));
  };

  const addAcceptanceCriteria = () => {
    const newCriteria: AcceptanceCriteria = {
      story_id: '',
      given: '',
      when: '',
      then: '',
    };
    updateField('acceptance_criteria', [...data.acceptance_criteria, newCriteria]);
  };

  const updateAcceptanceCriteria = (index: number, criteria: AcceptanceCriteria) => {
    const updated = [...data.acceptance_criteria];
    updated[index] = criteria;
    updateField('acceptance_criteria', updated);
  };

  const removeAcceptanceCriteria = (index: number) => {
    updateField('acceptance_criteria', data.acceptance_criteria.filter((_, i) => i !== index));
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
        {/* Entities - Full Width Grid */}
        <Grid item xs={12}>
          <SectionCard
            title="Entities"
            icon={<StorageIcon />}
            borderColor="#00E5FF"
            fullWidth
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.entities.map((entity, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#121633',
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#00E5FF', fontWeight: 600 }}>
                          {entity.name || `Entity ${index + 1}`}
                        </Typography>
                        <IconButton
                          onClick={() => removeEntity(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="Name"
                        value={entity.name}
                        onChange={(e) => updateEntity(index, { ...entity, name: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Description"
                        value={entity.description}
                        onChange={(e) => updateEntity(index, { ...entity, description: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Key Fields (comma-separated)"
                        value={entity.key_fields.join(', ')}
                        onChange={(e) => updateEntity(index, { ...entity, key_fields: e.target.value.split(',').map(s => s.trim()) })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Relationships (comma-separated)"
                        value={entity.relationships.join(', ')}
                        onChange={(e) => updateEntity(index, { ...entity, relationships: e.target.value.split(',').map(s => s.trim()) })}
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
                onClick={addEntity}
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
                Add Entity
              </Button>
              <AIAssistButton
                label="AI Generate Entities"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate data entities based on features and screens. Return as JSON array of entity objects with name, description, key_fields (array), and relationships (array). ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate entities for analysis phase.',
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
                    const entities = JSON.parse(result);
                    if (Array.isArray(entities)) {
                      updateField('entities', [...data.entities, ...entities]);
                    }
                  } catch {}
                }}
                context="AI will suggest data entities based on your features and screens"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* ERD - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="ERD (Entity Relationship Diagram)"
            icon={<StorageIcon />}
            borderColor="#2196F3"
          >
            <TextField
              fullWidth
              multiline
              rows={10}
              label="ERD (JSON format)"
              value={JSON.stringify(data.erd || {}, null, 2)}
              onChange={(e) => {
                try {
                  const erd = JSON.parse(e.target.value);
                  updateField('erd', erd);
                } catch {}
              }}
              placeholder='{"entities": {}, "relationships": {}}'
            />
          </SectionCard>
        </Grid>

        {/* API Specs - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="API Specifications"
            icon={<ApiIcon />}
            borderColor="#E91E63"
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.api_spec.map((spec, index) => (
                <Grid item xs={12} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#121633',
                      border: '1px solid rgba(233, 30, 99, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ color: '#E91E63', fontWeight: 600 }}>
                          {spec.endpoint || `API ${index + 1}`}
                        </Typography>
                        <IconButton
                          onClick={() => removeAPISpec(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Method</InputLabel>
                            <Select
                              value={spec.method}
                              label="Method"
                              onChange={(e) => updateAPISpec(index, { ...spec, method: e.target.value as any })}
                            >
                              <MenuItem value="GET">GET</MenuItem>
                              <MenuItem value="POST">POST</MenuItem>
                              <MenuItem value="PUT">PUT</MenuItem>
                              <MenuItem value="PATCH">PATCH</MenuItem>
                              <MenuItem value="DELETE">DELETE</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={9}>
                          <TextField
                            fullWidth
                            label="Endpoint"
                            value={spec.endpoint}
                            onChange={(e) => updateAPISpec(index, { ...spec, endpoint: e.target.value })}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Path"
                            value={spec.path}
                            onChange={(e) => updateAPISpec(index, { ...spec, path: e.target.value })}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label="Description"
                            value={spec.description}
                            onChange={(e) => updateAPISpec(index, { ...spec, description: e.target.value })}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Request Params (JSON)"
                            value={JSON.stringify(spec.request_params, null, 2)}
                            onChange={(e) => {
                              try {
                                const params = JSON.parse(e.target.value);
                                updateAPISpec(index, { ...spec, request_params: params });
                              } catch {}
                            }}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Body Schema (JSON)"
                            value={JSON.stringify(spec.body_schema, null, 2)}
                            onChange={(e) => {
                              try {
                                const schema = JSON.parse(e.target.value);
                                updateAPISpec(index, { ...spec, body_schema: schema });
                              } catch {}
                            }}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Response Schema (JSON)"
                            value={JSON.stringify(spec.response_schema, null, 2)}
                            onChange={(e) => {
                              try {
                                const schema = JSON.parse(e.target.value);
                                updateAPISpec(index, { ...spec, response_schema: schema });
                              } catch {}
                            }}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Error Codes (comma-separated)"
                            value={spec.error_codes.join(', ')}
                            onChange={(e) => updateAPISpec(index, { ...spec, error_codes: e.target.value.split(',').map(s => s.trim()) })}
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addAPISpec}
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
                Add API Spec
              </Button>
              <AIAssistButton
                label="AI Suggest APIs"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Suggest REST API endpoints based on entities and user stories. Return as JSON array of API spec objects with endpoint, method, path, description, request_params (object), body_schema (object), response_schema (object), and error_codes (array). ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate API specifications for analysis phase.',
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
                    const apis = JSON.parse(result);
                    if (Array.isArray(apis)) {
                      updateField('api_spec', [...data.api_spec, ...apis]);
                    }
                  } catch {}
                }}
                context="AI will suggest API endpoints based on your entities and user stories"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* User Stories - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="User Stories"
            icon={<AssignmentIcon />}
            borderColor="#00FF88"
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.user_stories.map((story, index) => (
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
                        <Typography variant="caption" sx={{ color: '#00FF88' }}>
                          Story {index + 1}
                        </Typography>
                        <IconButton
                          onClick={() => removeUserStory(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="User Role"
                        value={story.user_role}
                        onChange={(e) => updateUserStory(index, { ...story, user_role: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Statement"
                        value={story.statement}
                        onChange={(e) => updateUserStory(index, { ...story, statement: e.target.value })}
                        margin="normal"
                        size="small"
                        placeholder="As a [role], I want [action], so that [outcome]"
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addUserStory}
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
                Add User Story
              </Button>
              <AIAssistButton
                label="AI Generate User Stories"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate user stories in "As a [role], I want [action], so that [outcome]" format. Return as JSON array of user story objects with user_role and statement. ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate user stories for analysis phase.',
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
                    const stories = JSON.parse(result);
                    if (Array.isArray(stories)) {
                      updateField('user_stories', [...data.user_stories, ...stories]);
                    }
                  } catch {}
                }}
                context="AI will generate user stories based on your personas and features"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* Acceptance Criteria - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="Acceptance Criteria"
            icon={<CheckCircleIcon />}
            borderColor="#2196F3"
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.acceptance_criteria.map((criteria, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#121633',
                      border: '1px solid rgba(33, 150, 243, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#2196F3' }}>
                          Criteria {index + 1}
                        </Typography>
                        <IconButton
                          onClick={() => removeAcceptanceCriteria(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="Story ID"
                        value={criteria.story_id}
                        onChange={(e) => updateAcceptanceCriteria(index, { ...criteria, story_id: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Given"
                        value={criteria.given}
                        onChange={(e) => updateAcceptanceCriteria(index, { ...criteria, given: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="When"
                        value={criteria.when}
                        onChange={(e) => updateAcceptanceCriteria(index, { ...criteria, when: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Then"
                        value={criteria.then}
                        onChange={(e) => updateAcceptanceCriteria(index, { ...criteria, then: e.target.value })}
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
                onClick={addAcceptanceCriteria}
                variant="outlined"
                sx={{
                  borderColor: '#2196F3',
                  color: '#2196F3',
                  '&:hover': {
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                  },
                }}
              >
                Add Acceptance Criteria
              </Button>
              <AIAssistButton
                label="AI Generate Criteria"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate acceptance criteria in Given/When/Then format for user stories. Return as JSON array of criteria objects with story_id, given, when, and then. ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate acceptance criteria for analysis phase.',
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
                    const criteria = JSON.parse(result);
                    if (Array.isArray(criteria)) {
                      updateField('acceptance_criteria', [...data.acceptance_criteria, ...criteria]);
                    }
                  } catch {}
                }}
                context="AI will generate acceptance criteria based on your user stories"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* RBAC & Non-Functional - Side by Side */}
        <Grid item xs={12} md={6}>
          <SectionCard
            title="RBAC Matrix"
            icon={<SecurityIcon />}
            borderColor="#FF6B35"
          >
            <TextField
              fullWidth
              multiline
              rows={10}
              label="RBAC Matrix (JSON format)"
              value={JSON.stringify(data.rbac || {}, null, 2)}
              onChange={(e) => {
                try {
                  const rbac = JSON.parse(e.target.value);
                  updateField('rbac', rbac);
                } catch {}
              }}
              placeholder='{"role": {"permission": true}}'
            />
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard
            title="Non-Functional Requirements"
            icon={<SpeedIcon />}
            borderColor="#00E5FF"
          >
            <TextField
              fullWidth
              multiline
              rows={10}
              label="Non-Functional Requirements"
              value={data.non_functional_requirements}
              onChange={(e) => updateField('non_functional_requirements', e.target.value)}
              placeholder="Security, performance, scalability requirements..."
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
