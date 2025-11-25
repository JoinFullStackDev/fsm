'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import {
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';

export type SortDirection = 'asc' | 'desc' | null;

interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string | number;
}

interface SortableTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

function SortableHeader<T>({
  column,
  sortField,
  sortDirection,
  onSort,
}: {
  column: Column<T>;
  sortField: keyof T | string | null;
  sortDirection: SortDirection;
  onSort: (field: keyof T | string) => void;
}) {
  const isActive = sortField === column.key;
  const direction = isActive ? sortDirection : null;

  if (!column.sortable) {
    return (
      <TableCell
        sx={{
          backgroundColor: '#000',
          color: '#00E5FF',
          fontWeight: 600,
          borderBottom: '2px solid rgba(0, 229, 255, 0.2)',
          width: column.width,
          textAlign: column.align || 'left',
        }}
      >
        {column.label}
      </TableCell>
    );
  }

  return (
    <TableCell
      sx={{
        backgroundColor: '#000',
        color: '#00E5FF',
        fontWeight: 600,
        cursor: 'pointer',
        userSelect: 'none',
        borderBottom: '2px solid rgba(0, 229, 255, 0.2)',
        width: column.width,
        textAlign: column.align || 'left',
        '&:hover': {
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
        },
      }}
      onClick={() => onSort(column.key)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {column.label}
        <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5 }}>
          <ArrowUpwardIcon
            sx={{
              fontSize: 14,
              color: isActive && direction === 'asc' ? '#00E5FF' : 'rgba(176, 176, 176, 0.3)',
              opacity: isActive && direction === 'asc' ? 1 : 0.5,
            }}
          />
          <ArrowDownwardIcon
            sx={{
              fontSize: 14,
              color: isActive && direction === 'desc' ? '#00E5FF' : 'rgba(176, 176, 176, 0.3)',
              opacity: isActive && direction === 'desc' ? 1 : 0.5,
              mt: -0.5,
            }}
          />
        </Box>
      </Box>
    </TableCell>
  );
}

export default function SortableTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  emptyMessage = 'No data available',
}: SortableTableProps<T>) {
  const [sortField, setSortField] = useState<keyof T | string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: keyof T | string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortField as string];
      const bValue = b[sortField as string];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      // Handle date strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return sortDirection === 'asc'
            ? aDate.getTime() - bDate.getTime()
            : bDate.getTime() - aDate.getTime();
        }
      }

      return 0;
    });
  }, [data, sortField, sortDirection]);

  return (
    <TableContainer
      component={Paper}
      sx={{
        backgroundColor: '#000',
        border: '2px solid rgba(0, 229, 255, 0.2)',
        borderRadius: 2,
      }}
    >
      <Table>
        <TableHead sx={{ backgroundColor: '#000' }}>
          <TableRow>
            {columns.map((column) => (
              <SortableHeader
                key={String(column.key)}
                column={column}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: '#B0B0B0' }}>
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, index) => (
              <TableRow
                key={index}
                onClick={() => onRowClick?.(row)}
                sx={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  '&:hover': {
                    backgroundColor: onRowClick ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
                  },
                }}
              >
                {columns.map((column) => {
                  const value = row[column.key as string];
                  return (
                    <TableCell
                      key={String(column.key)}
                      sx={{
                        color: '#E0E0E0',
                        borderBottom: '1px solid rgba(0, 229, 255, 0.1)',
                        textAlign: column.align || 'left',
                      }}
                    >
                      {column.render ? column.render(value, row) : String(value || '')}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

