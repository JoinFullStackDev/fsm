'use client';

import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Button,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

interface ReportSlideshowProps {
  open: boolean;
  html: string;
  filename: string;
  onClose: () => void;
}

export default function ReportSlideshow({
  open,
  html,
  filename,
  onClose,
}: ReportSlideshowProps) {

  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
          margin: 0,
          backgroundColor: '#121633',
        },
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Close button */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1001,
            display: 'flex',
            gap: 1,
          }}
        >
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            sx={{
              borderColor: '#00E5FF',
              color: '#00E5FF',
              '&:hover': {
                borderColor: '#00E5FF',
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
              },
            }}
          >
            Download
          </Button>
          <IconButton
            onClick={onClose}
            sx={{
              color: '#00E5FF',
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.2)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Slideshow iframe */}
        <iframe
          srcDoc={html}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#121633',
          }}
          title="Report Slideshow"
          sandbox="allow-scripts allow-same-origin"
        />
      </DialogContent>
    </Dialog>
  );
}

