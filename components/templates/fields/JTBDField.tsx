'use client';

import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  IconButton,
  Typography,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { TemplateFieldConfig } from '@/types/templates';
import type { JTBD } from '@/types/phases';

interface JTBDFieldProps {
  field: TemplateFieldConfig;
  value: JTBD[];
  onChange: (value: JTBD[]) => void;
  error?: string;
  phaseData?: any;
}

export default function JTBDField({ field, value, onChange, error, phaseData }: JTBDFieldProps) {
  const config = field.field_config;
  const jtbd = Array.isArray(value) ? value : [];

  const addJTBD = () => {
    const newJTBD: JTBD = {
      statement: '',
      persona: '',
      outcome: '',
    };
    onChange([...jtbd, newJTBD]);
  };

  const updateJTBD = (index: number, jtbdItem: JTBD) => {
    const updated = [...jtbd];
    updated[index] = jtbdItem;
    onChange(updated);
  };

  const removeJTBD = (index: number) => {
    onChange(jtbd.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 2 }}>
        {jtbd.map((item, index) => (
          <Grid item xs={12} key={index}>
            <Card
              sx={{
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    JTBD {index + 1}
                  </Typography>
                  <IconButton
                    onClick={() => removeJTBD(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                <TextField
                  fullWidth
                  label="Statement"
                  value={item.statement}
                  onChange={(e) => updateJTBD(index, { ...item, statement: e.target.value })}
                  margin="normal"
                  size="small"
                  placeholder="As a [persona], I want to [action] so that [outcome]"
                />
                <TextField
                  fullWidth
                  label="Persona"
                  value={item.persona}
                  onChange={(e) => updateJTBD(index, { ...item, persona: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Outcome"
                  value={item.outcome}
                  onChange={(e) => updateJTBD(index, { ...item, outcome: e.target.value })}
                  margin="normal"
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Button
        startIcon={<AddIcon />}
        onClick={addJTBD}
        variant="outlined"
        sx={{
          mt: '1.5rem',
          borderColor: 'primary.main',
          color: 'primary.main',
        }}
      >
        Add JTBD
      </Button>
    </Box>
  );
}

