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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete, apiCall } from '../utils/api';
import CardDetailModal from '../components/CardDetailModal';
import NotificationBell from '../components/NotificationBell';
import { ResponsiveLogo } from '../components/ThemeLogo';
import { isToday, isPast, isFuture } from 'date-fns';
import { API_BASE_URL, getWebSocketUrl } from '../config';
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
  Bell,
  Paperclip,
  Copy,
  MoveRight,
  MoreVertical,
  Layers,
  BookTemplate,
  User,
  Plug,
  KeyRound,
  HelpCircle,
  Crown,
  Shield
} from 'lucide-react';
const API_BASE = API_BASE_URL;

const BOARD_COLORS = [
  '#3A8B84', '#E67E4C', '#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#8B5CF6', '#06B6D4',
  '#EF4444', '#22C55E', '#3B82F6', '#A855F7', '#F97316', '#84CC16'
];

// Helper function for due date color
const getDueDateClass = (dueDate) => {
  if (!dueDate) return '';
  const date = new Date(dueDate);
  const today = new Date();
  // Normalize to start of day for comparison
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'bg-orange-500/20 text-orange-600'; // Today - orange
  }
  if (dateOnly.getTime() < todayOnly.getTime()) {
    return 'bg-red-500/20 text-red-600'; // Past - red (overdue)
  }
  return 'bg-muted text-muted-foreground'; // Future - gray
};

