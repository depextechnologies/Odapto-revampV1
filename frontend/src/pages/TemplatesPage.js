import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Search, 
  Moon, 
  Sun, 
  LayoutGrid,
  ArrowRight,
  User,
  Layers,
  Filter
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LOGO_URL = "https://customer-assets.emergentagent.com/job_27d48b6b-dd80-4045-b25e-4aeef47ff911/artifacts/8ilbqloe_download.png";

export default function TemplatesPage() {
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [workspaces, setWorkspaces] = useState([]);
  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedCategory]);

  const fetchData = async () => {
    try {
      const [templatesRes, categoriesRes] = await Promise.all([
        fetch(`${API}/templates${selectedCategory !== 'all' ? `?category_id=${selectedCategory}` : ''}`),
        fetch(`${API}/template-categories`)
      ]);

      if (templatesRes.ok) {
        setTemplates(await templatesRes.json());
      }
      if (categoriesRes.ok) {
        setCategories(await categoriesRes.json());
      }

      // Fetch workspaces if authenticated
      if (isAuthenticated) {
        const wsRes = await fetch(`${API}/workspaces`, { credentials: 'include' });
        if (wsRes.ok) {
          setWorkspaces(await wsRes.json());
        }
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = (template) => {
    if (!isAuthenticated) {
      toast.error('Please log in to use templates');
      navigate('/login');
      return;
    }

    setSelectedTemplate(template);
    setNewBoardName(template.template_name || '');
    setUseDialogOpen(true);
  };

  const useTemplate = async (e) => {
    e.preventDefault();
    if (!selectedWorkspace || !newBoardName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch(`${API}/templates/${selectedTemplate.board_id}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workspace_id: selectedWorkspace,
          board_name: newBoardName
        })
      });

      if (response.ok) {
        const board = await response.json();
        toast.success('Board created from template!');
        navigate(`/board/${board.board_id}`);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to use template');
      }
    } catch (error) {
      console.error('Failed to use template:', error);
      toast.error('Failed to use template');
    } finally {
      setCreating(false);
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.template_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.template_description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <img src={LOGO_URL} alt="Odapto" className="h-8 w-auto" />
            </Link>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {isAuthenticated ? (
                <Link to="/dashboard">
                  <Button variant="outline" data-testid="dashboard-btn">Dashboard</Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button className="bg-odapto-orange hover:bg-odapto-orange-hover text-white" data-testid="login-btn">
                    Log in
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-br from-odapto-orange/10 via-background to-odapto-teal/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-4xl sm:text-5xl font-bold mb-4"
          >
            Template Gallery
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            Jump-start your projects with ready-made board templates. 
            Created by the community, free to use.
          </motion.p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-templates-input"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48" data-testid="category-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Categories" />
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

      {/* Templates Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-odapto-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <Layers className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-heading text-xl font-semibold mb-2">No templates found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try a different search term' : 'No templates available yet'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template, index) => (
              <motion.div
                key={template.board_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <div className="bg-card rounded-xl border border-border hover:border-odapto-orange/50 hover:shadow-lg transition-all overflow-hidden">
                  {/* Template Preview */}
                  <div 
                    className="h-32 p-4 flex flex-col justify-end text-white relative"
                    style={{ backgroundColor: template.background || '#3A8B84' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="relative z-10">
                      <h3 className="font-heading font-semibold text-lg">
                        {template.template_name || template.name}
                      </h3>
                      {template.category && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                          {template.category.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Template Info */}
                  <div className="p-4">
                    {template.template_description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {template.template_description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>{template.creator?.name || 'Unknown'}</span>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => handleUseTemplate(template)}
                        className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                        data-testid={`use-template-${template.board_id}`}
                      >
                        Use Template
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Use Template Dialog */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={useTemplate} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Select Workspace</Label>
              <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                <SelectTrigger data-testid="workspace-select">
                  <SelectValue placeholder="Choose a workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.workspace_id} value={ws.workspace_id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workspaces.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  You need to create a workspace first.{' '}
                  <Link to="/dashboard" className="text-odapto-orange hover:underline">
                    Go to Dashboard
                  </Link>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-name">Board Name</Label>
              <Input
                id="board-name"
                placeholder="My Board"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                required
                data-testid="template-board-name-input"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setUseDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                disabled={creating || !selectedWorkspace}
                data-testid="use-template-submit-btn"
              >
                {creating ? 'Creating...' : 'Create Board'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
