import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { 
  Search, 
  Moon, 
  Sun, 
  LayoutGrid,
  ArrowRight,
  User,
  Layers,
  Filter,
  List,
  Square,
  Eye,
  Users,
  X,
  Pencil,
  Trash2
} from 'lucide-react';

import { API } from '../config';
import { ResponsiveLogo } from '../components/ThemeLogo';

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
  
  // Preview state
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving] = useState(false);

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
        const wsRes = await apiGet('/workspaces');
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
    } catch (error) {
      console.error('Failed to fetch template preview:', error);
      toast.error('Failed to load template preview');
      setPreviewDialogOpen(false);
    } finally {
      setPreviewLoading(false);
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
    setPreviewDialogOpen(false);
    setUseDialogOpen(true);
  };

  const canManageTemplate = (template) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return template.created_by === user.user_id;
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
        fetchData();
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
        fetchData();
      } else {
        const err = response.headers.get('X-Error-Detail') || 'Failed to delete template';
        toast.error(err);
      }
    } catch {
      toast.error('Failed to delete template');
    }
  };

  const useTemplate = async (e) => {
    e.preventDefault();
    if (!selectedWorkspace || !newBoardName.trim()) return;

    setCreating(true);
    try {
      const response = await apiPost(`/templates/${selectedTemplate.board_id}/use`, {
        workspace_id: selectedWorkspace,
        board_name: newBoardName
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
              <ResponsiveLogo className="h-8 w-auto" />
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
                    className="h-32 p-4 flex flex-col justify-end text-white relative cursor-pointer"
                    style={{ backgroundColor: template.background || '#3A8B84' }}
                    onClick={() => handlePreviewTemplate(template)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    
                    {/* Preview overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                        <Eye className="w-4 h-4" />
                        <span className="text-sm font-medium">Preview</span>
                      </div>
                    </div>
                    
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
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {template.template_description}
                      </p>
                    )}
                    
                    {/* Stats Row */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1" title="Lists">
                        <List className="w-3.5 h-3.5" />
                        {template.list_count || 0} lists
                      </span>
                      <span className="flex items-center gap-1" title="Cards">
                        <Square className="w-3.5 h-3.5" />
                        {template.card_count || 0} cards
                      </span>
                      {template.usage_count > 0 && (
                        <span className="flex items-center gap-1" title="Times used">
                          <Users className="w-3.5 h-3.5" />
                          {template.usage_count} uses
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>{template.creator?.name || 'Unknown'}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {canManageTemplate(template) && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); handleEditTemplate(template); }}
                              data-testid={`edit-template-${template.board_id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template); }}
                              data-testid={`delete-template-${template.board_id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
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
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

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
                  {previewTemplate.template_description || 'Preview the board structure before using this template.'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-4">
                {/* Template structure preview */}
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
                            {(card.labels?.length > 0 || card.due_date) && (
                              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                {card.labels?.slice(0, 3).map((label, idx) => (
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
                        {list.cards?.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            Empty list
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!previewTemplate.lists || previewTemplate.lists.length === 0) && (
                    <p className="text-muted-foreground text-sm">No lists in this template.</p>
                  )}
                </div>
                
                {/* Stats and actions */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                  <Button
                    onClick={() => handleUseTemplate(previewTemplate)}
                    className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                    data-testid="preview-use-template-btn"
                  >
                    Use This Template
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Use Template Dialog */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use Template</DialogTitle>
            <DialogDescription>
              Create a new board from "{selectedTemplate?.template_name}"
            </DialogDescription>
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
              <Label htmlFor="edit-template-name">Template Name</Label>
              <Input
                id="edit-template-name"
                placeholder="Template name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                data-testid="edit-template-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-desc">Description</Label>
              <Input
                id="edit-template-desc"
                placeholder="Template description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                data-testid="edit-template-desc-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger data-testid="edit-template-category-select">
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
                data-testid="edit-template-save-btn"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
