'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import CategoryManager from '@/components/kb/admin/CategoryManager';
import type { KnowledgeBaseArticleWithCategory, KnowledgeBaseCategoryWithChildren } from '@/types/kb';

export default function KnowledgeBaseAdminPage() {
  const router = useRouter();
  const { features } = useOrganization();
  const [tab, setTab] = useState(0);
  const [articles, setArticles] = useState<KnowledgeBaseArticleWithCategory[]>([]);
  const [categories, setCategories] = useState<KnowledgeBaseCategoryWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; articleId: string } | null>(null);

  useEffect(() => {
    // Check module access
    if (features && features.knowledge_base_enabled !== true) {
      router.push('/dashboard');
      return;
    }

    loadData();
  }, [features, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [articlesRes, categoriesRes] = await Promise.all([
        fetch('/api/kb/articles?limit=100'),
        fetch('/api/kb/categories?include_counts=true'),
      ]);

      if (articlesRes.ok) {
        const articlesData = await articlesRes.json();
        setArticles(articlesData.articles || []);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
      const response = await fetch(`/api/kb/articles/${articleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setArticles(articles.filter((a) => a.id !== articleId));
      }
    } catch (err) {
      console.error('Error deleting article:', err);
    }
  };

  const handleAddCategory = async (data: { name: string; slug: string; parent_id: string | null }) => {
    try {
      const response = await fetch('/api/kb/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        loadData();
      }
    } catch (err) {
      console.error('Error adding category:', err);
    }
  };

  const handleEditCategory = async (
    id: string,
    data: { name: string; slug: string; parent_id: string | null }
  ) => {
    try {
      const response = await fetch(`/api/kb/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        loadData();
      }
    } catch (err) {
      console.error('Error editing category:', err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const response = await fetch(`/api/kb/categories/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadData();
      }
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Knowledge Base Admin</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/kb/admin/articles/new')}
        >
          New Article
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Articles" />
        <Tab label="Categories" />
      </Tabs>

      {tab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {article.title}
                    </Typography>
                  </TableCell>
                  <TableCell>{article.category?.name || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={article.published ? 'Published' : 'Draft'}
                      color={article.published ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{new Date(article.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={(e) => setMenuAnchor({ el: e.currentTarget, articleId: article.id })}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 1 && (
        <CategoryManager
          categories={categories}
          onAdd={handleAddCategory}
          onEdit={handleEditCategory}
          onDelete={handleDeleteCategory}
        />
      )}

      <Menu
        anchorEl={menuAnchor?.el}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            const article = articles.find((a) => a.id === menuAnchor?.articleId);
            if (article) {
              router.push(`/kb/${article.slug}`);
            }
            setMenuAnchor(null);
          }}
        >
          <ViewIcon sx={{ mr: 1 }} />
          View
        </MenuItem>
        <MenuItem
          onClick={() => {
            const article = articles.find((a) => a.id === menuAnchor?.articleId);
            if (article) {
              router.push(`/kb/admin/articles/${article.id}`);
            }
            setMenuAnchor(null);
          }}
        >
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              handleDeleteArticle(menuAnchor.articleId);
            }
            setMenuAnchor(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Container>
  );
}

