import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
import { format, isToday, isPast, isFuture, formatDistanceToNow } from 'date-fns';
import { apiPatch, apiPost, apiDelete, apiCall, apiGet } from '../utils/api';
import DriveFilePicker from './DriveFilePicker';
import DropboxFilePicker from './DropboxFilePicker';
import { 
  Calendar as CalendarIcon, 
  Tag, 
  Paperclip,
  CheckSquare,
  MessageSquare,
  Trash2,
  Plus,
  Send,
  UserPlus,
  X,
  Flag,
  Upload,
  History,
  User,
  Edit3,
  Move,
  AlertCircle,
  Eye,
  Download,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Copy,
  HardDrive
} from 'lucide-react';
import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;

const LABEL_COLORS = [
  { color: '#EF4444', name: 'Red' },
  { color: '#F97316', name: 'Orange' },
  { color: '#EAB308', name: 'Yellow' },
  { color: '#22C55E', name: 'Green' },
  { color: '#3B82F6', name: 'Blue' },
  { color: '#8B5CF6', name: 'Purple' },
  { color: '#EC4899', name: 'Pink' },
  { color: '#6B7280', name: 'Gray' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' }
];

// Activity description helper
const getActivityDescription = (activity) => {
  const details = activity.details || {};
  switch (activity.action) {
    case 'created':
      return `created this card in "${details.list_name || 'a list'}"`;
    case 'updated_title':
      return `changed the title from "${details.old_title}" to "${details.title}"`;
    case 'updated_description':
      return 'updated the description';
    case 'set_due_date':
      return `set the due date to ${format(new Date(details.due_date), 'MMM d, yyyy')}`;
    case 'removed_due_date':
      return 'removed the due date';
    case 'set_priority':
      return `changed priority to ${details.priority || 'none'}`;
    case 'added_label':
      return `added a label`;
    case 'removed_label':
      return `removed a label`;
    case 'added_member':
      return `added ${details.member_name} to this card`;
    case 'removed_member':
      return `removed ${details.member_name} from this card`;
    case 'added_checklist_item':
      return `added "${details.item_text}" to the checklist`;
    case 'completed_checklist_item':
      return `completed "${details.item_text}"`;
    case 'uncompleted_checklist_item':
      return `marked "${details.item_text}" as incomplete`;
    case 'added_comment':
      return `commented: "${details.comment_preview}..."`;
    case 'added_attachment':
      return `attached ${details.filename}`;
    case 'moved':
      return `moved this card from "${details.from_list}" to "${details.to_list}"`;
    case 'deleted':
      return 'deleted this card';
    default:
      return activity.action;
  }
};

const getActivityIcon = (action) => {
  switch (action) {
    case 'created':
      return <Plus className="w-3 h-3" />;
    case 'updated_title':
    case 'updated_description':
      return <Edit3 className="w-3 h-3" />;
    case 'set_due_date':
    case 'removed_due_date':
      return <CalendarIcon className="w-3 h-3" />;
    case 'set_priority':
      return <Flag className="w-3 h-3" />;
    case 'added_label':
    case 'removed_label':
      return <Tag className="w-3 h-3" />;
    case 'added_member':
    case 'removed_member':
      return <UserPlus className="w-3 h-3" />;
    case 'added_checklist_item':
    case 'completed_checklist_item':
    case 'uncompleted_checklist_item':
      return <CheckSquare className="w-3 h-3" />;
    case 'added_comment':
      return <MessageSquare className="w-3 h-3" />;
    case 'added_attachment':
      return <Paperclip className="w-3 h-3" />;
    case 'moved':
      return <Move className="w-3 h-3" />;
    case 'deleted':
      return <Trash2 className="w-3 h-3" />;
    default:
      return <AlertCircle className="w-3 h-3" />;
  }
};

export const CardDetailModal = ({ card, onClose, onUpdate, onDelete }) => {
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [dueDate, setDueDate] = useState(card.due_date ? new Date(card.due_date) : null);
  const [labels, setLabels] = useState(card.labels || []);
  const [priority, setPriority] = useState(card.priority || '');
  const [checklist, setChecklist] = useState(card.checklist || []);
  const [comments, setComments] = useState(card.comments || []);
  const [assignedMembers, setAssignedMembers] = useState(card.assigned_members || []);
  const [attachments, setAttachments] = useState(card.attachments || []);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Member invite state
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  
  // Label editing state
  const [editingLabel, setEditingLabel] = useState(null);
  const [newLabelName, setNewLabelName] = useState('');
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  
  // Attachment upload
  const [uploading, setUploading] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [dropboxPickerOpen, setDropboxPickerOpen] = useState(false);
  
  // Activity history
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [showActivities, setShowActivities] = useState(false);

  // Fetch activities on mount
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await apiGet(`/cards/${card.card_id}/activities`);
        if (response.ok) {
          setActivities(await response.json());
        }
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setLoadingActivities(false);
      }
    };
    fetchActivities();
  }, [card.card_id]);

  const saveCard = async () => {
    setSaving(true);
    try {
      const response = await apiPatch(`/cards/${card.card_id}`, {
        title,
        description,
        due_date: dueDate?.toISOString(),
        labels,
        priority: priority || null
      });

      if (response.ok) {
        onUpdate({ ...card, title, description, due_date: dueDate?.toISOString(), labels, priority });
        toast.success('Card updated');
      } else {
        toast.error('Failed to update card');
      }
    } catch (error) {
      console.error('Failed to save card:', error);
      toast.error('Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async () => {
    if (!window.confirm('Delete this card?')) return;

    try {
      const response = await apiDelete(`/cards/${card.card_id}`);

      if (response.ok) {
        onDelete(card.card_id);
        toast.success('Card deleted');
      } else {
        toast.error('Failed to delete card');
      }
    } catch (error) {
      console.error('Failed to delete card:', error);
      toast.error('Failed to delete card');
    }
  };

  // Label functions
  const addLabel = (color) => {
    const existing = labels.find(l => l.color === color);
    if (!existing) {
      const newLabel = { color, name: '' };
      setLabels([...labels, newLabel]);
    }
    setShowLabelPicker(false);
  };

  const updateLabelName = (color, name) => {
    setLabels(labels.map(l => l.color === color ? { ...l, name } : l));
  };

  const removeLabel = (color) => {
    setLabels(labels.filter(l => l.color !== color));
  };

  // Member invitation
  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;
    
    setInviting(true);
    try {
      const response = await apiPost(`/cards/${card.card_id}/invite`, {
        email: inviteEmail
      });
      
      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        if (result.member) {
          setAssignedMembers([...assignedMembers, result.member]);
          onUpdate({ ...card, assigned_members: [...assignedMembers, result.member] });
        }
        setInviteEmail('');
        setShowInviteInput(false);
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

  const removeMember = async (memberId) => {
    try {
      const response = await apiDelete(`/cards/${card.card_id}/members/${memberId}`);
      if (response.ok) {
        const updated = assignedMembers.filter(m => m.user_id !== memberId);
        setAssignedMembers(updated);
        onUpdate({ ...card, assigned_members: updated });
        toast.success('Member removed');
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;

    try {
      const response = await apiPost(`/cards/${card.card_id}/checklist`, { text: newChecklistItem });

      if (response.ok) {
        const item = await response.json();
        const updatedChecklist = [...checklist, item];
        setChecklist(updatedChecklist);
        onUpdate({ ...card, checklist: updatedChecklist });
        setNewChecklistItem('');
      }
    } catch (error) {
      console.error('Failed to add checklist item:', error);
      toast.error('Failed to add checklist item');
    }
  };

  const toggleChecklistItem = async (itemId) => {
    try {
      await apiPatch(`/cards/${card.card_id}/checklist/${itemId}`, {});

      const updatedChecklist = checklist.map(item =>
        item.item_id === itemId ? { ...item, completed: !item.completed } : item
      );
      setChecklist(updatedChecklist);
      onUpdate({ ...card, checklist: updatedChecklist });
    } catch (error) {
      console.error('Failed to toggle checklist item:', error);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await apiPost(`/cards/${card.card_id}/comments`, { content: newComment });

      if (response.ok) {
        const comment = await response.json();
        const updatedComments = [...comments, comment];
        setComments(updatedComments);
        onUpdate({ ...card, comments: updatedComments });
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment');
    }
  };

  // File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiCall(`/cards/${card.card_id}/attachments`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const attachment = await response.json();
        const updated = [...attachments, attachment];
        setAttachments(updated);
        onUpdate({ ...card, attachments: updated });
        toast.success('File uploaded');
      } else {
        toast.error('Failed to upload file');
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (fileId) => {
    if (!window.confirm('Delete this attachment?')) return;
    try {
      const response = await apiDelete(`/cards/${card.card_id}/attachments/${fileId}`);
      if (response.ok) {
        const updated = attachments.filter(a => a.file_id !== fileId);
        setAttachments(updated);
        onUpdate({ ...card, attachments: updated });
        toast.success('Attachment deleted');
      } else {
        toast.error('Failed to delete attachment');
      }
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      toast.error('Failed to delete attachment');
    }
  };

  const setAsCover = async (attachmentUrl) => {
    try {
      const response = await apiPatch(`/cards/${card.card_id}/cover`, { cover_image: attachmentUrl });
      if (response.ok) {
        onUpdate({ ...card, cover_image: attachmentUrl });
        toast.success('Cover image set');
      } else {
        toast.error('Failed to set cover');
      }
    } catch (error) {
      console.error('Failed to set cover:', error);
      toast.error('Failed to set cover');
    }
  };

  const deleteChecklistItem = async (itemId) => {
    try {
      const response = await apiDelete(`/cards/${card.card_id}/checklist/${itemId}`);
      if (response.ok) {
        const updated = checklist.filter(i => i.item_id !== itemId);
        setChecklist(updated);
        onUpdate({ ...card, checklist: updated });
        toast.success('Item removed');
      } else {
        toast.error('Failed to delete item');
      }
    } catch (error) {
      console.error('Failed to delete checklist item:', error);
    }
  };

  const duplicateCard = async () => {
    try {
      const response = await apiPost(`/cards/${card.card_id}/duplicate`);
      if (response.ok) {
        const newCard = await response.json();
        onUpdate(newCard, true);
        toast.success('Card duplicated');
        onClose();
      } else {
        toast.error('Failed to duplicate card');
      }
    } catch (error) {
      console.error('Failed to duplicate card:', error);
      toast.error('Failed to duplicate card');
    }
  };

  const completedCount = checklist.filter(item => item.completed).length;

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  // Due date color helper
  const getDueDateColor = () => {
    if (!dueDate) return 'text-muted-foreground';
    if (isToday(dueDate)) return 'text-orange-500';
    if (isPast(dueDate)) return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-semibold border-none p-0 focus-visible:ring-0"
              data-testid="card-title-input"
            />
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6 mt-4">
          {/* Main content - 2 columns */}
          <div className="col-span-2 space-y-6">
            {/* Labels */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Labels
              </Label>
              <div className="flex flex-wrap gap-2">
                {labels.map((label, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-sm"
                    style={{ backgroundColor: label.color }}
                  >
                    {editingLabel === idx ? (
                      <input
                        type="text"
                        value={label.name}
                        onChange={(e) => updateLabelName(label.color, e.target.value)}
                        onBlur={() => setEditingLabel(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingLabel(null)}
                        className="bg-transparent border-none outline-none w-20 text-sm"
                        placeholder="Label name"
                        autoFocus
                      />
                    ) : (
                      <span 
                        className="cursor-pointer"
                        onClick={() => setEditingLabel(idx)}
                      >
                        {label.name || 'Click to name'}
                      </span>
                    )}
                    <button onClick={() => removeLabel(label.color)} className="ml-1 hover:bg-white/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <Popover open={showLabelPicker} onOpenChange={setShowLabelPicker}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Label
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48">
                    <div className="grid grid-cols-4 gap-2">
                      {LABEL_COLORS.map((lc) => (
                        <button
                          key={lc.color}
                          onClick={() => addLabel(lc.color)}
                          className="w-8 h-8 rounded-lg"
                          style={{ backgroundColor: lc.color }}
                          title={lc.name}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Assigned Members */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Assigned Members
              </Label>
              <div className="flex flex-wrap gap-2 items-center">
                {assignedMembers.map((member) => (
                  <div key={member.user_id} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-full">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.picture} />
                      <AvatarFallback className="bg-odapto-teal text-white text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{member.name}</span>
                    <button 
                      onClick={() => removeMember(member.user_id)}
                      className="hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
                
                {showInviteInput ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && inviteMember()}
                      className="h-8 w-48"
                      data-testid="card-invite-email"
                    />
                    <Button 
                      size="sm" 
                      onClick={inviteMember}
                      disabled={inviting}
                      className="h-8 bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                    >
                      {inviting ? '...' : 'Add'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => { setShowInviteInput(false); setInviteEmail(''); }}
                      className="h-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowInviteInput(true)}
                    data-testid="add-member-btn"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Invite
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Invite anyone by email. New users will be added after they sign up.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Description
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a more detailed description..."
                rows={4}
                data-testid="card-description-input"
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments
                {attachments.length > 0 && (
                  <span className="text-muted-foreground text-xs">({attachments.length})</span>
                )}
              </Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
              />
              <div className="space-y-3">
                {attachments.map((att, idx) => {
                  const isImage = att.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                  const isPdf = att.filename?.match(/\.pdf$/i);
                  const isDriveFile = att.source === 'google_drive';
                  const isDropboxFile = att.source === 'dropbox';
                  const fileUrl = att.url?.startsWith('http') ? att.url : `${API_BASE}${att.url}`;
                  
                  return (
                    <div key={idx} className="group border border-border rounded-lg overflow-hidden hover:border-odapto-orange/50 transition-colors">
                      {/* Preview Area */}
                      <div className="relative">
                        {isImage && !isDriveFile && !isDropboxFile ? (
                          <div className="h-32 bg-muted flex items-center justify-center overflow-hidden">
                            <img 
                              src={fileUrl} 
                              alt={att.filename}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-20 bg-muted flex items-center justify-center">
                            <div className="text-center">
                              {isDriveFile ? (
                                <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Drive" className="w-8 h-8 mx-auto mb-1" />
                              ) : isDropboxFile ? (
                                <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg" alt="Dropbox" className="w-8 h-8 mx-auto mb-1" />
                              ) : isPdf ? (
                                <FileText className="w-8 h-8 mx-auto text-red-500 mb-1" />
                              ) : (
                                <FileIcon className="w-8 h-8 mx-auto text-muted-foreground mb-1" />
                              )}
                              <span className="text-xs text-muted-foreground uppercase">
                                {isDriveFile ? 'Google Drive' : isDropboxFile ? 'Dropbox' : att.filename?.split('.').pop()}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Hover Actions Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-white" />
                          </a>
                          <a
                            href={fileUrl}
                            download={att.filename}
                            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-white" />
                          </a>
                          {isImage && (
                            <button
                              type="button"
                              onClick={() => setAsCover(att.url)}
                              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                              title="Set as Cover"
                              data-testid={`set-cover-btn-${idx}`}
                            >
                              <ImageIcon className="w-4 h-4 text-white" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteAttachment(att.file_id)}
                            className="p-2 bg-red-500/80 rounded-lg hover:bg-red-600 transition-colors"
                            title="Delete"
                            data-testid={`delete-attachment-btn-${idx}`}
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                      
                      {/* File Info */}
                      <div className="p-2 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{att.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(att.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Add Attachment'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDrivePickerOpen(true)}
                  className="w-full"
                  data-testid="attach-from-drive-btn"
                >
                  <HardDrive className="w-4 h-4 mr-2" />
                  Google Drive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDropboxPickerOpen(true)}
                  className="w-full"
                  data-testid="attach-from-dropbox-btn"
                >
                  <HardDrive className="w-4 h-4 mr-2" />
                  Dropbox
                </Button>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                Checklist
                {checklist.length > 0 && (
                  <span className="text-muted-foreground">
                    ({completedCount}/{checklist.length})
                  </span>
                )}
              </Label>
              
              {checklist.length > 0 && (
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-odapto-teal h-2 rounded-full transition-all"
                    style={{ width: `${checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0}%` }}
                  />
                </div>
              )}

              <div className="space-y-2">
                {checklist.map((item) => (
                  <div key={item.item_id} className="flex items-center gap-3 group">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleChecklistItem(item.item_id)}
                    />
                    <span className={`flex-1 ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {item.text}
                    </span>
                    <button
                      onClick={() => deleteChecklistItem(item.item_id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                      data-testid={`delete-checklist-item-${item.item_id}`}
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add an item..."
                  onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                  data-testid="checklist-input"
                />
                <Button size="sm" onClick={addChecklistItem} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments
              </Label>

              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.comment_id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{comment.user_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  onKeyDown={(e) => e.key === 'Enter' && addComment()}
                  data-testid="comment-input"
                />
                <Button size="sm" onClick={addComment} className="bg-odapto-orange hover:bg-odapto-orange-hover text-white">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Activity History */}
            <div className="space-y-3 pt-4 border-t border-border">
              <button
                onClick={() => setShowActivities(!showActivities)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid="toggle-activities-btn"
              >
                <History className="w-4 h-4" />
                Activity ({activities.length})
                <span className="text-xs">{showActivities ? '▼' : '▶'}</span>
              </button>
              
              {showActivities && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {loadingActivities ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Loading activity...
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No activity yet
                    </div>
                  ) : (
                    activities.map((activity) => (
                      <div 
                        key={activity.activity_id} 
                        className="flex gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0 mt-0.5">
                          {getActivityIcon(activity.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{activity.user_name}</span>
                            {' '}
                            <span className="text-muted-foreground">{getActivityDescription(activity)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Due Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <CalendarIcon className="w-4 h-4" />
                Due Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`w-full justify-start ${getDueDateColor()}`}>
                    {dueDate ? format(dueDate, 'PPP') : 'Set due date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dueDate && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${getDueDateColor()}`}>
                    {isToday(dueDate) && 'Due today!'}
                    {isPast(dueDate) && !isToday(dueDate) && 'Overdue!'}
                    {isFuture(dueDate) && 'Upcoming'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDueDate(null)}
                    className="text-xs text-muted-foreground h-6"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Flag className="w-4 h-4" />
                Priority
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(priority === opt.value ? '' : opt.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      priority === opt.value 
                        ? `${opt.color} text-white` 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 space-y-2 border-t border-border">
              <Button 
                onClick={saveCard} 
                className="w-full bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                disabled={saving}
                data-testid="save-card-btn"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button 
                variant="outline" 
                onClick={duplicateCard}
                className="w-full"
                data-testid="duplicate-card-btn"
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate Card
              </Button>
              <Button 
                variant="outline" 
                onClick={deleteCard}
                className="w-full text-destructive hover:bg-destructive/10"
                data-testid="delete-card-btn"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Card
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <DriveFilePicker
      open={drivePickerOpen}
      onClose={() => setDrivePickerOpen(false)}
      cardId={card.card_id}
      onAttached={(attachment) => {
        const updated = [...attachments, attachment];
        setAttachments(updated);
        onUpdate({ ...card, attachments: updated });
      }}
    />

    <DropboxFilePicker
      open={dropboxPickerOpen}
      onClose={() => setDropboxPickerOpen(false)}
      cardId={card.card_id}
      onAttached={(attachment) => {
        const updated = [...attachments, attachment];
        setAttachments(updated);
        onUpdate({ ...card, attachments: updated });
      }}
    />
    </>
  );
};

export default CardDetailModal;
