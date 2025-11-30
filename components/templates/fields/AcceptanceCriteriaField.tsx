'use client';

import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  IconButton,
  Grid,
  Typography,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import type { TemplateFieldConfig } from '@/types/templates';
import type { AcceptanceCriteria } from '@/types/phases';

interface AcceptanceCriteriaFieldProps {
  field: TemplateFieldConfig;
  value: AcceptanceCriteria[];
  onChange: (value: AcceptanceCriteria[]) => void;
  error?: string;
  phaseData?: any;
}

export default function AcceptanceCriteriaField({ field, value, onChange, error, phaseData }: AcceptanceCriteriaFieldProps) {
  const config = field.field_config;
  const criteria = Array.isArray(value) ? value : [];

  const addAcceptanceCriteria = () => {
    const newCriteria: AcceptanceCriteria = {
      story_id: '',
      given: '',
      when: '',
      then: '',
    };
    onChange([...criteria, newCriteria]);
  };

  const updateAcceptanceCriteria = (index: number, criteriaItem: AcceptanceCriteria) => {
    const updated = [...criteria];
    updated[index] = criteriaItem;
    onChange(updated);
  };

  const removeAcceptanceCriteria = (index: number) => {
    onChange(criteria.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 2 }}>
        {criteria.map((item, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card
              sx={{
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" sx={{ color: 'primary.main' }}>
                    Criteria {index + 1}
                  </Typography>
                  <IconButton
                    onClick={() => removeAcceptanceCriteria(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <TextField
                  fullWidth
                  label="Story ID"
                  value={item.story_id}
                  onChange={(e) => updateAcceptanceCriteria(index, { ...item, story_id: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Given"
                  value={item.given}
                  onChange={(e) => updateAcceptanceCriteria(index, { ...item, given: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="When"
                  value={item.when}
                  onChange={(e) => updateAcceptanceCriteria(index, { ...item, when: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Then"
                  value={item.then}
                  onChange={(e) => updateAcceptanceCriteria(index, { ...item, then: e.target.value })}
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
        onClick={addAcceptanceCriteria}
        variant="outlined"
        sx={{
          mt: '1.5rem',
          borderColor: 'primary.main',
          color: 'primary.main',
          '&:hover': {
            borderColor: 'primary.light',
            backgroundColor: 'rgba(0, 229, 255, 0.1)',
          },
        }}
      >
        Add Acceptance Criteria
      </Button>
    </Box>
  );
}

