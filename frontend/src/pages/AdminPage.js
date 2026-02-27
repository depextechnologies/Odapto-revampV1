import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
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
  User
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LOGO_URL = "https://customer-assets.emergentagent.com/job_27d48b6b-dd80-4045-b25e-4aeef47ff911/artifacts/8ilbqloe_download.png";

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, categoriesRes, analyticsRes] = await Promise.all([
        fetch(`${API}/admin/users`, { credentials: 'include' }),
        fetch(`${API}/template-categories`),
        fetch(`${API}/admin/analytics`, { credentials: 'include' })
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const response = await fetch(`${API}/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      });

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
      const response = await fetch(`${API}/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

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
      const response = await fetch(`${API}/template-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newCategoryName,
          description: newCategoryDesc || null
        })
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
      const response = await fetch(`${API}/template-categories/${categoryId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

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
                <img src={LOGO_URL} alt="Odapto" className="h-8 w-auto" />
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
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-background">
              <Users className="w-4 h-4 mr-2" />
              Users
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
                className="p-6 bg-card rounded-xl border border-border"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="text-muted-foreground">Templates</span>
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
                  className="p-4 bg-card rounded-xl border border-border"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCategory(category.category_id)}
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
    </div>
  );
}
