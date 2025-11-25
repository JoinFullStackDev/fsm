'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Menu,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Card,
  CardContent,
} from '@mui/material';
import {
  Edit as EditIcon,
  Download as DownloadIcon,
  Sync as SyncIcon,
  Fullscreen as FullscreenIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import mermaid from 'mermaid';
import type { TemplateFieldConfig } from '@/types/templates';
import type { ERDData } from '@/types/phases';
import { convertERDToMermaid, validateERD, createEmptyERD } from '@/lib/erd/mermaidConverter';
import { exportToSVG, exportToPNG, exportToPDF, exportToJSON, downloadBlob, downloadString } from '@/lib/erd/export';
import { syncEntitiesToERD } from '@/lib/erd/entitySync';
import ERDEditorModal from './ERDEditorModal';

interface ERDFieldProps {
  field: TemplateFieldConfig;
  value: ERDData | Record<string, unknown>;
  onChange: (value: ERDData | Record<string, unknown>) => void;
  error?: string;
  phaseData?: any;
}

const PREVIEW_MERMAID_ID = 'erd-preview-diagram';

export default function ERDField({ field, value, onChange, error, phaseData }: ERDFieldProps) {
  const config = field.field_config;
  const [erdData, setErdData] = useState<ERDData>(() => {
    // Handle both new structured format and old Record format
    if (value && typeof value === 'object') {
      if ('entities' in value && 'relationships' in value && Array.isArray(value.entities) && Array.isArray(value.relationships)) {
        return value as ERDData;
      }
    }
    return createEmptyERD();
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [renderedSvg, setRenderedSvg] = useState<string>(''); // Store rendered SVG as string
  const mermaidContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      er: {
        fontSize: 12,
      },
    });
  }, []);

  // Update ERD data when value prop changes
  useEffect(() => {
    if (value && typeof value === 'object') {
      if ('entities' in value && 'relationships' in value && Array.isArray(value.entities) && Array.isArray(value.relationships)) {
        setErdData(value as ERDData);
      }
    } else if (!value) {
      setErdData(createEmptyERD());
    }
  }, [value]);

  // Render Mermaid diagram
  useEffect(() => {
    const renderDiagram = async () => {
      if (!mermaidContainerRef.current) return;

      setIsRendering(true);
      setRenderError(null);

      try {
        const validation = validateERD(erdData);
        if (!validation.valid) {
          setRenderError('Invalid ERD structure');
          setIsRendering(false);
          return;
        }

        const mermaidCode = convertERDToMermaid(erdData);
        
        if (!mermaidCode || mermaidCode.trim() === 'erDiagram\n    EMPTY "No entities defined"') {
          setIsRendering(false);
          return;
        }

        const id = `mermaid-preview-${Date.now()}`;
        
        try {
          // Mermaid v10+ uses render() method
          const { svg } = await mermaid.render(id, mermaidCode);
          // Parse SVG and add ID for export functions
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
          const svgElement = svgDoc.querySelector('svg');
          
          if (svgElement) {
            svgElement.id = PREVIEW_MERMAID_ID;
            
            // Style relationship lines: make them thinner and brighter
            // Theme primary light color: #5DFFFF
            const relationshipColor = '#5DFFFF'; // primary.light from theme
            const relationshipStrokeWidth = '1.5'; // Thin line
            
            // Find all paths and lines in the SVG
            const allPaths = svgElement.querySelectorAll('path');
            const allLines = svgElement.querySelectorAll('line');
            
            // Entity boxes in Mermaid ERD are typically rectangles (paths with 4-5 commands: M, L, L, L, Z)
            // Relationship lines are simpler paths (usually 2-3 commands: M, L or M, C, L)
            allPaths.forEach((path) => {
              const d = path.getAttribute('d') || '';
              const fill = path.getAttribute('fill');
              
              // Skip entity boxes (they have fill and are rectangles)
              // Relationship lines typically have no fill or fill="none"
              if (fill && fill !== 'none' && fill !== 'transparent') {
                return; // This is likely an entity box
              }
              
              // Relationship lines are typically simple paths (M...L or M...C...L)
              // They usually don't end with Z (which closes a shape)
              if (d && !d.endsWith('Z') && !d.endsWith('z')) {
                // Count path commands - relationship lines are simpler
                const commands = d.match(/[MLCQZ]/gi) || [];
                // Relationship lines typically have 2-4 commands (M, L, or M, C, L)
                // Entity boxes have 5+ commands (M, L, L, L, Z)
                if (commands.length >= 2 && commands.length <= 4) {
                  path.setAttribute('stroke', relationshipColor);
                  path.setAttribute('stroke-width', relationshipStrokeWidth);
                  path.setAttribute('fill', 'none');
                }
              }
            });
            
            // Style all lines (straight relationship connectors)
            allLines.forEach((line) => {
              line.setAttribute('stroke', relationshipColor);
              line.setAttribute('stroke-width', relationshipStrokeWidth);
            });
            
            // Also check for relationship lines by class/ID if Mermaid adds them
            const relationshipSelectors = [
              '.relationshipLine',
              '.er-relationship',
              '[class*="relationship"]',
              '[id*="relationship"]',
              'g[class*="edge"]', // Mermaid sometimes uses "edge" for relationships
            ];
            
            relationshipSelectors.forEach((selector) => {
              try {
                const elements = svgElement.querySelectorAll(selector);
                elements.forEach((el) => {
                  if (el instanceof SVGPathElement || el instanceof SVGLineElement) {
                    el.setAttribute('stroke', relationshipColor);
                    el.setAttribute('stroke-width', relationshipStrokeWidth);
                    if (el instanceof SVGPathElement) {
                      el.setAttribute('fill', 'none');
                    }
                  } else if (el instanceof SVGGElement) {
                    // If it's a group, style all paths and lines within it
                    const paths = el.querySelectorAll('path');
                    const lines = el.querySelectorAll('line');
                    paths.forEach((p) => {
                      p.setAttribute('stroke', relationshipColor);
                      p.setAttribute('stroke-width', relationshipStrokeWidth);
                      p.setAttribute('fill', 'none');
                    });
                    lines.forEach((l) => {
                      l.setAttribute('stroke', relationshipColor);
                      l.setAttribute('stroke-width', relationshipStrokeWidth);
                    });
                  }
                });
              } catch (e) {
                // Invalid selector, skip
              }
            });
            
            // Get the modified SVG string
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgElement);
            setRenderedSvg(svgString);
          } else {
            setRenderedSvg(svg);
          }
        } catch (err) {
          console.error('Mermaid render error:', err);
          setRenderError(err instanceof Error ? err.message : 'Failed to render diagram');
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        setRenderError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setIsRendering(false);
      }
    };

    if (erdData.entities.length > 0) {
      renderDiagram();
    }
  }, [erdData]);

  const handleEditorSave = (newValue: ERDData) => {
    setErdData(newValue);
    onChange(newValue);
  };

  const handleExport = async (format: 'svg' | 'png' | 'pdf' | 'json') => {
    setExportMenuAnchor(null);

    try {
      switch (format) {
        case 'svg':
          const svg = await exportToSVG(PREVIEW_MERMAID_ID);
          downloadString(svg, 'erd-diagram.svg', 'image/svg+xml');
          break;
        case 'png':
          const pngBlob = await exportToPNG(PREVIEW_MERMAID_ID);
          const pngUrl = URL.createObjectURL(pngBlob);
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = 'erd-diagram.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(pngUrl);
          break;
        case 'pdf':
          await exportToPDF(PREVIEW_MERMAID_ID, 'erd-diagram.pdf');
          break;
        case 'json':
          exportToJSON(erdData, 'erd-data.json');
          break;
      }
    } catch (err) {
      console.error('Export error:', err);
      setRenderError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleSyncFromEntities = () => {
    if (phaseData?.entities && Array.isArray(phaseData.entities)) {
      const syncedERD = syncEntitiesToERD(phaseData.entities, erdData);
      setErdData(syncedERD);
      onChange(syncedERD);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
            {config.label}
          </Typography>
          {config.helpText && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {config.helpText}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {phaseData?.entities && (
            <Tooltip title="Sync from Entities">
              <IconButton
                size="small"
                onClick={handleSyncFromEntities}
                sx={{ color: 'primary.main' }}
                aria-label="Sync ERD from entities"
              >
                <SyncIcon />
              </IconButton>
            </Tooltip>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            sx={{ color: 'primary.main', borderColor: 'primary.main' }}
          >
            Export
          </Button>
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
            PaperProps={{
              sx: {
                backgroundColor: '#000',
                border: '1px solid',
                borderColor: 'primary.main',
              },
            }}
          >
            <MenuItem onClick={() => handleExport('svg')} sx={{ color: 'text.primary' }}>
              <ImageIcon sx={{ mr: 1, fontSize: 20 }} />
              Export as SVG
            </MenuItem>
            <MenuItem onClick={() => handleExport('png')} sx={{ color: 'text.primary' }}>
              <ImageIcon sx={{ mr: 1, fontSize: 20 }} />
              Export as PNG
            </MenuItem>
            <MenuItem onClick={() => handleExport('pdf')} sx={{ color: 'text.primary' }}>
              <PdfIcon sx={{ mr: 1, fontSize: 20 }} />
              Export as PDF
            </MenuItem>
            <MenuItem onClick={() => handleExport('json')} sx={{ color: 'text.primary' }}>
              <CodeIcon sx={{ mr: 1, fontSize: 20 }} />
              Export as JSON
            </MenuItem>
          </Menu>
          <Button
            variant="contained"
            size="small"
            startIcon={<FullscreenIcon />}
            onClick={() => setEditorOpen(true)}
            sx={{ backgroundColor: 'primary.main', color: '#000' }}
          >
            Edit in Full Screen
          </Button>
        </Box>
      </Box>

      {/* Diagram Preview */}
      <Card
        sx={{
          backgroundColor: 'rgba(0, 229, 255, 0.05)',
          border: '1px solid',
          borderColor: 'rgba(0, 229, 255, 0.2)',
          minHeight: 300,
        }}
      >
        <CardContent>
          {isRendering && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress sx={{ color: 'primary.main' }} />
            </Box>
          )}
          {renderError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {renderError}
            </Alert>
          )}
          {!isRendering && erdData.entities.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                No ERD data. Click &quot;Edit in Full Screen&quot; to create your diagram.
              </Typography>
            </Box>
          )}
          {renderedSvg ? (
            <Box
              id={PREVIEW_MERMAID_ID}
              ref={mermaidContainerRef}
              sx={{
                minHeight: 200,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#000',
                borderRadius: 1,
                p: 2,
                '& svg': {
                  maxWidth: '100%',
                  height: 'auto',
                },
              }}
              dangerouslySetInnerHTML={{ __html: renderedSvg }}
            />
          ) : (
            <Box
              id={PREVIEW_MERMAID_ID}
              ref={mermaidContainerRef}
              sx={{
                minHeight: 200,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#000',
                borderRadius: 1,
                p: 2,
              }}
            >
              {!isRendering && erdData.entities.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No diagram to display
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Full Screen Editor Modal */}
      <ERDEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={erdData}
        onChange={handleEditorSave}
        phaseData={phaseData}
      />
    </Box>
  );
}
