'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  Chip,
  Tooltip,
  Menu,
  Button,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
  MoreVert as MoreVertIcon,
  DragHandle as DragHandleIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import type { TemplateFieldConfig } from '@/types/templates';

interface TableFieldProps {
  field: TemplateFieldConfig;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  phaseData?: any;
}

interface TableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'date' | 'textarea';
  options?: string[];
  required?: boolean;
}

interface TableData {
  columns: TableColumn[];
  rows: Record<string, any>[];
}

interface EditingCell {
  rowIndex: number;
  columnKey: string;
}

const DEFAULT_COLUMNS: TableColumn[] = [
  { key: 'id', label: 'ID', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea', required: true },
  { key: 'status', label: 'Status', type: 'select', options: ['Pass', 'Fail', 'Pending'], required: false },
];

// Sortable Column Header Component - defined outside to avoid parsing issues
function SortableColumnHeader({ 
  column, 
  colIndex, 
  onMenuOpen,
  theme,
}: { 
  column: TableColumn; 
  colIndex: number;
  onMenuOpen: (e: React.MouseEvent<HTMLElement>, colIndex: number) => void;
  theme: any;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableCell
      ref={setNodeRef}
      style={style}
      sx={{
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        fontWeight: 600,
        minWidth: column.type === 'textarea' ? 250 : 150,
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton
          size="small"
          {...attributes}
          {...listeners}
          sx={{
            p: 0.5,
            cursor: 'grab',
            color: theme.palette.text.secondary,
            '&:hover': {
              color: theme.palette.text.primary,
            },
          }}
        >
          <DragHandleIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {column.label}
          {column.required && (
            <Box component="span" sx={{ color: 'error.main', fontSize: '1.2em', lineHeight: 1 }}>
              *
            </Box>
          )}
        </Typography>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onMenuOpen(e, colIndex);
          }}
          sx={{ ml: 'auto', p: 0.5 }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>
    </TableCell>
  );
}

function TableField({ field, value, onChange, error, phaseData }: TableFieldProps) {
  const theme = useTheme();
  const [tableData, setTableData] = useState<TableData>(() => {
    if (value && typeof value === 'object' && value.columns && value.rows) {
      return value as TableData;
    }
    return {
      columns: DEFAULT_COLUMNS,
      rows: [],
    };
  });

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<{ element: HTMLElement; columnIndex: number } | null>(null);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);
  const [newColumn, setNewColumn] = useState<TableColumn>({
    key: '',
    label: '',
    type: 'text',
    required: false,
  });
  const [csvMenuAnchor, setCsvMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cellInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleTableDataChange = useCallback((newData: TableData) => {
    setTableData(newData);
    onChange(newData);
  }, [onChange]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      if (cellInputRef.current instanceof HTMLInputElement || cellInputRef.current instanceof HTMLTextAreaElement) {
        cellInputRef.current.select();
      }
    }
  }, [editingCell]);

  const handleCellClick = (rowIndex: number, columnKey: string) => {
    const column = tableData.columns.find(col => col.key === columnKey);
    if (!column) return;
    
    // Don't allow editing checkboxes by clicking
    if (column.type === 'checkbox') return;
    
    const currentValue = tableData.rows[rowIndex]?.[columnKey] ?? '';
    setEditingCell({ rowIndex, columnKey });
    setEditingValue(String(currentValue));
  };

  const handleCellBlur = () => {
    if (editingCell) {
      handleCellChange(editingCell.rowIndex, editingCell.columnKey, editingValue);
      setEditingCell(null);
      setEditingValue('');
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingCell) {
        handleCellChange(editingCell.rowIndex, editingCell.columnKey, editingValue);
        setEditingCell(null);
        setEditingValue('');
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditingValue('');
    }
  };

  const handleAddRow = () => {
    const newRow: Record<string, any> = {};
    tableData.columns.forEach(col => {
      switch (col.type) {
        case 'checkbox':
          newRow[col.key] = false;
          break;
        case 'number':
          newRow[col.key] = 0;
          break;
        case 'select':
          newRow[col.key] = col.options?.[0] || '';
          break;
        default:
          newRow[col.key] = '';
      }
    });
    handleTableDataChange({
      ...tableData,
      rows: [...tableData.rows, newRow],
    });
  };

  const handleDeleteRow = (index: number) => {
    handleTableDataChange({
      ...tableData,
      rows: tableData.rows.filter((_, i) => i !== index),
    });
  };

  const handleCellChange = (rowIndex: number, columnKey: string, newValue: any) => {
    const newRows = [...tableData.rows];
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = {};
    }
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      [columnKey]: newValue,
    };
    handleTableDataChange({
      ...tableData,
      rows: newRows,
    });
  };

  const handleColumnMenuOpen = (event: React.MouseEvent<HTMLElement>, columnIndex: number) => {
    event.stopPropagation();
    setColumnMenuAnchor({ element: event.currentTarget, columnIndex });
  };

  const handleColumnMenuClose = () => {
    setColumnMenuAnchor(null);
  };

  const handleEditColumn = (columnIndex: number) => {
    setEditingColumnIndex(columnIndex);
    setNewColumn({ ...tableData.columns[columnIndex] });
    setColumnDialogOpen(true);
    handleColumnMenuClose();
  };

  const handleAddColumn = () => {
    setEditingColumnIndex(null);
    setNewColumn({
      key: '',
      label: '',
      type: 'text',
      required: false,
    });
    setColumnDialogOpen(true);
    handleColumnMenuClose();
  };

  const handleDeleteColumn = (columnIndex: number) => {
    const columnToDelete = tableData.columns[columnIndex];
    const newColumns = tableData.columns.filter((_, i) => i !== columnIndex);
    const newRows = tableData.rows.map(row => {
      const newRow = { ...row };
      delete newRow[columnToDelete.key];
      return newRow;
    });
    handleTableDataChange({
      columns: newColumns,
      rows: newRows,
    });
    handleColumnMenuClose();
  };

  const handleSaveColumn = () => {
    if (!newColumn.key || !newColumn.label) {
      return;
    }

    const keyExists = tableData.columns.some(
      (col, index) => col.key === newColumn.key && index !== editingColumnIndex
    );

    if (keyExists) {
      alert('Column key already exists');
      return;
    }

    if (editingColumnIndex !== null) {
      const oldKey = tableData.columns[editingColumnIndex].key;
      const newColumns = [...tableData.columns];
      newColumns[editingColumnIndex] = newColumn;

      let newRows = tableData.rows;
      if (oldKey !== newColumn.key) {
        newRows = tableData.rows.map(row => {
          const newRow = { ...row };
          if (oldKey in newRow) {
            newRow[newColumn.key] = newRow[oldKey];
            delete newRow[oldKey];
          }
          return newRow;
        });
      }

      newRows = newRows.map(row => {
        if (!(newColumn.key in row)) {
          switch (newColumn.type) {
            case 'checkbox':
              row[newColumn.key] = false;
              break;
            case 'number':
              row[newColumn.key] = 0;
              break;
            case 'select':
              row[newColumn.key] = newColumn.options?.[0] || '';
              break;
            default:
              row[newColumn.key] = '';
          }
        }
        return row;
      });

      handleTableDataChange({
        columns: newColumns,
        rows: newRows,
      });
    } else {
      const newRows = tableData.rows.map(row => {
        const newRow = { ...row };
        switch (newColumn.type) {
          case 'checkbox':
            newRow[newColumn.key] = false;
            break;
          case 'number':
            newRow[newColumn.key] = 0;
            break;
          case 'select':
            newRow[newColumn.key] = newColumn.options?.[0] || '';
            break;
          default:
            newRow[newColumn.key] = '';
        }
        return newRow;
      });

      handleTableDataChange({
        columns: [...tableData.columns, newColumn],
        rows: newRows,
      });
    }

    setColumnDialogOpen(false);
    setNewColumn({
      key: '',
      label: '',
      type: 'text',
      required: false,
    });
  };

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        alert('CSV file is empty');
        return;
      }

      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row: Record<string, any> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      const columns: TableColumn[] = headers.map(header => ({
        key: header.toLowerCase().replace(/\s+/g, '_'),
        label: header,
        type: 'text',
        required: false,
      }));

      handleTableDataChange({
        columns,
        rows,
      });

      alert(`Imported ${rows.length} rows from CSV`);
      // Optionally open fullscreen after import
      setIsFullscreen(true);
    };

    reader.readAsText(file);
    event.target.value = '';
    setCsvMenuAnchor(null);
  };

  const handleCSVExport = () => {
    if (tableData.rows.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = tableData.columns.map(col => col.label);
    const csvRows = [
      headers.join(','),
      ...tableData.rows.map(row =>
        tableData.columns.map(col => {
          const value = row[col.key] ?? '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${field.field_config.label || 'table'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCsvMenuAnchor(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    // Only allow dragging column headers, not table cells
    const target = event.activatorEvent?.target as HTMLElement;
    if (target && !target.closest('[data-drag-handle]') && !target.closest('button')) {
      // This is a cell click, not a drag - cancel the drag
      return;
    }
    setActiveColumnId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveColumnId(null);

    if (over && active.id !== over.id) {
      const oldIndex = tableData.columns.findIndex(col => col.key === active.id);
      const newIndex = tableData.columns.findIndex(col => col.key === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newColumns = arrayMove(tableData.columns, oldIndex, newIndex);
        handleTableDataChange({
          ...tableData,
          columns: newColumns,
        });
      }
    }
  };

  // Render cell for editable table (fullscreen only)
  const renderCell = (row: Record<string, any>, column: TableColumn, rowIndex: number) => {
    const value = row[column.key] ?? '';
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnKey === column.key;

    if (column.type === 'checkbox') {
      return (
        <Checkbox
          checked={Boolean(value)}
          onChange={(e) => handleCellChange(rowIndex, column.key, e.target.checked)}
          size="small"
          sx={{ p: 0.5 }}
        />
      );
    }

    if (isEditing) {
      const editingColumn = tableData.columns.find(col => col.key === editingCell?.columnKey);
      if (editingColumn?.type === 'textarea') {
        return (
          <TextField
            inputRef={cellInputRef}
            multiline
            rows={3}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleCellKeyDown}
            size="small"
            variant="outlined"
            sx={{
              width: '100%',
              '& .MuiOutlinedInput-root': {
                padding: '4px 8px',
              },
            }}
            autoFocus
          />
        );
      } else if (editingColumn?.type === 'select') {
        return (
          <FormControl size="small" sx={{ width: '100%', minWidth: 120 }}>
            <Select
              value={editingValue}
              onChange={(e) => {
                handleCellChange(rowIndex, editingColumn.key, e.target.value);
                setEditingCell(null);
                setEditingValue('');
              }}
              onBlur={handleCellBlur}
              autoFocus
              MenuProps={{
                onClose: handleCellBlur,
              }}
            >
              {editingColumn.options?.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      } else {
        return (
          <TextField
            inputRef={cellInputRef}
            type={editingColumn?.type === 'number' ? 'number' : editingColumn?.type === 'date' ? 'date' : 'text'}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleCellKeyDown}
            size="small"
            variant="outlined"
            sx={{
              width: '100%',
              '& .MuiOutlinedInput-root': {
                padding: '4px 8px',
              },
            }}
            autoFocus
          />
        );
      }
    }

    // Display mode - show value as text (clickable to edit)
    const displayValue = value === null || value === undefined ? '' : String(value);
    return (
      <Box
        onClick={(e) => {
          e.stopPropagation();
          handleCellClick(rowIndex, column.key);
        }}
        sx={{
          width: '100%',
          minHeight: '32px',
          padding: '8px',
          cursor: 'text',
          display: 'flex',
          alignItems: 'center',
          border: '1px solid transparent',
          borderRadius: '4px',
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 1000,
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'primary.main',
          },
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: displayValue ? 'text.primary' : 'text.disabled',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            pointerEvents: 'none',
          }}
        >
          {displayValue || 'Click to edit...'}
        </Typography>
      </Box>
    );
  };

  // Render read-only cell for preview
  const renderPreviewCell = (row: Record<string, any>, column: TableColumn) => {
    const value = row[column.key] ?? '';
    const displayValue = value === null || value === undefined ? '' : String(value);

    if (column.type === 'checkbox') {
      return (
        <Checkbox
          checked={Boolean(value)}
          disabled
          size="small"
          sx={{ p: 0.5 }}
        />
      );
    }

    return (
      <Typography
        variant="body2"
        sx={{
          color: displayValue ? 'text.primary' : 'text.disabled',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '8px',
        }}
      >
        {displayValue || '-'}
      </Typography>
    );
  };

  const renderTable = (isFullscreenMode = false) => (
    <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <TableContainer
          component={Paper}
          sx={{
            maxHeight: 'calc(100vh - 200px)',
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            '& .MuiTableCell-root': {
              borderRight: '1px solid',
              borderRightColor: 'divider',
              padding: '4px 8px',
              '&:last-child': {
                borderRight: 'none',
              },
            },
          }}
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <SortableContext
                  items={tableData.columns.map(col => col.key)}
                  strategy={horizontalListSortingStrategy}
                >
                  {tableData.columns.map((column, colIndex) => (
                    <SortableColumnHeader 
                      key={column.key} 
                      column={column} 
                      colIndex={colIndex}
                      onMenuOpen={handleColumnMenuOpen}
                      theme={theme}
                    />
                  ))}
                </SortableContext>
                <TableCell
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    width: 120,
                    position: 'relative',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Actions
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => setCsvMenuAnchor(e.currentTarget)}
                      sx={{ ml: 'auto', p: 0.5 }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
          <TableBody>
            {tableData.rows.map((row, rowIndex) => (
              <TableRow key={rowIndex} hover>
                {tableData.columns.map((column) => (
                  <TableCell key={column.key} sx={{ padding: '4px 8px' }}>
                    {renderCell(row, column, rowIndex)}
                  </TableCell>
                ))}
                <TableCell sx={{ padding: '4px 8px' }}>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteRow(rowIndex)}
                    sx={{ color: 'error.main', p: 0.5 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {/* Add Row Button Row */}
            <TableRow>
              <TableCell
                colSpan={tableData.columns.length + 1}
                sx={{
                  padding: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderTop: '2px solid',
                  borderTopColor: 'divider',
                }}
              >
                <Box
                  onClick={handleAddRow}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px dashed',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    },
                  }}
                >
                  <AddIcon fontSize="small" />
                  <Typography variant="body2">Add Row</Typography>
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <DragOverlay>
        {activeColumnId ? (
          <Box
            sx={{
              backgroundColor: 'background.paper',
              border: '2px solid',
              borderColor: 'primary.main',
              padding: '8px 12px',
              borderRadius: '4px',
              minWidth: 150,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
              {tableData.columns.find(col => col.key === activeColumnId)?.label || 'Column'}
            </Typography>
          </Box>
        ) : null}
      </DragOverlay>
      </DndContext>
  );

  // Render preview table (read-only, limited rows)
  const renderPreview = () => {
    const previewRows = tableData.rows.slice(0, 10);
    const totalRows = tableData.rows.length;
    const hasMoreRows = totalRows > 10;

    return (
      <Box>
        {/* Action Buttons */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 2, gap: { xs: 2, md: 0 } }}>
          <Typography variant="h6" sx={{ color: 'text.primary' }}>
            {field.field_config.label || 'Table'}
            {field.field_config.required && (
              <Box component="span" sx={{ color: 'error.main', fontSize: '1.2em', lineHeight: 1, ml: 0.5 }}>
                *
              </Box>
            )}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', md: 'auto' } }}>
            <input
              accept=".csv"
              style={{ display: 'none' }}
              id={`csv-upload-preview-${field.field_key}`}
              type="file"
              onChange={handleCSVImport}
            />
            <Button
              component="label"
              htmlFor={`csv-upload-preview-${field.field_key}`}
              startIcon={<FileUploadIcon />}
              size="small"
              sx={{ color: 'text.secondary', flex: { xs: 1, md: '0 0 auto' } }}
            >
              Import CSV
            </Button>
            <Button
              onClick={handleCSVExport}
              disabled={tableData.rows.length === 0}
              startIcon={<FileDownloadIcon />}
              size="small"
              sx={{ color: 'text.secondary', flex: { xs: 1, md: '0 0 auto' } }}
            >
              Export CSV
            </Button>
            <Button
              variant="contained"
              onClick={() => setIsFullscreen(true)}
              startIcon={<FullscreenIcon />}
              size="small"
              sx={{
                backgroundColor: 'primary.main',
                color: '#000',
                flex: { xs: 1, md: '0 0 auto' },
              }}
            >
              Open Editor
            </Button>
          </Box>
        </Box>

        {/* Preview Table */}
        {tableData.rows.length === 0 ? (
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              No data in table. Click &quot;Open Editor&quot; to add rows.
            </Typography>
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              '& .MuiTableCell-root': {
                borderRight: '1px solid',
                borderRightColor: 'divider',
                padding: '4px 8px',
                '&:last-child': {
                  borderRight: 'none',
                },
              },
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  {tableData.columns.map((column) => (
                    <TableCell
                      key={column.key}
                      sx={{
                        backgroundColor: 'background.paper',
                        color: 'primary.main',
                        fontWeight: 600,
                        minWidth: column.type === 'textarea' ? 250 : 150,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {column.label}
                        {column.required && (
                          <Box component="span" sx={{ color: 'error.main', fontSize: '1.2em', lineHeight: 1 }}>
                            *
                          </Box>
                        )}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewRows.map((row, rowIndex) => (
                  <TableRow key={rowIndex} hover>
                    {tableData.columns.map((column) => (
                      <TableCell key={column.key} sx={{ padding: '4px 8px' }}>
                        {renderPreviewCell(row, column)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {hasMoreRows && (
                  <TableRow>
                    <TableCell
                      colSpan={tableData.columns.length}
                      sx={{
                        textAlign: 'center',
                        padding: '16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderTop: '2px solid',
                        borderTopColor: 'divider',
                      }}
                    >
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Showing {previewRows.length} of {totalRows} rows. Click &quot;Open Editor&quot; to view/edit all rows.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Preview Table View */}
      {renderPreview()}

      {/* Column Menu - Outside DndContext to avoid positioning issues */}
      {columnMenuAnchor && (
        <Menu
          anchorEl={columnMenuAnchor.element}
          open={Boolean(columnMenuAnchor)}
          onClose={handleColumnMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          slotProps={{
            paper: {
              sx: {
                mt: 0.5,
              },
            },
          }}
        >
        <MenuItem onClick={() => handleEditColumn(columnMenuAnchor!.columnIndex)}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit Column
        </MenuItem>
        {tableData.columns.length > 1 && (
          <MenuItem onClick={() => handleDeleteColumn(columnMenuAnchor!.columnIndex)}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete Column
          </MenuItem>
        )}
        <MenuItem onClick={handleAddColumn}>
          <AddIcon fontSize="small" sx={{ mr: 1 }} />
          Add Column
        </MenuItem>
        </Menu>
      )}

      {/* CSV Menu (for fullscreen editor) */}
      <Menu
        anchorEl={csvMenuAnchor}
        open={Boolean(csvMenuAnchor)}
        onClose={() => setCsvMenuAnchor(null)}
      >
        <MenuItem>
          <input
            accept=".csv"
            style={{ display: 'none' }}
            id={`csv-upload-fullscreen-${field.field_key}`}
            type="file"
            onChange={handleCSVImport}
          />
          <label htmlFor={`csv-upload-fullscreen-${field.field_key}`} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%' }}>
            <FileUploadIcon fontSize="small" sx={{ mr: 1 }} />
            Import CSV
          </label>
        </MenuItem>
        <MenuItem onClick={handleCSVExport} disabled={tableData.rows.length === 0}>
          <FileDownloadIcon fontSize="small" sx={{ mr: 1 }} />
          Export CSV
        </MenuItem>
      </Menu>

      {/* Column Configuration Dialog */}
      <Dialog
        open={columnDialogOpen}
        onClose={() => setColumnDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#000',
            border: '1px solid',
            borderColor: 'primary.main',
          },
        }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>
          {editingColumnIndex !== null ? 'Edit Column' : 'Add Column'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Column Key"
              value={newColumn.key}
              onChange={(e) => setNewColumn({ ...newColumn, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              placeholder="e.g., test_case_id"
              required
              helperText="Used internally (lowercase, underscores)"
              disabled={editingColumnIndex !== null}
            />
            <TextField
              label="Column Label"
              value={newColumn.label}
              onChange={(e) => setNewColumn({ ...newColumn, label: e.target.value })}
              placeholder="e.g., Test Case ID"
              required
              helperText="Display name for the column"
            />
            <FormControl fullWidth>
              <InputLabel>Column Type</InputLabel>
              <Select
                value={newColumn.type}
                onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value as TableColumn['type'] })}
                label="Column Type"
              >
                <MenuItem value="text">Text</MenuItem>
                <MenuItem value="textarea">Textarea</MenuItem>
                <MenuItem value="number">Number</MenuItem>
                <MenuItem value="checkbox">Checkbox</MenuItem>
                <MenuItem value="select">Select (Dropdown)</MenuItem>
                <MenuItem value="date">Date</MenuItem>
              </Select>
            </FormControl>
            {newColumn.type === 'select' && (
              <TextField
                label="Options (comma-separated)"
                value={newColumn.options?.join(', ') || ''}
                onChange={(e) =>
                  setNewColumn({
                    ...newColumn,
                    options: e.target.value.split(',').map(s => s.trim()).filter(s => s),
                  })
                }
                placeholder="e.g., Pass, Fail, Pending"
                helperText="Enter options separated by commas"
              />
            )}
            <FormControlLabel
              control={
                <Checkbox
                  checked={newColumn.required || false}
                  onChange={(e) => setNewColumn({ ...newColumn, required: e.target.checked })}
                />
              }
              label="Required"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColumnDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveColumn}
            variant="contained"
            disabled={!newColumn.key || !newColumn.label}
            sx={{
              backgroundColor: 'primary.main',
              color: '#000',
            }}
          >
            {editingColumnIndex !== null ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fullscreen Dialog */}
      <Dialog
        open={isFullscreen}
        onClose={(event, reason) => {
          // Only close on Escape key, not on backdrop click
          if (reason === 'escapeKeyDown') {
            setIsFullscreen(false);
          }
        }}
        maxWidth={false}
        fullWidth
        disableEscapeKeyDown={false}
        hideBackdrop={false}
        BackdropProps={{
          sx: {
            backgroundColor: '#000',
          },
          onClick: (e) => {
            // Prevent backdrop clicks from doing anything
            e.stopPropagation();
          },
        }}
        PaperProps={{
          sx: {
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            m: 0,
            borderRadius: 0,
            backgroundColor: '#000 !important',
            border: 'none',
            '& .MuiDialog-container': {
              backgroundColor: '#000',
            },
          },
        }}
        sx={{
          '& .MuiDialog-container': {
            backgroundColor: '#000',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000' }}>
          {/* Fullscreen Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              backgroundColor: '#000',
            }}
          >
            <Typography variant="h6" sx={{ color: 'primary.main' }}>
              {field.field_config.label || 'Table'}
            </Typography>
            <IconButton
              onClick={() => setIsFullscreen(false)}
              sx={{ color: 'primary.main' }}
              title="Exit fullscreen"
            >
              <FullscreenExitIcon />
            </IconButton>
          </Box>

          {/* Fullscreen Table Content */}
          <Box 
            sx={{ 
              flex: 1, 
              overflow: 'auto', 
              p: 2, 
              backgroundColor: '#000',
            }}
          >
            {renderTable(true)}
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}

export default React.memo(TableField);