export default function BoardPage() {
  const { boardId } = useParams();
  const { user, logout, isPrivileged, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingListId, setAddingListId] = useState(null);
  const [newListName, setNewListName] = useState('');
  const [addingCardListId, setAddingCardListId] = useState(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  
  // New state for member invitation
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [boardMembers, setBoardMembers] = useState([]);
  const [showMembersPopover, setShowMembersPopover] = useState(false);
  
  // Background customization
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  
  // Card actions state
  const [moveCardDialogOpen, setMoveCardDialogOpen] = useState(false);
  const [cardToMove, setCardToMove] = useState(null);
  const [targetListId, setTargetListId] = useState('');
  
  // Publish as template state
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [templateCategories, setTemplateCategories] = useState([]);
  const [publishTemplateName, setPublishTemplateName] = useState('');
  const [publishTemplateDesc, setPublishTemplateDesc] = useState('');
  const [publishCategoryId, setPublishCategoryId] = useState('');
  const [publishing, setPublishing] = useState(false);
  
  // WebSocket connection ref
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

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

  // Fetch board members
  useEffect(() => {
    const fetchMembers = async () => {
      if (!boardId) return;
      try {
        const response = await apiGet(`/boards/${boardId}/members`);
        if (response.ok) {
          setBoardMembers(await response.json());
        }
      } catch (error) {
        console.error('Failed to fetch members:', error);
      }
    };
    fetchMembers();
  }, [boardId]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!boardId || !user) return;
    
    const connectWebSocket = () => {
      // Get WebSocket URL using central config
      const wsUrl = getWebSocketUrl(`/ws/board/${boardId}`);
      
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message:', data.type);
          
          // Handle different message types
          switch (data.type) {
            case 'card_created':
              setBoard(prev => {
                if (!prev) return prev;
                const newLists = prev.lists.map(l => {
                  if (l.list_id === data.list_id) {
                    // Check if card already exists to prevent duplicates
                    const cardExists = l.cards.some(c => c.card_id === data.card.card_id);
                    if (!cardExists) {
                      return { ...l, cards: [...l.cards, data.card] };
                    }
                  }
                  return l;
                });
                return { ...prev, lists: newLists };
              });
              break;
              
            case 'card_updated':
              setBoard(prev => {
                if (!prev) return prev;
                const newLists = prev.lists.map(l => ({
                  ...l,
                  cards: l.cards.map(c => 
                    c.card_id === data.card.card_id ? data.card : c
                  )
                }));
                return { ...prev, lists: newLists };
              });
              // Also update selected card if it's the one being updated
              setSelectedCard(prev => 
                prev?.card_id === data.card.card_id ? data.card : prev
              );
              break;
              
            case 'card_deleted':
              setBoard(prev => {
                if (!prev) return prev;
                const newLists = prev.lists.map(l => ({
                  ...l,
                  cards: l.cards.filter(c => c.card_id !== data.card_id)
                }));
                return { ...prev, lists: newLists };
              });
              // Close modal if deleted card was selected
              setSelectedCard(prev => 
                prev?.card_id === data.card_id ? null : prev
              );
              break;
              
            case 'card_moved':
              setBoard(prev => {
                if (!prev) return prev;
                let movedCard = null;
                const newLists = prev.lists.map(l => {
                  if (l.list_id === data.from_list_id) {
                    const card = l.cards.find(c => c.card_id === data.card_id);
                    if (card) movedCard = { ...card, list_id: data.to_list_id };
                    return { ...l, cards: l.cards.filter(c => c.card_id !== data.card_id) };
                  }
                  return l;
                });
                return {
                  ...prev,
                  lists: newLists.map(l => {
                    if (l.list_id === data.to_list_id && movedCard) {
                      return { ...l, cards: [...l.cards, movedCard] };
                    }
                    return l;
                  })
                };
              });
              break;
              
            case 'list_created':
              setBoard(prev => {
                if (!prev) return prev;
                const listExists = prev.lists.some(l => l.list_id === data.list.list_id);
                if (!listExists) {
                  return { ...prev, lists: [...prev.lists, { ...data.list, cards: [] }] };
                }
                return prev;
              });
              break;
              
            case 'list_updated':
              setBoard(prev => {
                if (!prev) return prev;
                const newLists = prev.lists.map(l => 
                  l.list_id === data.list.list_id ? { ...l, ...data.list } : l
                );
                return { ...prev, lists: newLists };
              });
              break;
              
            case 'list_deleted':
              setBoard(prev => {
                if (!prev) return prev;
                return { ...prev, lists: prev.lists.filter(l => l.list_id !== data.list_id) };
              });
              break;
              
            case 'member_joined':
            case 'member_assigned':
              // Refresh members
              apiGet(`/boards/${boardId}/members`).then(res => {
                if (res.ok) res.json().then(setBoardMembers);
              });
              break;
              
            case 'new_comment':
              // Update card comments in real-time
              setSelectedCard(prev => {
                if (prev?.card_id === data.card_id) {
                  return {
                    ...prev,
                    comments: [...(prev.comments || []), data.comment]
                  };
                }
                return prev;
              });
              break;
              
            case 'checklist_item_added':
            case 'checklist_item_toggled':
              // Refresh the selected card if it's the affected one
              if (data.card_id) {
                apiGet(`/cards/${data.card_id}`).then(res => {
                  if (res.ok) {
                    res.json().then(card => {
                      setSelectedCard(prev => prev?.card_id === card.card_id ? card : prev);
                      setBoard(prev => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          lists: prev.lists.map(l => ({
                            ...l,
                            cards: l.cards.map(c => c.card_id === card.card_id ? card : c)
                          }))
                        };
                      });
                    });
                  }
                });
              }
              break;
              
            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (boardId && user) {
            connectWebSocket();
          }
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };
    
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [boardId, user]);

  // Invite member
  const inviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    setInviting(true);
    try {
      const response = await apiPost(`/boards/${boardId}/invite`, {
        email: inviteEmail,
        role: inviteRole
      });
      
      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        setInviteEmail('');
        setShowInviteDialog(false);
        // Refresh members
        const membersRes = await apiGet(`/boards/${boardId}/members`);
        if (membersRes.ok) {
          setBoardMembers(await membersRes.json());
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to invite member');
      }
    } catch (error) {
      console.error('Failed to invite member:', error);
      toast.error('Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  // Remove member
  const removeMember = async (memberUserId) => {
    if (!window.confirm('Remove this member from the board?')) return;
    
    try {
      const response = await apiDelete(`/boards/${boardId}/members/${memberUserId}`);
      if (response.ok) {
        setBoardMembers(boardMembers.filter(m => m.user_id !== memberUserId));
        toast.success('Member removed');
      } else {
        toast.error('Failed to remove member');
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  // Change board background color
  const changeBackgroundColor = async (color) => {
    try {
      const response = await apiPatch(`/boards/${boardId}`, {
        background: color,
        background_type: 'color'
      });
      if (response.ok) {
        setBoard({ ...board, background: color, background_type: 'color' });
        toast.success('Background updated');
      }
    } catch (error) {
      console.error('Failed to update background:', error);
    }
    setShowBackgroundPicker(false);
  };

  // Upload background image
  const handleBackgroundUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingBackground(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiCall(`/boards/${boardId}/background`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        setBoard({ ...board, background: result.background, background_type: 'image' });
        toast.success('Background image uploaded');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Failed to upload background:', error);
      toast.error('Failed to upload background image');
    } finally {
      setUploadingBackground(false);
      setShowBackgroundPicker(false);
    }
  };

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

  // Copy card within the same list
  const copyCard = async (card, listId, e) => {
    e.stopPropagation();
    try {
      const response = await apiPost(`/lists/${listId}/cards`, { 
        title: `${card.title} (Copy)`,
        description: card.description,
        due_date: card.due_date,
        labels: card.labels,
        priority: card.priority
      });

      if (response.ok) {
        const newCard = await response.json();
        const newLists = board.lists.map(l => {
          if (l.list_id === listId) {
            return { ...l, cards: [...l.cards, newCard] };
          }
          return l;
        });
        setBoard({ ...board, lists: newLists });
        toast.success('Card copied!');
      }
    } catch (error) {
      console.error('Failed to copy card:', error);
      toast.error('Failed to copy card');
    }
  };

  // Move card to another list
  const moveCard = async (cardId, sourceListId, targetListId, e) => {
    if (e) e.stopPropagation();
    if (!targetListId || sourceListId === targetListId) {
      toast.error('Please select a different list');
      return;
    }
    
    try {
      const response = await apiPost(`/cards/${cardId}/move`, { 
        target_list_id: targetListId 
      });

      if (response.ok) {
        // Find the card to move
        const sourceList = board.lists.find(l => l.list_id === sourceListId);
        const cardToMove = sourceList?.cards.find(c => c.card_id === cardId);
        
        if (cardToMove) {
          const newLists = board.lists.map(l => {
            if (l.list_id === sourceListId) {
              return { ...l, cards: l.cards.filter(c => c.card_id !== cardId) };
            }
            if (l.list_id === targetListId) {
              return { ...l, cards: [...l.cards, { ...cardToMove, list_id: targetListId }] };
            }
            return l;
          });
          setBoard({ ...board, lists: newLists });
        }
        
        setMoveCardDialogOpen(false);
        setCardToMove(null);
        setTargetListId('');
        toast.success('Card moved!');
      }
    } catch (error) {
      console.error('Failed to move card:', error);
      toast.error('Failed to move card');
    }
  };

  // Delete card
  const deleteCard = async (cardId, listId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this card?')) return;
    
    try {
      const response = await apiDelete(`/cards/${cardId}`);

      if (response.ok) {
        const newLists = board.lists.map(l => {
          if (l.list_id === listId) {
            return { ...l, cards: l.cards.filter(c => c.card_id !== cardId) };
          }
          return l;
        });
        setBoard({ ...board, lists: newLists });
        toast.success('Card deleted!');
      }
    } catch (error) {
      console.error('Failed to delete card:', error);
      toast.error('Failed to delete card');
    }
  };

  // Open move card dialog
  const openMoveCardDialog = (card, listId, e) => {
    e.stopPropagation();
    setCardToMove({ ...card, list_id: listId });
    setTargetListId('');
    setMoveCardDialogOpen(true);
  };

  // Fetch template categories
  const fetchTemplateCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/template-categories`);
      if (response.ok) {
        setTemplateCategories(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch template categories:', error);
    }
  };

  // Open publish dialog
  const openPublishDialog = () => {
    setPublishTemplateName(board?.name || '');
    setPublishTemplateDesc(board?.description || '');
    setPublishCategoryId('');
    fetchTemplateCategories();
    setShowPublishDialog(true);
  };

  // Publish board as template
  const publishAsTemplate = async (e) => {
    e.preventDefault();
    if (!publishTemplateName.trim() || !publishCategoryId) return;

    setPublishing(true);
    try {
      const response = await apiPost(`/boards/${boardId}/publish-template`, {
        template_name: publishTemplateName,
        template_description: publishTemplateDesc || null,
        category_id: publishCategoryId
      });

      if (response.ok) {
        toast.success('Board published as template!');
        setShowPublishDialog(false);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to publish template');
      }
    } catch (error) {
      console.error('Failed to publish template:', error);
      toast.error('Failed to publish template');
    } finally {
      setPublishing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const onCardUpdate = (updatedCard, isDuplicate) => {
    if (isDuplicate) {
      // Add the duplicated card to the same list
      const newLists = board.lists.map(list => 
        list.list_id === updatedCard.list_id 
          ? { ...list, cards: [...list.cards, updatedCard] }
          : list
      );
      setBoard({ ...board, lists: newLists });
      return;
    }
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

  // Determine background style
  const backgroundStyle = board?.background_type === 'image' && board?.background
    ? {
        backgroundImage: `url(${API_BASE}${board.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }
    : { backgroundColor: board?.background || '#3A8B84' };

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={backgroundStyle}
    >
      {/* Hidden file input for background upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleBackgroundUpload}
        accept="image/*"
        className="hidden"
      />

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

            <div className="flex items-center gap-2">
              {/* Board Members */}
              <Popover open={showMembersPopover} onOpenChange={setShowMembersPopover}>
                <PopoverTrigger asChild>
                  <button 
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    data-testid="board-members-btn"
                  >
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{boardMembers.length}</span>
                    <div className="flex -space-x-2">
                      {boardMembers.slice(0, 3).map((member) => (
                        <Avatar key={member.user_id} className="h-6 w-6 border border-white/30">
                          <AvatarImage src={member.picture} />
                          <AvatarFallback className="bg-odapto-teal text-white text-xs">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Board Members</h4>
                      <Button 
                        size="sm" 
                        onClick={() => { setShowMembersPopover(false); setShowInviteDialog(true); }}
                        className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                        data-testid="invite-member-btn"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Invite
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {boardMembers.map((member) => (
                        <div key={member.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.picture} />
                              <AvatarFallback className="bg-odapto-teal text-white text-sm">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{member.name}</p>
                              <p className={`text-xs ${member.is_owner ? 'text-odapto-orange font-medium' : 'text-muted-foreground'}`}>
                                {member.role_label || (member.is_owner ? 'Board owner' : 'Board member')}
                              </p>
                            </div>
                          </div>
                          {board?.created_by === user?.user_id && member.user_id !== user?.user_id && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeMember(member.user_id)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Background Picker */}
              <Popover open={showBackgroundPicker} onOpenChange={setShowBackgroundPicker}>
                <PopoverTrigger asChild>
                  <button 
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    data-testid="background-picker-btn"
                  >
                    <Palette className="w-5 h-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-3">
                    <h4 className="font-semibold">Board Background</h4>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Colors</p>
                      <div className="grid grid-cols-7 gap-1">
                        {BOARD_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => changeBackgroundColor(color)}
                            className={`w-7 h-7 rounded ${board?.background === color && board?.background_type === 'color' ? 'ring-2 ring-offset-2 ring-foreground' : ''}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Custom Image</p>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingBackground}
                      >
                        <Image className="w-4 h-4 mr-2" />
                        {uploadingBackground ? 'Uploading...' : 'Upload Image'}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Publish as Template - Only for privileged/admin users who own the board */}
              {(isPrivileged || isAdmin) && board?.created_by === user?.user_id && (
                <button
                  onClick={openPublishDialog}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-sm"
                  data-testid="publish-template-btn"
                >
                  <Layers className="w-4 h-4" />
                  Publish
                </button>
              )}

              {/* Notification Bell */}
              <NotificationBell />

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
                                      className={`group/card p-3 mb-2 bg-background rounded-lg border border-border hover:border-odapto-orange/50 cursor-pointer transition-all relative ${
                                        snapshot.isDragging ? 'shadow-lg rotate-3' : 'shadow-sm'
                                      }`}
                                      data-testid={`card-${card.card_id}`}
                                    >
                                      {/* Card Actions Menu */}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button 
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute top-2 right-2 p-1 rounded bg-muted/80 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-muted"
                                            data-testid={`card-actions-${card.card_id}`}
                                          >
                                            <MoreVertical className="w-3.5 h-3.5" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                          <DropdownMenuItem onClick={(e) => copyCard(card, list.list_id, e)} className="cursor-pointer">
                                            <Copy className="w-4 h-4 mr-2" />
                                            Copy Card
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={(e) => openMoveCardDialog(card, list.list_id, e)} className="cursor-pointer">
                                            <MoveRight className="w-4 h-4 mr-2" />
                                            Move Card
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem 
                                            onClick={(e) => deleteCard(card.card_id, list.list_id, e)} 
                                            className="text-destructive cursor-pointer"
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete Card
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                      
                                      {/* Cover Image */}
                                      {card.cover_image && (
                                        <div className="mb-2 -mx-3 -mt-3 rounded-t-lg overflow-hidden">
                                          <img 
                                            src={card.cover_image.startsWith('http') ? card.cover_image : `${API_BASE}${card.cover_image}`} 
                                            alt="" 
                                            className="w-full h-32 object-cover"
                                          />
                                        </div>
                                      )}
                                      
                                      {/* Labels */}
                                      {/* Labels */}
                                      {card.labels?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {card.labels.map((label, idx) => (
                                            <span 
                                              key={idx}
                                              className="h-2 w-8 rounded-full"
                                              style={{ backgroundColor: label.color || label }}
                                              title={label.name || ''}
                                            />
                                          ))}
                                        </div>
                                      )}
                                      
                                      <p className="text-sm font-medium text-card-foreground">
                                        {card.title}
                                      </p>
                                      
                                      {/* Card badges */}
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        {/* Priority badge */}
                                        {card.priority && (
                                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                            card.priority === 'urgent' ? 'bg-red-500/20 text-red-600' :
                                            card.priority === 'high' ? 'bg-orange-500/20 text-orange-600' :
                                            card.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-600' :
                                            'bg-green-500/20 text-green-600'
                                          }`}>
                                            {card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}
                                          </span>
                                        )}
                                        {/* Due date with color coding */}
                                        {card.due_date && (
                                          <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${getDueDateClass(card.due_date)}`}>
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
                                        {card.attachments?.length > 0 && (
                                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Paperclip className="w-3 h-3" />
                                            {card.attachments.length}
                                          </span>
                                        )}
                                      </div>
                                      {/* Assigned members */}
                                      {card.assigned_members?.length > 0 && (
                                        <div className="flex -space-x-1 mt-2">
                                          {card.assigned_members.slice(0, 3).map((member) => (
                                            <Avatar key={member.user_id} className="h-6 w-6 border-2 border-background">
                                              <AvatarImage src={member.picture} />
                                              <AvatarFallback className="bg-odapto-teal text-white text-xs">
                                                {getInitials(member.name)}
                                              </AvatarFallback>
                                            </Avatar>
                                          ))}
                                          {card.assigned_members.length > 3 && (
                                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs border-2 border-background">
                                              +{card.assigned_members.length - 3}
                                            </span>
                                          )}
                                        </div>
                                      )}
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

      {/* Invite Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Invite someone to collaborate on this board. They will receive a notification.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={inviteMember} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                data-testid="invite-email-input"
              />
              <p className="text-xs text-muted-foreground">
                The user must already have an Odapto account
              </p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={inviteRole === 'member' ? 'default' : 'outline'}
                  onClick={() => setInviteRole('member')}
                  className={inviteRole === 'member' ? 'bg-odapto-teal hover:bg-odapto-teal-hover text-white' : ''}
                >
                  Member
                </Button>
                <Button
                  type="button"
                  variant={inviteRole === 'viewer' ? 'default' : 'outline'}
                  onClick={() => setInviteRole('viewer')}
                  className={inviteRole === 'viewer' ? 'bg-odapto-teal hover:bg-odapto-teal-hover text-white' : ''}
                >
                  Viewer
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {inviteRole === 'member' ? 'Can edit cards and lists' : 'Can only view the board'}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                disabled={inviting}
                data-testid="send-invite-btn"
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move Card Dialog */}
      <Dialog open={moveCardDialogOpen} onOpenChange={setMoveCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Card</DialogTitle>
            <DialogDescription>
              Select a list to move "{cardToMove?.title}" to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Destination List</Label>
              <Select value={targetListId} onValueChange={setTargetListId}>
                <SelectTrigger data-testid="move-card-list-select">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {board?.lists?.filter(l => l.list_id !== cardToMove?.list_id).map(list => (
                    <SelectItem key={list.list_id} value={list.list_id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setMoveCardDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={(e) => moveCard(cardToMove?.card_id, cardToMove?.list_id, targetListId, e)} 
                className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                disabled={!targetListId}
                data-testid="move-card-submit-btn"
              >
                Move Card
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish as Template Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-odapto-orange" />
              Publish as Template
            </DialogTitle>
            <DialogDescription>
              Share this board structure with the community. Lists and cards will be copied as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={publishAsTemplate} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Project Kickoff"
                value={publishTemplateName}
                onChange={(e) => setPublishTemplateName(e.target.value)}
                required
                data-testid="template-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-desc">Description (optional)</Label>
              <Input
                id="template-desc"
                placeholder="A brief description of when to use this template"
                value={publishTemplateDesc}
                onChange={(e) => setPublishTemplateDesc(e.target.value)}
                data-testid="template-desc-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={publishCategoryId} onValueChange={setPublishCategoryId}>
                <SelectTrigger data-testid="template-category-select">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {templateCategories.map((cat) => (
                    <SelectItem key={cat.category_id} value={cat.category_id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateCategories.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No categories available. Ask an admin to create template categories.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowPublishDialog(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                disabled={publishing || !publishCategoryId || !publishTemplateName.trim()}
                data-testid="publish-template-submit-btn"
              >
                {publishing ? 'Publishing...' : 'Publish Template'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
