import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
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
import { apiGet, apiPost, apiDelete } from '../utils/api';
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
  MoreVertical
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_27d48b6b-dd80-4045-b25e-4aeef47ff911/artifacts/8ilbqloe_download.png";

const BOARD_COLORS = [
  '#3A8B84', '#E67E4C', '#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#8B5CF6', '#06B6D4'
];

export default function WorkspacePage() {
  const { workspaceId } = useParams();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [workspace, setWorkspace] = useState(null);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardColor, setNewBoardColor] = useState(BOARD_COLORS[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaceData();
  }, [workspaceId]);

  const fetchWorkspaceData = async () => {
    try {
      const [wsRes, boardsRes] = await Promise.all([
        apiGet(`/workspaces/${workspaceId}`),
        apiGet(`/workspaces/${workspaceId}/boards`)
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
    } catch (error) {
      console.error('Failed to fetch workspace:', error);
      toast.error('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  const createBoard = async (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    setCreating(true);
    try {
      const response = await apiPost(`/workspaces/${workspaceId}/boards`, {
        name: newBoardName,
        background: newBoardColor
      });

      if (response.ok) {
        const board = await response.json();
        setBoards([...boards, board]);
        setNewBoardName('');
        setNewBoardColor(BOARD_COLORS[0]);
        setCreateDialogOpen(false);
        toast.success('Board created!');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create board');
      }
    } catch (error) {
      console.error('Failed to create board:', error);
      toast.error('Failed to create board');
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
                <img src={LOGO_URL} alt="Odapto" className="h-8 w-auto" />
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
                  </div>
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
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                  data-testid="create-board-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Board
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Board</DialogTitle>
                  <DialogDescription>Create a new board to organize your tasks.</DialogDescription>
                </DialogHeader>
                <form onSubmit={createBoard} className="space-y-4 mt-4">
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
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                      disabled={creating}
                      data-testid="create-board-submit-btn"
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Boards Grid */}
        {boards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <LayoutGrid className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-heading text-xl font-semibold mb-2">No boards yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first board to start organizing your work
            </p>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Board
            </Button>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {boards.map((board, index) => (
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
                    className="h-32 rounded-xl p-4 flex flex-col justify-between text-white hover:opacity-90 transition-opacity relative overflow-hidden"
                    style={{ backgroundColor: board.background || '#3A8B84' }}
                  >
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="relative z-10">
                      <h3 className="font-heading font-semibold text-lg">{board.name}</h3>
                    </div>
                  </div>
                </Link>
                
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
              </motion.div>
            ))}

            {/* Add Board Card */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: boards.length * 0.05 }}
              onClick={() => setCreateDialogOpen(true)}
              className="h-32 rounded-xl border-2 border-dashed border-border hover:border-odapto-orange/50 flex items-center justify-center gap-2 text-muted-foreground hover:text-odapto-orange transition-colors"
              data-testid="add-board-card"
            >
              <Plus className="w-5 h-5" />
              <span>Add Board</span>
            </motion.button>
          </div>
        )}
      </main>
    </div>
  );
}
