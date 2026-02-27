import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete, apiCall } from '../utils/api';
import CardDetailModal from '../components/CardDetailModal';
import { 
  Plus, 
  Moon, 
  Sun, 
  LogOut,
  ArrowLeft,
  MoreHorizontal,
  Trash2,
  Edit2,
  X,
  Calendar,
  CheckSquare,
  Users,
  UserPlus,
  Image,
  Palette,
  Bell
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_27d48b6b-dd80-4045-b25e-4aeef47ff911/artifacts/8ilbqloe_download.png";
const API_BASE = process.env.REACT_APP_BACKEND_URL;

const LABEL_COLORS = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500'
};

const BOARD_COLORS = [
  '#3A8B84', '#E67E4C', '#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#8B5CF6', '#06B6D4',
  '#EF4444', '#22C55E', '#3B82F6', '#A855F7', '#F97316', '#84CC16'
];

export default function BoardPage() {
  const { boardId } = useParams();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingListId, setAddingListId] = useState(null);
  const [newListName, setNewListName] = useState('');
  const [addingCardListId, setAddingCardListId] = useState(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);

  const fetchBoard = useCallback(async () => {
    try {
      const response = await apiGet(`/boards/${boardId}`);

      if (response.ok) {
        setBoard(await response.json());
      } else {
        toast.error('Board not found');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Failed to fetch board:', error);
      toast.error('Failed to load board');
    } finally {
      setLoading(false);
    }
  }, [boardId, navigate]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === 'list') {
      const newLists = Array.from(board.lists);
      const [removed] = newLists.splice(source.index, 1);
      newLists.splice(destination.index, 0, removed);

      // Update positions
      const updatedLists = newLists.map((list, idx) => ({ ...list, position: idx }));
      setBoard({ ...board, lists: updatedLists });

      // Update in backend
      for (const list of updatedLists) {
        await apiPatch(`/lists/${list.list_id}`, { position: list.position });
      }
      return;
    }

    // Card drag
    const cardId = draggableId;
    const sourceListId = source.droppableId;
    const destListId = destination.droppableId;

    const newLists = [...board.lists];
    const sourceList = newLists.find(l => l.list_id === sourceListId);
    const destList = newLists.find(l => l.list_id === destListId);

    const [movedCard] = sourceList.cards.splice(source.index, 1);
    destList.cards.splice(destination.index, 0, movedCard);

    // Update positions
    sourceList.cards.forEach((card, idx) => card.position = idx);
    destList.cards.forEach((card, idx) => card.position = idx);

    setBoard({ ...board, lists: newLists });

    // Update in backend
    try {
      await apiPost(`/cards/${cardId}/move`, {
        target_list_id: destListId,
        position: destination.index
      });
    } catch (error) {
      console.error('Failed to move card:', error);
      fetchBoard(); // Refresh on error
    }
  };

  const addList = async () => {
    if (!newListName.trim()) return;

    try {
      const response = await apiPost(`/boards/${boardId}/lists`, { name: newListName });

      if (response.ok) {
        const newList = await response.json();
        newList.cards = [];
        setBoard({ ...board, lists: [...board.lists, newList] });
        setNewListName('');
        setAddingListId(null);
      }
    } catch (error) {
      console.error('Failed to add list:', error);
      toast.error('Failed to add list');
    }
  };

  const updateListName = async (listId) => {
    if (!editingListName.trim()) {
      setEditingListId(null);
      return;
    }

    try {
      await apiPatch(`/lists/${listId}`, { name: editingListName });

      const newLists = board.lists.map(l => 
        l.list_id === listId ? { ...l, name: editingListName } : l
      );
      setBoard({ ...board, lists: newLists });
      setEditingListId(null);
    } catch (error) {
      console.error('Failed to update list:', error);
      toast.error('Failed to update list');
    }
  };

  const deleteList = async (listId) => {
    if (!window.confirm('Delete this list and all its cards?')) return;

    try {
      await apiDelete(`/lists/${listId}`);

      setBoard({ ...board, lists: board.lists.filter(l => l.list_id !== listId) });
      toast.success('List deleted');
    } catch (error) {
      console.error('Failed to delete list:', error);
      toast.error('Failed to delete list');
    }
  };

  const addCard = async (listId) => {
    if (!newCardTitle.trim()) return;

    try {
      const response = await apiPost(`/lists/${listId}/cards`, { title: newCardTitle });

      if (response.ok) {
        const newCard = await response.json();
        const newLists = board.lists.map(l => {
          if (l.list_id === listId) {
            return { ...l, cards: [...l.cards, newCard] };
          }
          return l;
        });
        setBoard({ ...board, lists: newLists });
        setNewCardTitle('');
        setAddingCardListId(null);
      }
    } catch (error) {
      console.error('Failed to add card:', error);
      toast.error('Failed to add card');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const onCardUpdate = (updatedCard) => {
    const newLists = board.lists.map(list => ({
      ...list,
      cards: list.cards.map(card => 
        card.card_id === updatedCard.card_id ? updatedCard : card
      )
    }));
    setBoard({ ...board, lists: newLists });
    setSelectedCard(updatedCard);
  };

  const onCardDelete = (cardId) => {
    const newLists = board.lists.map(list => ({
      ...list,
      cards: list.cards.filter(card => card.card_id !== cardId)
    }));
    setBoard({ ...board, lists: newLists });
    setSelectedCard(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-odapto-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: board?.background || '#3A8B84' }}
    >
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link 
                to={`/workspace/${board?.workspace_id}`} 
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="font-heading text-xl font-semibold text-white">{board?.name}</h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2" data-testid="user-menu-btn">
                    <Avatar className="h-8 w-8 border-2 border-white/30">
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

      {/* Board Content */}
      <div className="flex-1 overflow-x-auto p-4 kanban-scroll">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="board" type="list" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex gap-4 items-start h-full"
              >
                {board?.lists?.map((list, index) => (
                  <Draggable key={list.list_id} draggableId={list.list_id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex-shrink-0 w-72 bg-card rounded-xl shadow-lg ${
                          snapshot.isDragging ? 'rotate-3 scale-105' : ''
                        }`}
                        data-testid={`list-${list.list_id}`}
                      >
                        {/* List Header */}
                        <div 
                          {...provided.dragHandleProps}
                          className="p-3 flex items-center justify-between border-b border-border"
                        >
                          {editingListId === list.list_id ? (
                            <input
                              type="text"
                              value={editingListName}
                              onChange={(e) => setEditingListName(e.target.value)}
                              onBlur={() => updateListName(list.list_id)}
                              onKeyDown={(e) => e.key === 'Enter' && updateListName(list.list_id)}
                              className="flex-1 bg-transparent border-none outline-none font-semibold text-card-foreground"
                              autoFocus
                            />
                          ) : (
                            <h3 
                              className="font-semibold text-card-foreground cursor-pointer"
                              onClick={() => {
                                setEditingListId(list.list_id);
                                setEditingListName(list.name);
                              }}
                            >
                              {list.name}
                              {list.wip_limit && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({list.cards?.length || 0}/{list.wip_limit})
                                </span>
                              )}
                            </h3>
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 hover:bg-muted rounded transition-colors">
                                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setEditingListId(list.list_id);
                                  setEditingListName(list.name);
                                }}
                              >
                                <Edit2 className="w-4 h-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deleteList(list.list_id)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Cards */}
                        <Droppable droppableId={list.list_id} type="card">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`p-2 min-h-[50px] max-h-[calc(100vh-250px)] overflow-y-auto ${
                                snapshot.isDraggingOver ? 'bg-odapto-orange/10' : ''
                              }`}
                            >
                              {list.cards?.map((card, cardIndex) => (
                                <Draggable 
                                  key={card.card_id} 
                                  draggableId={card.card_id} 
                                  index={cardIndex}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => setSelectedCard(card)}
                                      className={`p-3 mb-2 bg-background rounded-lg border border-border hover:border-odapto-orange/50 cursor-pointer transition-all ${
                                        snapshot.isDragging ? 'shadow-lg rotate-3' : 'shadow-sm'
                                      }`}
                                      data-testid={`card-${card.card_id}`}
                                    >
                                      {/* Labels */}
                                      {card.labels?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {card.labels.map((label, idx) => (
                                            <span 
                                              key={idx}
                                              className={`h-2 w-8 rounded-full ${LABEL_COLORS[label] || 'bg-gray-400'}`}
                                            />
                                          ))}
                                        </div>
                                      )}
                                      
                                      <p className="text-sm font-medium text-card-foreground">
                                        {card.title}
                                      </p>
                                      
                                      {/* Card badges */}
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        {card.due_date && (
                                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(card.due_date).toLocaleDateString()}
                                          </span>
                                        )}
                                        {card.checklist?.length > 0 && (
                                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <CheckSquare className="w-3 h-3" />
                                            {card.checklist.filter(c => c.completed).length}/{card.checklist.length}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>

                        {/* Add Card */}
                        <div className="p-2 border-t border-border">
                          {addingCardListId === list.list_id ? (
                            <div className="space-y-2">
                              <Input
                                placeholder="Enter card title..."
                                value={newCardTitle}
                                onChange={(e) => setNewCardTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCard(list.list_id)}
                                autoFocus
                                data-testid="new-card-input"
                              />
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => addCard(list.list_id)}
                                  className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                                  data-testid="add-card-submit-btn"
                                >
                                  Add
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => {
                                    setAddingCardListId(null);
                                    setNewCardTitle('');
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAddingCardListId(list.list_id)}
                              className="w-full p-2 text-left text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-2"
                              data-testid={`add-card-btn-${list.list_id}`}
                            >
                              <Plus className="w-4 h-4" />
                              Add a card
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}

                {/* Add List */}
                <div className="flex-shrink-0 w-72">
                  {addingListId ? (
                    <div className="bg-card rounded-xl p-3 shadow-lg space-y-2">
                      <Input
                        placeholder="Enter list name..."
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addList()}
                        autoFocus
                        data-testid="new-list-input"
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={addList}
                          className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                          data-testid="add-list-submit-btn"
                        >
                          Add List
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setAddingListId(null);
                            setNewListName('');
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingListId(true)}
                      className="w-full p-3 bg-white/20 hover:bg-white/30 rounded-xl text-white font-medium flex items-center gap-2 transition-colors"
                      data-testid="add-list-btn"
                    >
                      <Plus className="w-5 h-5" />
                      Add another list
                    </button>
                  )}
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onUpdate={onCardUpdate}
          onDelete={onCardDelete}
        />
      )}
    </div>
  );
}
