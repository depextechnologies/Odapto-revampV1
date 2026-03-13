import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { apiGet, apiPost } from '../utils/api';
import NotificationBell from '../components/NotificationBell';
import GlobalSearch from '../components/GlobalSearch';
import { ResponsiveLogo } from '../components/ThemeLogo';
import { 
  Plus, 
  LayoutGrid, 
  Moon, 
  Sun, 
  LogOut,
  Settings,
  User,
  Shield,
  Folder,
  Clock,
  ChevronRight,
  Link2,
  KeyRound,
  HelpCircle,
  Sparkles,
  Plug,
  Crown
} from 'lucide-react';

export default function DashboardPage() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await apiGet('/workspaces');
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setCreating(true);
    try {
      const response = await apiPost('/workspaces', {
        name: newWorkspaceName,
        description: newWorkspaceDesc || null
      });

      if (response.ok) {
        const workspace = await response.json();
        setWorkspaces([...workspaces, workspace]);
        setNewWorkspaceName('');
        setNewWorkspaceDesc('');
        setCreateDialogOpen(false);
        toast.success('Workspace created!');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create workspace');
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
      toast.error('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const filteredWorkspaces = workspaces;

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <ResponsiveLogo className="h-8 w-auto" />
              </Link>
              
              <div className="hidden md:block">
                <GlobalSearch />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/templates">
                <Button variant="ghost" size="sm" data-testid="templates-nav-btn">
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Templates
                </Button>
              </Link>

              <NotificationBell />

              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2" data-testid="user-menu-btn">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.picture} alt={user?.name} />
                      <AvatarFallback className="bg-odapto-orange text-white text-sm">
                        {getInitials(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-odapto-teal/20 text-odapto-teal capitalize">
                      {user?.role}
                    </span>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/integrations" className="cursor-pointer">
                      <Plug className="w-4 h-4 mr-2" />
                      Integrations
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile?tab=password" className="cursor-pointer">
                      <KeyRound className="w-4 h-4 mr-2" />
                      Change Password
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/help" className="cursor-pointer">
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Help
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/upgrade" className="cursor-pointer text-odapto-orange">
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade Plan
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="cursor-pointer">
                          <Shield className="w-4 h-4 mr-2" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer" data-testid="logout-btn">
                    <LogOut className="w-4 h-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">
              Welcome back, {user?.name?.split(' ')[0]}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your workspaces and boards
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                data-testid="create-workspace-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Workspace</DialogTitle>
                <DialogDescription>Create a new workspace to organize your boards and projects.</DialogDescription>
              </DialogHeader>
              <form onSubmit={createWorkspace} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Workspace Name</Label>
                  <Input
                    id="ws-name"
                    placeholder="My Workspace"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    required
                    data-testid="workspace-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-desc">Description (optional)</Label>
                  <Input
                    id="ws-desc"
                    placeholder="What's this workspace for?"
                    value={newWorkspaceDesc}
                    onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                    data-testid="workspace-desc-input"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                    disabled={creating}
                    data-testid="create-workspace-submit-btn"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Workspaces Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-odapto-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <Folder className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-heading text-xl font-semibold mb-2">
              No workspaces yet
            </h3>
            <p className="text-muted-foreground mb-6">
              Create your first workspace to get started
            </p>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Workspace
            </Button>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkspaces.map((workspace, index) => (
              <motion.div
                key={workspace.workspace_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link 
                  to={`/workspace/${workspace.workspace_id}`}
                  className="block group"
                  data-testid={`workspace-card-${workspace.workspace_id}`}
                >
                  <div className="p-6 bg-card rounded-xl border border-border hover:border-odapto-orange/50 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-lg bg-odapto-teal/20 flex items-center justify-center">
                        <Folder className="w-6 h-6 text-odapto-teal" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-odapto-orange group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="font-heading text-lg font-semibold mb-1 group-hover:text-odapto-orange transition-colors">
                      {workspace.name}
                    </h3>
                    {workspace.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {workspace.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {workspace.members?.length || 1} member{(workspace.members?.length || 1) !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(workspace.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
