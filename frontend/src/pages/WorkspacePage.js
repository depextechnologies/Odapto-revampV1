import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { apiGet, apiPost, apiDelete, apiPatch } from '../utils/api';
import { API_BASE_URL } from '../config';
import { ResponsiveLogo } from '../components/ThemeLogo';
import { 
  Plus, 
  LayoutGrid, 
  Moon, 
  Sun, 
  LogOut,
  ArrowLeft,
  Trash2,
  Settings,
  Users,
  ChevronRight,
  MoreVertical,
  List,
  Square,
  Paperclip,
  UserPlus,
  Briefcase,
  FolderHeart,
  Mail,
  User,
  Plug,
  KeyRound,
  HelpCircle,
  Crown,
  Shield,
  Layers
} from 'lucide-react';

const BOARD_COLORS = [
  '#3A8B84', '#E67E4C', '#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#8B5CF6', '#06B6D4'
];

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

export default function WorkspacePage() {
  const { workspaceId } = useParams();
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [workspace, setWorkspace] = useState(null);
  const [boards, setBoards] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardColor, setNewBoardColor] = useState(BOARD_COLORS[0]);
  const [newBoardTeamId, setNewBoardTeamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  // Template selection state
  const [createMode, setCreateMode] = useState('blank'); // 'blank' or 'template'
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    fetchWorkspaceData();
  }, [workspaceId]);

  const fetchWorkspaceData = async () => {
    try {
      const [wsRes, boardsRes, teamsRes] = await Promise.all([
        apiGet(`/workspaces/${workspaceId}`),
        apiGet(`/workspaces/${workspaceId}/boards`),
        apiGet(`/workspaces/${workspaceId}/teams`)
      ]);

      if (wsRes.ok) {
        setWorkspace(await wsRes.json());
      } else {
        toast.error('Workspace not found');
        navigate('/dashboard');
        return;
      }

      if (boardsRes.ok) {
        setBoards(await boardsRes.json());
      }
      
      if (teamsRes.ok) {
        setTeams(await teamsRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch workspace:', error);
      toast.error('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  // Categorize boards
  const categorizedBoards = useMemo(() => {
    const invited = boards.filter(b => b.category === 'invited');
    const personal = boards.filter(b => b.category === 'personal');
    const team = boards.filter(b => b.category === 'team');
    return { invited, personal, team, all: boards };
  }, [boards]);

  const isOwner = workspace?.owner_id === user?.user_id;

  // Fetch templates when dialog opens
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates`);
      if (response.ok) {
        setTemplates(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const openCreateDialog = () => {
    setCreateMode('blank');
    setSelectedTemplate(null);
    setNewBoardName('');
    setNewBoardColor(BOARD_COLORS[0]);
    setNewBoardTeamId('');
    fetchTemplates();
    setCreateDialogOpen(true);
  };

  const createBoard = async (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    setCreating(true);
    try {
      let board;
      
      if (createMode === 'template' && selectedTemplate) {
        // Create board from template
        const response = await apiPost(`/templates/${selectedTemplate.board_id}/use`, {
          workspace_id: workspaceId,
          board_name: newBoardName
        });
        
        if (response.ok) {
          board = await response.json();
        } else {
          const error = await response.json();
          toast.error(error.detail || 'Failed to create board from template');
          return;
        }
      } else {
        // Create blank board
        const response = await apiPost(`/workspaces/${workspaceId}/boards`, {
          name: newBoardName,
          background: newBoardColor
        });

        if (response.ok) {
          board = await response.json();
        } else {
          const error = await response.json();
          toast.error(error.detail || 'Failed to create board');
          return;
        }
      }
      
      // Assign to team if selected
      if (newBoardTeamId) {
        await apiPatch(`/boards/${board.board_id}/team`, { team_id: newBoardTeamId });
        board.team_id = newBoardTeamId;
        board.category = 'team';
        const team = teams.find(t => t.team_id === newBoardTeamId);
        board.team_name = team?.name;
      } else {
        board.category = 'personal';
      }
      
      setBoards([...boards, board]);
      setNewBoardName('');
      setNewBoardColor(BOARD_COLORS[0]);
      setNewBoardTeamId('');
      setSelectedTemplate(null);
      setCreateMode('blank');
      setCreateDialogOpen(false);
      toast.success('Board created!');
    } catch (error) {
      console.error('Failed to create board:', error);
      toast.error('Failed to create board');
    } finally {
      setCreating(false);
    }
  };

  const createTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreating(true);
    try {
      const response = await apiPost(`/workspaces/${workspaceId}/teams`, {
        name: newTeamName,
        description: newTeamDescription
      });

      if (response.ok) {
        const team = await response.json();
        setTeams([...teams, team]);
        setNewTeamName('');
        setNewTeamDescription('');
        setCreateTeamDialogOpen(false);
        toast.success('Team created!');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create team');
      }
    } catch (error) {
      console.error('Failed to create team:', error);
      toast.error('Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const deleteBoard = async (boardId) => {
    if (!window.confirm('Are you sure you want to delete this board?')) return;

    try {
      const response = await apiDelete(`/boards/${boardId}`);

      if (response.ok) {
        setBoards(boards.filter(b => b.board_id !== boardId));
        toast.success('Board deleted');
      } else {
        toast.error('Failed to delete board');
      }
    } catch (error) {
      console.error('Failed to delete board:', error);
      toast.error('Failed to delete board');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
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
      {/* Top Navigation */}
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
            </div>

            <div className="flex items-center gap-3">
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
                      <AvatarImage src={getImageUrl(user?.picture)} alt={user?.name} />
                      <AvatarFallback className="bg-odapto-orange text-white text-sm">
                        {getInitials(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
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
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
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
            <h1 className="font-heading text-3xl font-bold">{workspace?.name}</h1>
            {workspace?.description && (
              <p className="text-muted-foreground mt-1">{workspace.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isOwner && (
              <Dialog open={createTeamDialogOpen} onOpenChange={setCreateTeamDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="create-team-btn">
                    <Users className="w-4 h-4 mr-2" />
                    New Team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Team</DialogTitle>
                    <DialogDescription>Create a team to organize boards and members.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={createTeam} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="team-name">Team Name</Label>
                      <Input
                        id="team-name"
                        placeholder="Marketing Team"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        required
                        data-testid="team-name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="team-description">Description (optional)</Label>
                      <Textarea
                        id="team-description"
                        placeholder="Team description..."
                        value={newTeamDescription}
                        onChange={(e) => setNewTeamDescription(e.target.value)}
                        data-testid="team-description-input"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setCreateTeamDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-odapto-teal hover:bg-odapto-teal/90 text-white"
                        disabled={creating}
                        data-testid="create-team-submit-btn"
                      >
                        {creating ? 'Creating...' : 'Create Team'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                  data-testid="create-board-btn"
                  onClick={openCreateDialog}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Board
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Board</DialogTitle>
                  <DialogDescription>Start fresh or use a template to get started quickly.</DialogDescription>
                </DialogHeader>
                
                {/* Mode Selection Tabs */}
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => { setCreateMode('blank'); setSelectedTemplate(null); }}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      createMode === 'blank' 
                        ? 'border-odapto-orange bg-odapto-orange/5' 
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <LayoutGrid className={`w-5 h-5 mx-auto mb-1 ${createMode === 'blank' ? 'text-odapto-orange' : ''}`} />
                    <p className="text-sm font-medium">Blank Board</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('template')}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      createMode === 'template' 
                        ? 'border-odapto-orange bg-odapto-orange/5' 
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <Layers className={`w-5 h-5 mx-auto mb-1 ${createMode === 'template' ? 'text-odapto-orange' : ''}`} />
                    <p className="text-sm font-medium">From Template</p>
                  </button>
                </div>

                <form onSubmit={createBoard} className="space-y-4 mt-4">
                  {/* Template Selection (when template mode) */}
                  {createMode === 'template' && (
                    <div className="space-y-2">
                      <Label>Choose Template</Label>
                      {loadingTemplates ? (
                        <div className="flex justify-center py-8">
                          <div className="w-6 h-6 border-2 border-odapto-orange border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No templates available. <Link to="/templates" className="text-odapto-orange hover:underline">Browse templates</Link>
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                          {templates.map((template) => (
                            <button
                              key={template.board_id}
                              type="button"
                              onClick={() => {
                                setSelectedTemplate(template);
                                if (!newBoardName) setNewBoardName(template.template_name || '');
                              }}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                selectedTemplate?.board_id === template.board_id
                                  ? 'border-odapto-orange bg-odapto-orange/5'
                                  : 'border-border hover:border-muted-foreground'
                              }`}
                            >
                              <div 
                                className="w-full h-8 rounded mb-2"
                                style={{ backgroundColor: template.background || '#3A8B84' }}
                              />
                              <p className="text-sm font-medium truncate">{template.template_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {template.list_count || 0} lists · {template.card_count || 0} cards
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="board-name">Board Name</Label>
                    <Input
                      id="board-name"
                      placeholder="My Board"
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      required
                      data-testid="board-name-input"
                    />
                  </div>
                  
                  {/* Color picker only for blank boards */}
                  {createMode === 'blank' && (
                    <div className="space-y-2">
                      <Label>Board Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {BOARD_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewBoardColor(color)}
                            className={`w-8 h-8 rounded-lg transition-all ${
                              newBoardColor === color ? 'ring-2 ring-offset-2 ring-foreground' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {teams.length > 0 && (
                    <div className="space-y-2">
                      <Label>Assign to Team (optional)</Label>
                      <Select value={newBoardTeamId || "none"} onValueChange={(val) => setNewBoardTeamId(val === "none" ? "" : val)}>
                        <SelectTrigger data-testid="board-team-select">
                          <SelectValue placeholder="No team (Personal board)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No team (Personal board)</SelectItem>
                          {teams.map((team) => (
                            <SelectItem key={team.team_id} value={team.team_id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                      disabled={creating || (createMode === 'template' && !selectedTemplate)}
                      data-testid="create-board-submit-btn"
                    >
                      {creating ? 'Creating...' : 'Create Board'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Boards with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
              <LayoutGrid className="w-4 h-4" />
              All ({boards.length})
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-2" data-testid="tab-personal">
              <FolderHeart className="w-4 h-4" />
              Personal ({categorizedBoards.personal.length})
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2" data-testid="tab-team">
              <Users className="w-4 h-4" />
              Team ({categorizedBoards.team.length})
            </TabsTrigger>
            <TabsTrigger value="invited" className="flex items-center gap-2" data-testid="tab-invited">
              <Mail className="w-4 h-4" />
              Invited ({categorizedBoards.invited.length})
            </TabsTrigger>
          </TabsList>

          {['all', 'personal', 'team', 'invited'].map((tabKey) => (
            <TabsContent key={tabKey} value={tabKey}>
              {categorizedBoards[tabKey].length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                    {tabKey === 'personal' && <FolderHeart className="w-8 h-8 text-muted-foreground" />}
                    {tabKey === 'team' && <Users className="w-8 h-8 text-muted-foreground" />}
                    {tabKey === 'invited' && <Mail className="w-8 h-8 text-muted-foreground" />}
                    {tabKey === 'all' && <LayoutGrid className="w-8 h-8 text-muted-foreground" />}
                  </div>
                  <h3 className="font-heading text-lg font-semibold mb-2">
                    {tabKey === 'personal' && 'No personal boards'}
                    {tabKey === 'team' && 'No team boards'}
                    {tabKey === 'invited' && 'No invited boards'}
                    {tabKey === 'all' && 'No boards yet'}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {tabKey === 'personal' && 'Create a board to get started'}
                    {tabKey === 'team' && 'Assign boards to teams to see them here'}
                    {tabKey === 'invited' && 'Boards you\'ve been invited to will appear here'}
                    {tabKey === 'all' && 'Create your first board to start organizing'}
                  </p>
                  {(tabKey === 'all' || tabKey === 'personal') && (
                    <Button 
                      onClick={openCreateDialog}
                      className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Board
                    </Button>
                  )}
                </motion.div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {categorizedBoards[tabKey].map((board, index) => (
                    <motion.div
                      key={board.board_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group relative"
                    >
                      <Link 
                        to={`/board/${board.board_id}`}
                        className="block"
                        data-testid={`board-card-${board.board_id}`}
                      >
                        <div 
                          className="h-36 rounded-xl p-4 flex flex-col justify-between text-white hover:opacity-90 transition-opacity relative overflow-hidden"
                          style={{ 
                            backgroundColor: board.background || '#3A8B84',
                            backgroundImage: board.background_type === 'image' && board.background 
                              ? `url(${getImageUrl(board.background)})` 
                              : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        >
                          <div className="absolute inset-0 bg-black/30" />
                          <div className="relative z-10">
                            <h3 className="font-heading font-semibold text-lg drop-shadow-md">{board.name}</h3>
                            {/* Category badge */}
                            {board.category === 'team' && board.team_name && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs bg-white/20 rounded-full">
                                <Users className="w-3 h-3" />
                                {board.team_name}
                              </span>
                            )}
                            {board.category === 'invited' && board.invited_by_name && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs bg-white/20 rounded-full">
                                <UserPlus className="w-3 h-3" />
                                Invited by {board.invited_by_name}
                              </span>
                            )}
                          </div>
                          {/* Board Stats */}
                          <div className="relative z-10 flex items-center gap-3 text-white/90 text-sm">
                            <span className="flex items-center gap-1" title="Lists">
                              <List className="w-3.5 h-3.5" />
                              {board.list_count || 0}
                            </span>
                            <span className="flex items-center gap-1" title="Cards">
                              <Square className="w-3.5 h-3.5" />
                              {board.card_count || 0}
                            </span>
                            <span className="flex items-center gap-1" title="Attachments">
                              <Paperclip className="w-3.5 h-3.5" />
                              {board.attachment_count || 0}
                            </span>
                          </div>
                        </div>
                      </Link>
                      
                      {board.category !== 'invited' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className="absolute top-2 right-2 p-1.5 rounded-md bg-black/20 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40"
                              data-testid={`board-menu-${board.board_id}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem 
                              onClick={() => deleteBoard(board.board_id)}
                              className="text-destructive cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </motion.div>
                  ))}

                  {/* Add Board Card - only show on personal tab */}
                  {tabKey === 'personal' && (
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: categorizedBoards[tabKey].length * 0.05 }}
                      onClick={openCreateDialog}
                      className="h-36 rounded-xl border-2 border-dashed border-border hover:border-odapto-orange/50 flex items-center justify-center gap-2 text-muted-foreground hover:text-odapto-orange transition-colors"
                      data-testid="add-board-card"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Add Board</span>
                    </motion.button>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
