'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Grid,
  Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { AdminSetting } from '@/types/project';

export default function AdminApiConfigTab() {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiProjectName, setGeminiProjectName] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiEnabled, setGeminiEnabled] = useState(true);
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    loadSettings();
    checkSupabaseConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('admin_settings')
      .select('*')
      .in('key', ['api_gemini_key', 'api_gemini_enabled', 'api_gemini_project_name']);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const settings = data as AdminSetting[];
    const keySetting = settings.find(s => s.key === 'api_gemini_key');
    const enabledSetting = settings.find(s => s.key === 'api_gemini_enabled');
    const projectNameSetting = settings.find(s => s.key === 'api_gemini_project_name');

    if (keySetting?.value) {
      // Remove quotes if stored as JSON string
      let keyValue = String(keySetting.value);
      keyValue = keyValue.replace(/^["']|["']$/g, '');
      setGeminiKey(keyValue);
    }
    if (enabledSetting?.value !== undefined) {
      setGeminiEnabled(Boolean(enabledSetting.value));
    }
    if (projectNameSetting?.value) {
      setGeminiProjectName(String(projectNameSetting.value));
    }

    setLoading(false);
  };

  const checkSupabaseConnection = async () => {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      setSupabaseStatus('error');
    } else {
      setSupabaseStatus('connected');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showError('Not authenticated');
      setSaving(false);
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    const updates = [
      {
        key: 'api_gemini_key',
        value: geminiKey,
        updated_by: userData?.id,
      },
      {
        key: 'api_gemini_enabled',
        value: geminiEnabled,
        updated_by: userData?.id,
      },
      {
        key: 'api_gemini_project_name',
        value: geminiProjectName,
        updated_by: userData?.id,
      },
    ];

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('admin_settings')
        .upsert({
          key: update.key,
          value: update.value,
          category: 'api',
          updated_by: update.updated_by,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (updateError) {
        showError('Failed to save API config: ' + updateError.message);
        setSaving(false);
        return;
      }
    }

    showSuccess('API configuration saved successfully!');
    setSaving(false);
  };

  const handleTestGemini = async (useDirectHttp = false) => {
    if (!geminiKey) {
      showError('Please enter a Gemini API key first');
      return;
    }

    const endpoint = useDirectHttp ? '/api/admin/test-gemini-direct' : '/api/admin/test-gemini';
    const methodName = useDirectHttp ? 'Direct HTTP' : 'SDK';

    // Test API key by making a simple request to the test endpoint
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: geminiKey,
          projectName: geminiProjectName,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showSuccess(`Gemini API connection successful! (${methodName} method)`);
      } else {
        let errorMsg = data.error || 'Unknown error';
        if (data.suggestion) {
          errorMsg += `\n\nSuggestion: ${data.suggestion}`;
        }
        if (data.details) {
          errorMsg += `\n\nDetails: ${data.details}`;
        }
        showError(`Gemini API test failed (${methodName}): ${errorMsg}`);
      }
    } catch (err) {
      showError(`Failed to test Gemini API (${methodName}): ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Validate API key format
  const getApiKeyInfo = () => {
    if (!geminiKey) return null;
    
    const cleaned = geminiKey.trim().replace(/^["']|["']$/g, '');
    const startsWithAIza = cleaned.startsWith('AIza');
    const length = cleaned.length;
    
    return {
      length,
      startsWithAIza,
      isValidFormat: startsWithAIza && length >= 30,
      warning: !startsWithAIza ? 'API key does not start with "AIza" - this is unusual for Gemini API keys' : null,
    };
  };

  const apiKeyInfo = getApiKeyInfo();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          API Configuration
        </Typography>
        <Button
          startIcon={<SaveIcon />}
          onClick={handleSave}
          variant="outlined"
          disabled={saving}
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            fontWeight: 600,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
            '&.Mui-disabled': {
              borderColor: theme.palette.divider,
              color: theme.palette.text.secondary,
            },
          }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary, fontWeight: 600 }}>
              Gemini AI Configuration
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={geminiEnabled}
                    onChange={(e) => setGeminiEnabled(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: theme.palette.text.primary,
                      },
                    }}
                  />
                }
                label="Enable Gemini AI Features"
                sx={{ color: theme.palette.text.primary }}
              />
              <TextField
                label="Gemini API Key"
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                fullWidth
                placeholder="Enter your Gemini API key"
                error={!!(apiKeyInfo && !apiKeyInfo.isValidFormat && geminiKey.length > 0)}
                helperText={
                  apiKeyInfo
                    ? apiKeyInfo.warning
                      ? apiKeyInfo.warning
                      : apiKeyInfo.startsWithAIza
                      ? `API key format looks valid (${apiKeyInfo.length} characters)`
                      : `API key length: ${apiKeyInfo.length} characters`
                    : 'Gemini API keys typically start with "AIza"'
                }
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.text.primary,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiFormHelperText-root': {
                    color: theme.palette.text.secondary,
                  },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        edge="end"
                        sx={{ color: theme.palette.text.secondary }}
                      >
                        {showGeminiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              {apiKeyInfo && apiKeyInfo.warning && (
                <Alert
                  severity="warning"
                  sx={{
                    mt: 1,
                    backgroundColor: theme.palette.action.hover,
                    border: `1px solid ${theme.palette.divider}`,
                    color: theme.palette.text.primary,
                  }}
                >
                  {apiKeyInfo.warning}. If you&apos;re using a Vertex AI key or a different type of key, try the &quot;Test with Direct HTTP&quot; button instead.
                </Alert>
              )}
              <TextField
                label="Project Name"
                type="text"
                value={geminiProjectName}
                onChange={(e) => setGeminiProjectName(e.target.value)}
                fullWidth
                placeholder="Enter your project name/identifier"
                sx={{
                  mt: 2,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.text.primary,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                }}
              />
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => handleTestGemini(false)}
                  disabled={!geminiKey || !geminiEnabled}
                  sx={{
                    borderColor: theme.palette.text.primary,
                    color: theme.palette.text.primary,
                    '&:hover': {
                      borderColor: theme.palette.text.primary,
                      backgroundColor: theme.palette.action.hover,
                    },
                    '&.Mui-disabled': {
                      borderColor: theme.palette.divider,
                      color: theme.palette.text.secondary,
                    },
                  }}
                >
                  Test Connection (SDK)
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTestGemini(true)}
                  disabled={!geminiKey || !geminiEnabled}
                  sx={{
                    borderColor: theme.palette.text.primary,
                    color: theme.palette.text.primary,
                    '&:hover': {
                      borderColor: theme.palette.text.primary,
                      backgroundColor: theme.palette.action.hover,
                    },
                    '&.Mui-disabled': {
                      borderColor: theme.palette.divider,
                      color: theme.palette.text.secondary,
                    },
                  }}
                >
                  Test with Direct HTTP
                </Button>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary, fontWeight: 600 }}>
              Supabase Connection
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                Status:
              </Typography>
              {supabaseStatus === 'checking' && <CircularProgress size={20} sx={{ color: theme.palette.text.primary }} />}
              {supabaseStatus === 'connected' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#4CAF50' }}>
                  <CheckCircleIcon />
                  <Typography sx={{ color: '#4CAF50' }}>Connected</Typography>
                </Box>
              )}
              {supabaseStatus === 'error' && (
                <Typography sx={{ color: theme.palette.text.primary }}>Connection Error</Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

