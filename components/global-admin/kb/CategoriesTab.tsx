'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import type { KnowledgeBaseCategory } from '@/types/kb';

interface CategoryWithCount extends KnowledgeBaseCategory {
  article_count?: number;
  children?: CategoryWithCount[];
}

export default function CategoriesTab() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [flatCategories, setFlatCategories] = useState<CategoryWithCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; category: CategoryWithCount | null }>({
    open: false,
    category: null,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/global/admin/kb/categories?include_counts=true');
      if (!response.ok) {
        throw new Error('Failed to load categories');
      }
      const data = await response.json();
      setCategories(data.categories || []);
      setFlatCategories(data.flat || []);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: CategoryWithCount) => {
    // Navigate to category edit page or open edit dialog
    // For now, we'll just log it - you can implement edit functionality
    console.log('Edit category:', category);
  };

  const handleDelete = async () => {
    if (!deleteDialog.category) return;

    try {
      const response = await fetch(`/api/kb/categories/${deleteDialog.category.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete category');
      }

      await loadCategories();
      setDeleteDialog({ open: false, category: null });
    } catch (err) {
      console.error('Error deleting category:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const flattenCategories = (cats: CategoryWithCount[], level = 0): CategoryWithCount[] => {
    const result: CategoryWithCount[] = [];
    cats.forEach((cat) => {
      result.push({ ...cat, name: '  '.repeat(level) + cat.name });
      if (cat.children && cat.children.length > 0) {
        result.push(...flattenCategories(cat.children, level + 1));
      }
    });
    return result;
  };

  const filteredCategories = (() => {
    if (!searchTerm) return flattenCategories(categories);
    const search = searchTerm.toLowerCase();
    return flattenCategories(categories).filter(
      (cat) =>
        cat.name.toLowerCase().includes(search) ||
        cat.slug.toLowerCase().includes(search)
    );
  })();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Categories</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            // Navigate to create category page or open dialog
            console.log('Create new category');
          }}
        >
          New Category
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search categories by name or slug..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Articles</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchTerm ? 'No categories found matching your search' : 'No categories found'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map((category) => (
                <TableRow key={category.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {category.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {category.slug}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={category.organization_id ? 'Organization' : 'Global'}
                      color={category.organization_id ? 'primary' : 'info'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {category.article_count || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(category.created_at).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(category)}
                      title="Edit category"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteDialog({ open: true, category })}
                      title="Delete category"
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, category: null })}
      >
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &quot;{deleteDialog.category?.name}&quot;? 
            {deleteDialog.category && deleteDialog.category.article_count && deleteDialog.category.article_count > 0 && (
              <>
                <br />
                <br />
                <strong>Warning:</strong> This category has {deleteDialog.category.article_count} article(s). 
                You must move or delete these articles first.
              </>
            )}
            {deleteDialog.category && deleteDialog.category.children && deleteDialog.category.children.length > 0 && (
              <>
                <br />
                <br />
                <strong>Warning:</strong> This category has subcategories. 
                You must delete or move them first.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, category: null })}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={
              (deleteDialog.category?.article_count && deleteDialog.category.article_count > 0) ||
              (deleteDialog.category?.children && deleteDialog.category.children.length > 0)
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
