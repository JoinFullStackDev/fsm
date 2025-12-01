'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { KnowledgeBaseCategoryWithChildren } from '@/types/kb';

interface CategoryManagerProps {
  categories: KnowledgeBaseCategoryWithChildren[];
  onAdd: (data: { name: string; slug: string; parent_id: string | null }) => Promise<void>;
  onEdit: (id: string, data: { name: string; slug: string; parent_id: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function CategoryManager({
  categories,
  onAdd,
  onEdit,
  onDelete,
}: CategoryManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<KnowledgeBaseCategoryWithChildren | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; categoryId: string } | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string>('');

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setParentId('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (category: KnowledgeBaseCategoryWithChildren) => {
    setEditingCategory(category);
    setName(category.name);
    setSlug(category.slug);
    setParentId(category.parent_id || '');
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingCategory(null);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const categorySlug = slug || generateSlug(name);

    if (editingCategory) {
      await onEdit(editingCategory.id, {
        name,
        slug: categorySlug,
        parent_id: parentId || null,
      });
    } else {
      await onAdd({
        name,
        slug: categorySlug,
        parent_id: parentId || null,
      });
    }

    handleClose();
  };

  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100);
  };

  const renderCategory = (category: KnowledgeBaseCategoryWithChildren, level: number = 0) => {
    return (
      <ListItem
        key={category.id}
        sx={{ pl: level * 3 }}
        secondaryAction={
          <IconButton
            onClick={(e) => setMenuAnchor({ el: e.currentTarget, categoryId: category.id })}
          >
            <MoreVertIcon />
          </IconButton>
        }
      >
        <ListItemText primary={category.name} secondary={category.slug} />
      </ListItem>
    );
  };

  const getFlatCategories = (cats: KnowledgeBaseCategoryWithChildren[]): KnowledgeBaseCategoryWithChildren[] => {
    const result: KnowledgeBaseCategoryWithChildren[] = [];
    const flatten = (items: KnowledgeBaseCategoryWithChildren[]) => {
      items.forEach((item) => {
        result.push(item);
        if (item.children) {
          flatten(item.children);
        }
      });
    };
    flatten(cats);
    return result;
  };

  const flatCategories = getFlatCategories(categories);
  const availableParents = flatCategories.filter(
    (cat) => !editingCategory || cat.id !== editingCategory.id
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Categories</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
          Add Category
        </Button>
      </Box>

      <List>
        {categories.map((category) => renderCategory(category))}
      </List>

      <Menu
        anchorEl={menuAnchor?.el}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            const category = flatCategories.find((c) => c.id === menuAnchor?.categoryId);
            if (category) {
              handleOpenEdit(category);
            }
            setMenuAnchor(null);
          }}
        >
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={async () => {
            if (menuAnchor) {
              await onDelete(menuAnchor.categoryId);
            }
            setMenuAnchor(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug || slug === editingCategory?.slug) {
                setSlug(generateSlug(e.target.value));
              }
            }}
            fullWidth
            required
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Parent Category</InputLabel>
            <Select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              label="Parent Category"
            >
              <MenuItem value="">None</MenuItem>
              {availableParents.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!name.trim()}>
            {editingCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

