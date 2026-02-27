import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiPatch, apiPost, apiDelete } from '../utils/api';
import { 
  X, 
  Calendar as CalendarIcon, 
  Tag, 
  Users, 
  Paperclip,
  CheckSquare,
  MessageSquare,
  Trash2,
  Plus,
  Send
} from 'lucide-react';

const LABEL_OPTIONS = [
  { value: 'red', color: 'bg-red-500', name: 'Red' },
  { value: 'orange', color: 'bg-orange-500', name: 'Orange' },
  { value: 'yellow', color: 'bg-yellow-500', name: 'Yellow' },
  { value: 'green', color: 'bg-green-500', name: 'Green' },
  { value: 'blue', color: 'bg-blue-500', name: 'Blue' },
  { value: 'purple', color: 'bg-purple-500', name: 'Purple' },
  { value: 'pink', color: 'bg-pink-500', name: 'Pink' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-green-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' }
];

export const CardDetailModal = ({ card, onClose, onUpdate, onDelete }) => {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [dueDate, setDueDate] = useState(card.due_date ? new Date(card.due_date) : null);
  const [labels, setLabels] = useState(card.labels || []);
  const [priority, setPriority] = useState(card.priority || '');
  const [checklist, setChecklist] = useState(card.checklist || []);
  const [comments, setComments] = useState(card.comments || []);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);

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

  const toggleLabel = (labelValue) => {
    if (labels.includes(labelValue)) {
      setLabels(labels.filter(l => l !== labelValue));
    } else {
      setLabels([...labels, labelValue]);
    }
  };

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;

    try {
      const response = await fetch(`${API}/cards/${card.card_id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: newChecklistItem })
      });

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
      await fetch(`${API}/cards/${card.card_id}/checklist/${itemId}`, {
        method: 'PATCH',
        credentials: 'include'
      });

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
      const response = await fetch(`${API}/cards/${card.card_id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newComment })
      });

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

  const completedCount = checklist.filter(item => item.completed).length;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
          {/* Main content */}
          <div className="col-span-2 space-y-6">
            {/* Labels */}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => {
                  const labelOption = LABEL_OPTIONS.find(l => l.value === label);
                  return (
                    <span
                      key={label}
                      className={`px-3 py-1 rounded-full text-white text-sm ${labelOption?.color || 'bg-gray-500'}`}
                    >
                      {labelOption?.name || label}
                    </span>
                  );
                })}
              </div>
            )}

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
                    style={{ width: `${(completedCount / checklist.length) * 100}%` }}
                  />
                </div>
              )}

              <div className="space-y-2">
                {checklist.map((item) => (
                  <div key={item.item_id} className="flex items-center gap-3">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleChecklistItem(item.item_id)}
                    />
                    <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                      {item.text}
                    </span>
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
                        {new Date(comment.created_at).toLocaleString()}
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
                  <Button variant="outline" className="w-full justify-start">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDueDate(null)}
                  className="text-xs text-muted-foreground"
                >
                  Clear due date
                </Button>
              )}
            </div>

            {/* Labels */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4" />
                Labels
              </Label>
              <div className="flex flex-wrap gap-2">
                {LABEL_OPTIONS.map((label) => (
                  <button
                    key={label.value}
                    onClick={() => toggleLabel(label.value)}
                    className={`w-8 h-6 rounded ${label.color} ${
                      labels.includes(label.value) ? 'ring-2 ring-offset-2 ring-foreground' : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-sm">Priority</Label>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(priority === opt.value ? '' : opt.value)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      priority === opt.value 
                        ? `${opt.color} border-current` 
                        : 'text-muted-foreground border-border hover:border-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 space-y-2">
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
  );
};

export default CardDetailModal;
