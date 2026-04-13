import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { apiGet, apiPost } from '../utils/api';
import { toast } from 'sonner';
import {
  Folder, FileText, Image, File as FileIcon, Search,
  ChevronRight, ArrowLeft, Loader2, Check, HardDrive
} from 'lucide-react';

const DROPBOX_LOGO = "https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg";

function getFileIcon(entry) {
  if (entry.is_folder) return <Folder className="w-5 h-5 text-blue-400" />;
  const name = (entry.name || '').toLowerCase();
  if (name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return <Image className="w-5 h-5 text-green-500" />;
  if (name.match(/\.pdf$/)) return <FileText className="w-5 h-5 text-red-500" />;
  if (name.match(/\.(doc|docx)$/)) return <FileText className="w-5 h-5 text-blue-500" />;
  if (name.match(/\.(xls|xlsx|csv)$/)) return <FileText className="w-5 h-5 text-emerald-600" />;
  if (name.match(/\.(ppt|pptx)$/)) return <FileText className="w-5 h-5 text-orange-500" />;
  return <FileIcon className="w-5 h-5 text-muted-foreground" />;
}

function formatSize(bytes) {
  if (!bytes) return '';
  const k = 1024;
  if (bytes < k) return `${bytes} B`;
  if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
  return `${(bytes / (k * k)).toFixed(1)} MB`;
}

export default function DropboxFilePicker({ open, onClose, cardId, onAttached }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState(null);
  const [search, setSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [folderStack, setFolderStack] = useState([{ path: '', name: 'Dropbox' }]);
  const [connected, setConnected] = useState(true);

  const currentFolder = folderStack[folderStack.length - 1];

  const fetchFiles = useCallback(async (folderPath = '', searchTerm = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderPath) params.set('path', folderPath);
      if (searchTerm) params.set('search', searchTerm);

      const res = await apiGet(`/integrations/dropbox/files?${params.toString()}`);
      if (res.status === 401) {
        setConnected(false);
        setFiles([]);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setConnected(true);
      }
    } catch {
      toast.error('Failed to load Dropbox files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      setFolderStack([{ path: '', name: 'Dropbox' }]);
      fetchFiles('', '');
    }
  }, [open, fetchFiles]);

  const handleSearch = (value) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      if (value.trim()) {
        setFolderStack([{ path: '', name: 'Dropbox' }]);
        fetchFiles('', value.trim());
      } else {
        fetchFiles(currentFolder.path, '');
      }
    }, 400));
  };

  const openFolder = (file) => {
    setSearch('');
    setFolderStack(prev => [...prev, { path: file.path, name: file.name }]);
    fetchFiles(file.path, '');
  };

  const goBack = () => {
    if (folderStack.length <= 1) return;
    setSearch('');
    const newStack = folderStack.slice(0, -1);
    setFolderStack(newStack);
    fetchFiles(newStack[newStack.length - 1].path, '');
  };

  const attachFile = async (file) => {
    setAttaching(file.id);
    try {
      const res = await apiPost('/integrations/dropbox/attach', {
        card_id: cardId,
        file_id: file.id,
        file_name: file.name,
        file_path: file.path,
        file_url: file.url
      });
      if (res.ok) {
        const attachment = await res.json();
        toast.success(`Attached "${file.name}"`);
        onAttached?.(attachment);
      } else {
        toast.error('Failed to attach file');
      }
    } catch {
      toast.error('Failed to attach file');
    } finally {
      setAttaching(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={DROPBOX_LOGO} alt="Dropbox" className="w-5 h-5" />
            Dropbox
          </DialogTitle>
          <DialogDescription>
            Select a file to attach to this card
          </DialogDescription>
        </DialogHeader>

        {!connected ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <HardDrive className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Dropbox not connected</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Dropbox from the Integrations page.
            </p>
            <Button
              variant="outline"
              onClick={() => { onClose(false); window.location.href = '/integrations'; }}
            >
              Go to Integrations
            </Button>
          </div>
        ) : (
          <>
            {/* Breadcrumb + Search */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {folderStack.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                <div className="flex items-center gap-1 text-sm overflow-hidden">
                  {folderStack.map((f, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0 text-muted-foreground" />}
                      <span className={`truncate ${i === folderStack.length - 1 ? 'font-medium' : 'text-muted-foreground'}`}>
                        {f.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9"
                  data-testid="dropbox-search-input"
                />
              </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto min-h-0 mt-3 -mx-2">
              {loading && files.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>{search ? 'No files match your search' : 'This folder is empty'}</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/80 cursor-pointer group transition-colors"
                      onClick={() => file.is_folder ? openFolder(file) : undefined}
                      data-testid={`dropbox-file-${file.id}`}
                    >
                      {getFileIcon(file)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.modified && new Date(file.modified).toLocaleDateString()}
                          {file.size > 0 && ` · ${formatSize(file.size)}`}
                        </p>
                      </div>
                      {file.is_folder ? (
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8"
                          onClick={(e) => { e.stopPropagation(); attachFile(file); }}
                          disabled={attaching === file.id}
                          data-testid={`attach-dropbox-file-${file.id}`}
                        >
                          {attaching === file.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Attach
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
