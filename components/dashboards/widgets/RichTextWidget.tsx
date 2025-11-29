'use client';

import { Card, CardContent, Typography, Box } from '@mui/material';
import ReactMarkdown from 'react-markdown';

interface RichTextWidgetProps {
  widgetId: string;
  dashboardId: string;
  dataset: any;
  settings?: any;
}

export default function RichTextWidget({ widgetId, dashboardId, dataset, settings }: RichTextWidgetProps) {
  const content = dataset.content || settings?.content || '';

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        {settings?.title && (
          <Typography variant="h6" gutterBottom>
            {settings.title}
          </Typography>
        )}
        <Box
          sx={{
            '& p': { marginBottom: 1 },
            '& ul, & ol': { marginLeft: 2, marginBottom: 1 },
            '& h1, & h2, & h3': { marginTop: 2, marginBottom: 1 },
          }}
        >
          {content ? (
            <ReactMarkdown>{content}</ReactMarkdown>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No content. Edit this widget to add text.
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

