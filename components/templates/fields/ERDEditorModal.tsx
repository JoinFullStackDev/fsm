'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Button,
  Menu,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Code as CodeIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
import type { ERDData } from '@/types/phases';
import { convertERDToMermaid, validateERD, createEmptyERD } from '@/lib/erd/mermaidConverter';
import { exportToSVG, exportToPNG, exportToPDF, exportToJSON, downloadString } from '@/lib/erd/export';
import { syncEntitiesToERD } from '@/lib/erd/entitySync';

interface ERDEditorModalProps {
  open: boolean;
  onClose: () => void;
  value: ERDData;
  onChange: (value: ERDData) => void;
  phaseData?: any; // Phase4Data for entity sync
}

const MERMAID_ID = 'erd-mermaid-diagram';

export default function ERDEditorModal({
  open,
  onClose,
  value,
  onChange,
  phaseData,
}: ERDEditorModalProps) {
  const [jsonValue, setJsonValue] = useState<string>('');
  const [erdData, setErdData] = useState<ERDData>(value || createEmptyERD());
  const [mermaidSyntax, setMermaidSyntax] = useState<string>('');
  const [isValid, setIsValid] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [jsonEditorCollapsed, setJsonEditorCollapsed] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
  const [renderedSvg, setRenderedSvg] = useState<string>(''); // Store rendered SVG as string
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom level (1 = 100%)
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 }); // Pan position
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mermaidContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Callback ref to detect when container is mounted
  const setMermaidContainerRef = useCallback((node: HTMLDivElement | null) => {
    // Use Object.assign to work around readonly ref issue
    if (node && mermaidContainerRef) {
      (mermaidContainerRef as { current: HTMLDivElement | null }).current = node;
    }
    setContainerReady(!!node);
  }, []);

  // Update Mermaid diagram when ERD data changes
  const updateMermaidDiagram = useCallback(async (data: ERDData) => {
    // Wait for container to be available
    let retries = 0;
    while (!mermaidContainerRef.current && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 50));
      retries++;
    }

    if (!mermaidContainerRef.current) {
      console.error('Mermaid container not available after retries');
      setRenderError('Container not ready');
      return;
    }

    setIsRendering(true);
    setRenderError(null);

    try {
      // Validate ERD data
      const validation = validateERD(data);
      setIsValid(validation.valid);
      setValidationErrors(validation.errors);

      if (!validation.valid) {
        setIsRendering(false);
        return;
      }

      // Convert to Mermaid syntax
      const mermaidCode = convertERDToMermaid(data);
      setMermaidSyntax(mermaidCode);

      if (!mermaidCode || mermaidCode.trim() === 'erDiagram\n    EMPTY "No entities defined"') {
        setIsRendering(false);
        return;
      }

      const id = `mermaid-${Date.now()}`;
      
      try {
        // Mermaid v10+ uses render() method
        const { svg } = await mermaid.render(id, mermaidCode);
        // Parse SVG and add ID for export functions
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        
        if (svgElement) {
          svgElement.id = MERMAID_ID;
          // Make SVG responsive by preserving viewBox and making width/height 100%
          const existingViewBox = svgElement.getAttribute('viewBox');
          const existingWidth = svgElement.getAttribute('width');
          const existingHeight = svgElement.getAttribute('height');
          
          // If no viewBox exists, create one from width/height
          if (!existingViewBox && existingWidth && existingHeight) {
            // Extract numeric values (remove 'px' if present)
            const widthNum = parseFloat(existingWidth.replace('px', ''));
            const heightNum = parseFloat(existingHeight.replace('px', ''));
            if (!isNaN(widthNum) && !isNaN(heightNum)) {
              svgElement.setAttribute('viewBox', `0 0 ${widthNum} ${heightNum}`);
            }
          }
          
          // Set responsive dimensions
          svgElement.setAttribute('width', '100%');
          svgElement.setAttribute('height', '100%');
          svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          
          // Ensure all text elements have explicit fill attributes for proper export
          // This is critical for SVG/PNG/PDF exports to show text
          // Force a reflow to ensure styles are computed
          if (svgElement instanceof HTMLElement) {
            svgElement.offsetHeight; // Force reflow
          }
          
          const allTextElements = svgElement.querySelectorAll('text, tspan');
          allTextElements.forEach((textEl) => {
            // Skip empty text elements
            if (!textEl.textContent || textEl.textContent.trim() === '') {
              return;
            }
            
            // Get computed style to check the actual color
            const computedStyle = window.getComputedStyle(textEl as Element);
            let fill = computedStyle.fill || computedStyle.color || '';
            
            // Check if the fill is too dark (matches background) - convert to hex and check brightness
            const isDarkColor = (color: string): boolean => {
              if (!color || color === 'none' || color === 'transparent' || color === 'currentColor') {
                return true;
              }
              // Check if it's a dark color (like #0a0e27 background)
              if (color.toLowerCase().includes('#0a0e27') || 
                  color.toLowerCase().includes('#121633') ||
                  color.toLowerCase().includes('rgb(10, 14, 39)') ||
                  color.toLowerCase().includes('rgb(18, 22, 51)')) {
                return true;
              }
              return false;
            };
            
            // If fill is dark, transparent, or invalid, force to white
            if (!fill || isDarkColor(fill) || fill === 'none' || fill === 'transparent' || fill === 'currentColor' || fill === 'rgba(0, 0, 0, 0)') {
              fill = '#ffffff'; // Force white for visibility on dark background
            }
            
            // Also check if there's a style attribute that might have a dark color
            const styleAttr = textEl.getAttribute('style');
            if (styleAttr && styleAttr.includes('fill:')) {
              const fillMatch = styleAttr.match(/fill:\s*([^;]+)/);
              if (fillMatch && fillMatch[1] && !isDarkColor(fillMatch[1].trim())) {
                fill = fillMatch[1].trim();
              }
            }
            
            // Check parent groups for fill color (text might inherit)
            let parent: Element | null = textEl.parentElement;
            while (parent && parent !== svgElement && parent instanceof Element && isDarkColor(fill)) {
              const parentFill = window.getComputedStyle(parent as Element).fill;
              if (parentFill && !isDarkColor(parentFill) && parentFill !== 'none' && parentFill !== 'transparent') {
                fill = parentFill;
                break;
              }
              parent = parent.parentElement;
            }
            
            // Final check - if still dark or invalid, force white
            if (isDarkColor(fill) || !fill || fill === 'none' || fill === 'transparent' || fill === 'currentColor') {
              fill = '#ffffff';
            }
            
            // Always set explicit fill attribute (required for SVG export)
            textEl.setAttribute('fill', fill);
            
            // Also set it in the style attribute as backup
            const currentStyle = textEl.getAttribute('style') || '';
            const newStyle = currentStyle.replace(/fill:\s*[^;]+;?/gi, '').replace(/;;+/g, ';').trim();
            textEl.setAttribute('style', newStyle ? `${newStyle}; fill: ${fill};` : `fill: ${fill};`);
            
            // Ensure font size is reasonable (not 0 or too small)
            const fontSize = computedStyle.fontSize || textEl.getAttribute('font-size') || '14px';
            const fontSizeNum = parseFloat(fontSize);
            if (!fontSizeNum || fontSizeNum < 8) {
              textEl.setAttribute('font-size', '14px');
            } else if (!textEl.getAttribute('font-size')) {
              textEl.setAttribute('font-size', fontSize);
            }
            
            // Also ensure font properties are set
            if (!textEl.getAttribute('font-family')) {
              const fontFamily = computedStyle.fontFamily || 'Arial, sans-serif';
              textEl.setAttribute('font-family', fontFamily);
            }
            
            // Remove any opacity that might make text invisible
            if (textEl.getAttribute('opacity') === '0') {
              textEl.removeAttribute('opacity');
            }
          });
          
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
            const stroke = path.getAttribute('stroke');
            
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
          
          // Process the SVG string to ensure all text has fill attributes
          // This is critical because serialization might lose some computed styles
          const serializer = new XMLSerializer();
          let svgString = serializer.serializeToString(svgElement);
          
          // Parse the string again and ensure all text elements have explicit fill
          const parser = new DOMParser();
          const processedDoc = parser.parseFromString(svgString, 'image/svg+xml');
          const processedSvg = processedDoc.querySelector('svg');
          
          if (processedSvg) {
            // Find all text elements in the processed SVG (including in groups)
            const processedTextElements = processedSvg.querySelectorAll('text, tspan');
            processedTextElements.forEach((textEl) => {
              // Skip empty text
              if (!textEl.textContent || textEl.textContent.trim() === '') {
                return;
              }
              
              let fill = textEl.getAttribute('fill');
              
              // Check parent groups for inherited fill
              if (!fill || fill === 'none' || fill === 'transparent' || fill === 'currentColor') {
                let parent: Element | null = textEl.parentElement;
                while (parent && parent !== processedSvg && parent instanceof Element) {
                  const parentFill = parent.getAttribute('fill');
                  if (parentFill && parentFill !== 'none' && parentFill !== 'transparent') {
                    fill = parentFill;
                    break;
                  }
                  parent = parent.parentElement;
                }
              }
              
              // If no fill or invalid fill, set to white
              if (!fill || fill === 'none' || fill === 'transparent' || fill === 'currentColor') {
                fill = '#ffffff';
              }
              
              // Always set explicit fill
              textEl.setAttribute('fill', fill);
              
              // Remove stroke that might interfere
              if (textEl.getAttribute('stroke') === 'none') {
                textEl.removeAttribute('stroke');
              }
              
              // Ensure style attribute has fill
              let style = textEl.getAttribute('style') || '';
              style = style.replace(/fill:\s*[^;]+;?/gi, '').trim();
              textEl.setAttribute('style', style ? `${style}; fill: ${fill};` : `fill: ${fill};`);
            });
            
            // Also set fill on groups that contain text
            const groups = processedSvg.querySelectorAll('g');
            groups.forEach((group) => {
              const hasText = group.querySelector('text, tspan');
              if (hasText && !group.getAttribute('fill')) {
                group.setAttribute('fill', '#ffffff');
              }
            });
            
            // Re-serialize with processed text
            svgString = serializer.serializeToString(processedSvg);
          }
          
          // Store the SVG string and let React render it via dangerouslySetInnerHTML
          // This avoids React trying to manage nodes we manually manipulate
          setRenderedSvg(svgString);
        } else {
          setRenderedSvg(svg);
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        setRenderError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    } catch (err) {
      console.error('Error updating diagram:', err);
      setRenderError(err instanceof Error ? err.message : 'Failed to update diagram');
    } finally {
      setIsRendering(false);
    }
  }, []);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      er: {
        fontSize: 14,
      },
    });
  }, []);

  // Initialize JSON value when modal opens
  useEffect(() => {
    if (open) {
      // Handle both new structured format and old Record format
      let initialData: ERDData;
      if (value && typeof value === 'object') {
        if ('entities' in value && 'relationships' in value && Array.isArray(value.entities) && Array.isArray(value.relationships)) {
          initialData = value as ERDData;
        } else {
          // Old format or invalid, create empty
          initialData = createEmptyERD();
        }
      } else {
        initialData = createEmptyERD();
      }

      setErdData(initialData);
      setJsonValue(JSON.stringify(initialData, null, 2));
      setRenderedSvg(''); // Clear previous SVG
      setZoomLevel(1); // Reset zoom when opening
      setPanPosition({ x: 0, y: 0 }); // Reset pan when opening
    }
  }, [open, value]);

  // Render diagram when container is ready and data is available
  useEffect(() => {
    if (open && containerReady && erdData) {
      updateMermaidDiagram(erdData);
    }
  }, [open, containerReady, erdData, updateMermaidDiagram]);

  // Handle JSON editor changes with debounce
  const handleJsonChange = useCallback((newValue: string | undefined) => {
    if (newValue === undefined) return;

    setJsonValue(newValue);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce JSON parsing and diagram update
    debounceTimerRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(newValue) as ERDData;
        setErdData(parsed);
        updateMermaidDiagram(parsed);
      } catch (err) {
        setIsValid(false);
        setValidationErrors([err instanceof Error ? err.message : 'Invalid JSON syntax']);
      }
    }, 500);
  }, [updateMermaidDiagram]);

  // Handle save
  const handleSave = () => {
    if (isValid && !isRendering) {
      onChange(erdData);
      onClose();
    }
  };

  // Handle export
  const handleExport = async (format: 'svg' | 'png' | 'pdf' | 'json') => {
    setExportMenuAnchor(null);

    try {
      switch (format) {
        case 'svg':
          const svg = await exportToSVG(MERMAID_ID);
          downloadString(svg, 'erd-diagram.svg', 'image/svg+xml');
          break;
        case 'png':
          const pngBlob = await exportToPNG(MERMAID_ID);
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
          await exportToPDF(MERMAID_ID, 'erd-diagram.pdf');
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

  // Handle sync from entities
  const handleSyncFromEntities = () => {
    if (phaseData?.entities && Array.isArray(phaseData.entities)) {
      const syncedERD = syncEntitiesToERD(phaseData.entities, erdData);
      setErdData(syncedERD);
      setJsonValue(JSON.stringify(syncedERD, null, 2));
      updateMermaidDiagram(syncedERD);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
          m: 0,
          borderRadius: 0,
          backgroundColor: '#121633 !important',
          border: 'none',
        },
      }}
      sx={{
        '& .MuiDialog-container': {
          backgroundColor: '#121633',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
          pb: 2,
          backgroundColor: '#121633',
        }}
      >
        <Typography variant="h6" sx={{ color: 'text.primary' }}>
          ERD Editor
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isValid && !isRendering && (
            <Tooltip title="Valid ERD">
              <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
            </Tooltip>
          )}
          {!isValid && (
            <Tooltip title="Invalid ERD">
              <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
            </Tooltip>
          )}
          {phaseData?.entities && (
            <Tooltip title="Sync from Entities">
              <IconButton
                size="small"
                onClick={handleSyncFromEntities}
                sx={{ color: 'primary.main' }}
              >
                <SyncIcon />
              </IconButton>
            </Tooltip>
          )}
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            size="small"
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
                backgroundColor: '#121633',
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
            onClick={handleSave}
            disabled={!isValid || isRendering}
            size="small"
            sx={{ backgroundColor: 'primary.main', color: '#000' }}
          >
            Save
          </Button>
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', height: 'calc(100vh - 80px)' }}>
        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ m: 2, mb: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Validation Errors:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((error, index) => (
                <li key={index}>
                  <Typography variant="body2">{error}</Typography>
                </li>
              ))}
            </ul>
          </Alert>
        )}
        {renderError && (
          <Alert severity="error" sx={{ m: 2, mb: 0 }}>
            {renderError}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* JSON Editor - Left Side (Collapsible) */}
          <Box
            sx={{
              width: jsonEditorCollapsed ? 0 : '50%',
              borderRight: jsonEditorCollapsed ? 'none' : '1px solid rgba(0, 229, 255, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'width 0.3s ease',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                p: 1,
                borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                JSON Editor
              </Typography>
              <IconButton
                size="small"
                onClick={() => setJsonEditorCollapsed(true)}
                sx={{ color: 'text.secondary' }}
              >
                <ChevronLeftIcon />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <Editor
                height="100%"
                defaultLanguage="json"
                value={jsonValue}
                onChange={handleJsonChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </Box>
          </Box>

          {/* Collapse/Expand Button */}
          {jsonEditorCollapsed && (
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
              }}
            >
              <IconButton
                onClick={() => setJsonEditorCollapsed(false)}
                sx={{
                  color: 'primary.main',
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 229, 255, 0.2)',
                  },
                }}
              >
                <ChevronRightIcon />
              </IconButton>
            </Box>
          )}

          {/* Mermaid Diagram - Right Side */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}
          >
            <Box
              sx={{
                p: 1,
                borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                Diagram Preview
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isRendering && (
                  <CircularProgress size={16} sx={{ color: 'primary.main' }} />
                )}
                {renderedSvg && (
                  <>
                    <Tooltip title="Zoom Out">
                      <IconButton
                        size="small"
                        onClick={() => setZoomLevel((prev) => Math.max(0.25, prev - 0.25))}
                        sx={{ color: 'primary.main' }}
                      >
                        <ZoomOutIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 45, textAlign: 'center' }}>
                      {Math.round(zoomLevel * 100)}%
                    </Typography>
                    <Tooltip title="Zoom In">
                      <IconButton
                        size="small"
                        onClick={() => setZoomLevel((prev) => Math.min(10, prev + 0.25))}
                        sx={{ color: 'primary.main' }}
                      >
                        <ZoomInIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reset Zoom & Pan">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setZoomLevel(1);
                          setPanPosition({ x: 0, y: 0 });
                        }}
                        sx={{ color: 'primary.main' }}
                      >
                        <FitScreenIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Box>
            {renderedSvg ? (
              <Box
                id={MERMAID_ID}
                ref={setMermaidContainerRef}
                sx={{
                  flex: 1,
                  p: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#0a0e27',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  '& .diagram-wrapper': {
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    height: '100%',
                    userSelect: 'none',
                  },
                  '& svg': {
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    pointerEvents: 'none',
                  },
                }}
                onMouseDown={(e) => {
                  if (zoomLevel > 1) {
                    e.preventDefault();
                    setIsDragging(true);
                    setDragStart({
                      x: e.clientX - panPosition.x,
                      y: e.clientY - panPosition.y,
                    });
                  }
                }}
                onMouseMove={(e) => {
                  if (isDragging && zoomLevel > 1) {
                    e.preventDefault();
                    setPanPosition({
                      x: e.clientX - dragStart.x,
                      y: e.clientY - dragStart.y,
                    });
                  }
                }}
                onMouseUp={() => {
                  setIsDragging(false);
                }}
                onMouseLeave={() => {
                  setIsDragging(false);
                }}
                onWheel={(e) => {
                  // Zoom with Ctrl/Cmd + mouse wheel
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    setZoomLevel((prev) => {
                      const newZoom = Math.max(0.25, Math.min(10, prev + delta));
                      // Reset pan when zooming back to 1x or below
                      if (newZoom <= 1) {
                        setPanPosition({ x: 0, y: 0 });
                      }
                      return newZoom;
                    });
                  }
                }}
              >
                <div
                  className="diagram-wrapper"
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />
              </Box>
            ) : (
              <Box
                id={MERMAID_ID}
                ref={setMermaidContainerRef}
                sx={{
                  flex: 1,
                  p: 3,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#0a0e27',
                  overflow: 'auto',
                }}
              >
                {!isRendering && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Enter valid ERD JSON to see the diagram
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

