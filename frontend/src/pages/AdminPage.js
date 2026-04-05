import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../utils/api';
import { API } from '../config';
import { ResponsiveLogo } from '../components/ThemeLogo';
import { 
  Moon, 
  Sun, 
  ArrowLeft,
  Users,
  Layers,
  BarChart3,
  Settings,
  Plus,
  Trash2,
  Shield,
  Crown,
  User,
  Pencil,
  Eye,
  List,
  Square,
  LayoutTemplate,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Template management state
  const [templates, setTemplates] = useState([]);
  const [templateFilter, setTemplateFilter] = useState('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [templateFilter]);

  const fetchData = async () => {
    try {
      const [usersRes, categoriesRes, analyticsRes, templatesRes] = await Promise.all([
        apiGet('/admin/users'),
        fetch(`${API}/template-categories`),
        apiGet('/admin/analytics'),
        fetch(`${API}/templates`)
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (templatesRes.ok) setTemplates(await templatesRes.json());
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const url = templateFilter !== 'all'
        ? `${API}/templates?category_id=${templateFilter}`
        : `${API}/templates`;
      const res = await fetch(url);
      if (res.ok) setTemplates(await res.json());
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const response = await apiPatch(`/admin/users/${userId}`, { role: newRole });

      if (response.ok) {
        setUsers(users.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
        toast.success('User role updated');
      } else {
        toast.error('Failed to update user role');
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error('Failed to update user');
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await apiDelete(`/admin/users/${userId}`);

      if (response.ok) {
        setUsers(users.filter(u => u.user_id !== userId));
        toast.success('User deleted');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    }
  };

  const createCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setCreating(true);
    try {
      const response = await apiPost('/template-categories', {
        name: newCategoryName,
        description: newCategoryDesc || null
      });

      if (response.ok) {
        const category = await response.json();
        setCategories([...categories, category]);
        setNewCategoryName('');
        setNewCategoryDesc('');
        setCategoryDialogOpen(false);
        toast.success('Category created');
      } else {
        toast.error('Failed to create category');
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error('Failed to create category');
    } finally {
      setCreating(false);
    }
  };

  const deleteCategory = async (categoryId) => {
    if (!window.confirm('Delete this category?')) return;

    try {
      const response = await apiDelete(`/template-categories/${categoryId}`);

      if (response.ok) {
        setCategories(categories.filter(c => c.category_id !== categoryId));
        toast.success('Category deleted');
      } else {
        toast.error('Failed to delete category');
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Failed to delete category');
    }
  };

  const handleEditTemplate = (template) => {
    setEditTemplate(template);
    setEditName(template.template_name || '');
    setEditDesc(template.template_description || '');
    setEditCategory(template.template_category_id || '');
    setEditDialogOpen(true);
  };

  const saveTemplateEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const response = await apiPut(`/templates/${editTemplate.board_id}`, {
        template_name: editName,
        template_description: editDesc,
        ...(editCategory ? { category_id: editCategory } : {})
      });
      if (response.ok) {
        toast.success('Template updated!');
        setEditDialogOpen(false);
        fetchTemplates();
      } else {
        const err = response.headers.get('X-Error-Detail') || 'Failed to update template';
        toast.error(err);
      }
    } catch {
      toast.error('Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (!window.confirm(`Delete template "${template.template_name}"? This cannot be undone.`)) return;
    try {
      const response = await apiDelete(`/templates/${template.board_id}`);
      if (response.ok) {
        toast.success('Template deleted');
        fetchTemplates();
        fetchData();
      } else {
        const err = response.headers.get('X-Error-Detail') || 'Failed to delete template';
        toast.error(err);
      }
    } catch {
      toast.error('Failed to delete template');
    }
  };

  const handlePreviewTemplate = async (template) => {
    setPreviewLoading(true);
    setPreviewDialogOpen(true);
    try {
      const response = await fetch(`${API}/templates/${template.board_id}`);
      if (response.ok) {
        setPreviewTemplate(await response.json());
      } else {
        toast.error('Failed to load template preview');
        setPreviewDialogOpen(false);
      }
    } catch {
      toast.error('Failed to load template preview');
      setPreviewDialogOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4 text-odapto-orange" />;
      case 'privileged': return <Crown className="w-4 h-4 text-odapto-teal" />;
      default: return <User className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-odapto-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 hover:bg-muted rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link to="/" className="flex items-center gap-2">
                <ResponsiveLogo className="h-8 w-auto" />
              </Link>
              <span className="px-3 py-1 rounded-full bg-odapto-orange/10 text-odapto-orange text-sm font-medium">
                Admin Panel
              </span>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              data-testid="theme-toggle"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-background">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-background" data-testid="admin-templates-tab">
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-background">
              <Layers className="w-4 h-4 mr-2" />
              Categories
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <h2 className="font-heading text-2xl font-bold">Analytics Overview</h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-card rounded-xl border border-border"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-odapto-orange/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-odapto-orange" />
                  </div>
                  <span className="text-muted-foreground">Total Users</span>
                </div>
                <p className="text-3xl font-bold">{analytics?.totals?.users || 0}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-6 bg-card rounded-xl border border-border"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-odapto-teal/10 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-odapto-teal" />
                  </div>
                  <span className="text-muted-foreground">Workspaces</span>
                </div>
                <p className="text-3xl font-bold">{analytics?.totals?.workspaces || 0}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-6 bg-card rounded-xl border border-border"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="text-muted-foreground">Boards</span>
                </div>
                <p className="text-3xl font-bold">{analytics?.totals?.boards || 0}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-6 bg-card rounded-xl border border-border cursor-pointer hover:border-purple-500/50 hover:shadow-md transition-all group"
                onClick={() => setActiveTab('templates')}
                data-testid="admin-templates-stat-card"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="text-muted-foreground">Templates</span>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </div>
                <p className="text-3xl font-bold">{analytics?.totals?.templates || 0}</p>
              </motion.div>
            </div>

            {/* User Role Distribution */}
            <div className="p-6 bg-card rounded-xl border border-border">
              <h3 className="font-heading font-semibold mb-4">User Role Distribution</h3>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-odapto-orange" />
                  <span>Admins: {analytics?.user_roles?.admin || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-odapto-teal" />
                  <span>Privileged: {analytics?.user_roles?.privileged || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>Normal: {analytics?.user_roles?.normal || 0}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <h2 className="font-heading text-2xl font-bold">User Management</h2>
            
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Joined</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr key={u.user_id} className="hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={u.picture} alt={u.name} />
                              <AvatarFallback className="bg-odapto-orange/20 text-odapto-orange text-sm">
                                {getInitials(u.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <Select
                            value={u.role}
                            onValueChange={(value) => updateUserRole(u.user_id, value)}
                            disabled={u.user_id === user?.user_id}
                          >
                            <SelectTrigger className="w-32">
                              <div className="flex items-center gap-2">
                                {getRoleIcon(u.role)}
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="privileged">Privileged</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteUser(u.user_id)}
                            disabled={u.user_id === user?.user_id}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl font-bold">Template Management</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {templateFilter !== 'all' 
                    ? `Filtered by: ${categories.find(c => c.category_id === templateFilter)?.name || 'Unknown'}`
                    : 'All templates'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={templateFilter} onValueChange={setTemplateFilter}>
                  <SelectTrigger className="w-48" data-testid="admin-template-category-filter">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.category_id} value={cat.category_id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                  <LayoutTemplate className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-heading text-lg font-semibold mb-1">No templates found</h3>
                <p className="text-sm text-muted-foreground">
                  {templateFilter !== 'all' ? 'No templates in this category.' : 'No templates created yet.'}
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Template</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Creator</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Stats</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {templates.map((template) => (
                        <tr key={template.board_id} className="hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg flex-shrink-0"
                                style={{ backgroundColor: template.background || '#3A8B84' }}
                              />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{template.template_name || template.name}</p>
                                {template.template_description && (
                                  <p className="text-xs text-muted-foreground truncate max-w-xs">{template.template_description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm px-2 py-0.5 rounded-full bg-muted">
                              {template.category?.name || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {template.creator?.name || 'Unknown'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <List className="w-3.5 h-3.5" />
                                {template.list_count || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Square className="w-3.5 h-3.5" />
                                {template.card_count || 0}
                              </span>
                              {template.usage_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" />
                                  {template.usage_count}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handlePreviewTemplate(template)}
                                data-testid={`admin-preview-template-${template.board_id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditTemplate(template)}
                                data-testid={`admin-edit-template-${template.board_id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteTemplate(template)}
                                data-testid={`admin-delete-template-${template.board_id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl font-bold">Template Categories</h2>
              <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-odapto-orange hover:bg-odapto-orange-hover text-white" data-testid="create-category-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    New Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Category</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={createCategory} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="cat-name">Category Name</Label>
                      <Input
                        id="cat-name"
                        placeholder="e.g. Project Management"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        required
                        data-testid="category-name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cat-desc">Description (optional)</Label>
                      <Input
                        id="cat-desc"
                        placeholder="Brief description"
                        value={newCategoryDesc}
                        onChange={(e) => setNewCategoryDesc(e.target.value)}
                        data-testid="category-desc-input"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                        disabled={creating}
                        data-testid="create-category-submit-btn"
                      >
                        {creating ? 'Creating...' : 'Create'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category, index) => (
                <motion.div
                  key={category.category_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-card rounded-xl border border-border cursor-pointer hover:border-odapto-orange/50 hover:shadow-md transition-all group"
                  onClick={() => { setTemplateFilter(category.category_id); setActiveTab('templates'); }}
                  data-testid={`category-card-${category.category_id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{category.name}</h3>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {category.description && (
                        <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                      )}
                      <p className="text-xs text-odapto-orange mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to view templates
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); deleteCategory(category.category_id); }}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}

              {categories.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No categories yet. Create one to get started.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Template Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the details for "{editTemplate?.template_name}"
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveTemplateEdit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="admin-edit-template-name">Template Name</Label>
              <Input
                id="admin-edit-template-name"
                placeholder="Template name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                data-testid="admin-edit-template-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-edit-template-desc">Description</Label>
              <Input
                id="admin-edit-template-desc"
                placeholder="Template description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                data-testid="admin-edit-template-desc-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger data-testid="admin-edit-template-category-select">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.category_id} value={cat.category_id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                disabled={saving || !editName.trim()}
                data-testid="admin-edit-template-save-btn"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-odapto-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : previewTemplate ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg"
                    style={{ backgroundColor: previewTemplate.background || '#3A8B84' }}
                  />
                  <div>
                    <span className="text-xl">{previewTemplate.template_name}</span>
                    {previewTemplate.category && (
                      <span className="ml-2 text-xs font-normal px-2 py-0.5 bg-muted rounded-full">
                        {previewTemplate.category.name}
                      </span>
                    )}
                  </div>
                </DialogTitle>
                <DialogDescription className="mt-2">
                  {previewTemplate.template_description || 'Preview the board structure.'}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4">
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {previewTemplate.lists?.map((list) => (
                    <div
                      key={list.list_id}
                      className="flex-shrink-0 w-64 bg-muted rounded-lg p-3"
                    >
                      <h4 className="font-semibold text-sm mb-2 text-card-foreground">{list.name}</h4>
                      <div className="space-y-2">
                        {list.cards?.slice(0, 3).map((card) => (
                          <div
                            key={card.card_id}
                            className="bg-card rounded-md p-2 shadow-sm"
                          >
                            <p className="text-sm font-medium line-clamp-2">{card.title}</p>
                            {card.labels?.length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                {card.labels.slice(0, 3).map((label, idx) => (
                                  <span
                                    key={idx}
                                    className="w-6 h-1.5 rounded-full"
                                    style={{ backgroundColor: label.color }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {list.cards?.length > 3 && (
                          <p className="text-xs text-muted-foreground text-center">
                            + {list.cards.length - 3} more cards
                          </p>
                        )}
                        {(!list.cards || list.cards.length === 0) && (
                          <p className="text-xs text-muted-foreground text-center py-2">Empty list</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!previewTemplate.lists || previewTemplate.lists.length === 0) && (
                    <p className="text-muted-foreground text-sm">No lists in this template.</p>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <List className="w-4 h-4" />
                    {previewTemplate.lists?.length || 0} lists
                  </span>
                  <span className="flex items-center gap-1">
                    <Square className="w-4 h-4" />
                    {previewTemplate.lists?.reduce((acc, l) => acc + (l.cards?.length || 0), 0)} cards
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {previewTemplate.creator?.name || 'Unknown'}
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
