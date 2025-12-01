'use client';

import { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Collapse,
  Typography,
  Chip,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { KnowledgeBaseCategoryWithChildren } from '@/types/kb';

interface CategorySidebarProps {
  categories: KnowledgeBaseCategoryWithChildren[];
  selectedCategoryId?: string | null;
  onCategorySelect?: (categoryId: string | null) => void;
}

export default function CategorySidebar({
  categories,
  selectedCategoryId,
  onCategorySelect,
}: CategorySidebarProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handleToggle = (categoryId: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpanded(newExpanded);
  };

  const handleCategoryClick = (categoryId: string | null) => {
    if (onCategorySelect) {
      onCategorySelect(categoryId);
    } else {
      if (categoryId) {
        router.push(`/kb?category=${categoryId}`);
      } else {
        router.push('/kb');
      }
    }
  };

  const renderCategory = (category: KnowledgeBaseCategoryWithChildren, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expanded.has(category.id);
    const isSelected = selectedCategoryId === category.id;

    return (
      <Box key={category.id}>
        <ListItem
          disablePadding
          sx={{
            pl: level * 2,
            backgroundColor: isSelected ? 'action.selected' : 'transparent',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <ListItemButton
            onClick={() => {
              if (hasChildren) {
                handleToggle(category.id);
              }
              handleCategoryClick(category.id);
            }}
            sx={{ py: 0.5 }}
          >
            {hasChildren ? (
              isExpanded ? (
                <FolderOpenIcon sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
              ) : (
                <FolderIcon sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
              )
            ) : (
              <Box sx={{ width: 18, mr: 1 }} />
            )}
            <ListItemText
              primary={category.name}
              secondary={
                category.article_count !== undefined ? (
                  <Typography variant="caption" color="text.secondary">
                    {category.article_count} {category.article_count === 1 ? 'article' : 'articles'}
                  </Typography>
                ) : null
              }
            />
            {hasChildren && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
        </ListItem>
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {category.children!.map((child) => renderCategory(child, level + 1))}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ width: 280, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Categories
        </Typography>
      </Box>
      <List sx={{ py: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => handleCategoryClick(null)}
            sx={{
              backgroundColor: selectedCategoryId === null ? 'action.selected' : 'transparent',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <ListItemText primary="All Articles" />
          </ListItemButton>
        </ListItem>
        {categories.map((category) => renderCategory(category))}
      </List>
    </Box>
  );
}

