'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ReportSlideshowViewer from '@/components/project-management/ReportSlideshowViewer';
import { generateSlideshowHTML } from '@/lib/reports/slideshowGenerator';
import type { WeeklyReportData, MonthlyReportData, ForecastReportData } from '@/lib/reports/dataAggregator';
import type { ReportContent } from '@/lib/reports/aiReportGenerator';

interface ReportData {
  id: string;
  projectName: string;
  reportType: 'weekly' | 'monthly' | 'forecast';
  format: 'pdf' | 'slideshow';
  dateRange: string;
  reportData: WeeklyReportData | MonthlyReportData | ForecastReportData;
  reportContent: ReportContent;
  createdAt: string;
  projectMembers?: Array<{ id: string; name: string | null }>;
}

export default function ReportPage() {
  const theme = useTheme();
  const params = useParams();
  const reportId = params.id as string;
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const response = await fetch(`/api/reports/${reportId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load report');
        }

        const data = await response.json();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    if (reportId) {
      loadReport();
    }
  }, [reportId]);


  const handleDownload = () => {
    if (!report) return;
    
    const html = generateSlideshowHTML({
      projectName: report.projectName,
      reportType: report.reportType,
      dateRange: report.dateRange,
      content: report.reportContent,
      data: report.reportData,
      projectMembers: [],
    });

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.projectName}_${report.reportType}_${new Date(report.createdAt).toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  if (error || !report) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
          p: 4,
        }}
      >
        <Alert 
          severity="error" 
          sx={{ 
            maxWidth: 600,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {error || 'Report not found'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        position: 'relative',
      }}
    >
      {report.format === 'slideshow' && (
        <ReportSlideshowViewer
          projectName={report.projectName}
          reportType={report.reportType}
          dateRange={report.dateRange}
          content={report.reportContent}
          data={report.reportData}
          projectMembers={report.projectMembers}
          onDownload={handleDownload}
        />
      )}
    </Box>
  );
}

