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

const DRIVE_LOGO = "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg";

function getFileIcon(mimeType) {
  if (!mimeType) return <FileIcon className="w-5 h-5 text-muted-foreground" />;
  if (mimeType === 'application/vnd.google-apps.folder') return <Folder className="w-5 h-5 text-yellow-500" />;
  if (mimeType.startsWith('image/')) return <Image className="w-5 h-5 text-green-500" />;
  if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileText className="w-5 h-5 text-emerald-600" />;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <FileText className="w-5 h-5 text-orange-500" />;
  if (mimeType.includes('document') || mimeType.includes('word')) return <FileText className="w-5 h-5 text-blue-500" />;
  return <FileIcon className="w-5 h-5 text-muted-foreground" />;
}

function formatSize(bytes) {
  if (!bytes) return '';
  const k = 1024;
  if (bytes < k) return `${bytes} B`;
  if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
  return `${(bytes / (k * k)).toFixed(1)} MB`;
}

export default function DriveFilePicker({ open, onClose, cardId, onAttached }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState(null);
  const [search, setSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [folderStack, setFolderStack] = useState([{ id: null, name: 'My Drive' }]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [connected, setConnected] = useState(true);

  const currentFolder = folderStack[folderStack.length - 1];

  const fetchFiles = useCallback(async (folderId = null, searchTerm = '', pageToken = null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderId) params.set('folder_id', folderId);
      if (searchTerm) params.set('search', searchTerm);
      if (pageToken) params.set('page_token', pageToken);

      const res = await apiGet(`/integrations/google-drive/files?${params.toString()}`);
      if (res.status === 401) {
        setConnected(false);
        setFiles([]);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (pageToken) {
          setFiles(prev => [...prev, ...(data.files || [])]);
        } else {
          setFiles(data.files || []);
        }
        setNextPageToken(data.nextPageToken || null);
        setConnected(true);
      }
    } catch {
      toast.error('Failed to load Drive files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      setFolderStack([{ id: null, name: 'My Drive' }]);
      fetchFiles(null, '');
    }
  }, [open, fetchFiles]);

  const handleSearch = (value) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      if (value.trim()) {
        setFolderStack([{ id: null, name: 'My Drive' }]);
        fetchFiles(null, value.trim());
      } else {
        fetchFiles(currentFolder.id, '');
      }
    }, 400));
  };

  const openFolder = (file) => {
    setSearch('');
    setFolderStack(prev => [...prev, { id: file.id, name: file.name }]);
    fetchFiles(file.id, '');
  };

  const goBack = () => {
    if (folderStack.length <= 1) return;
    setSearch('');
    const newStack = folderStack.slice(0, -1);
    setFolderStack(newStack);
    fetchFiles(newStack[newStack.length - 1].id, '');
  };

  const attachFile = async (file) => {
    setAttaching(file.id);
    try {
      const res = await apiPost('/integrations/google-drive/attach', {
        card_id: cardId,
        file_id: file.id,
        file_name: file.name,
        file_url: file.webViewLink,
        file_icon: file.iconLink,
        file_mime: file.mimeType
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
            <img src={DRIVE_LOGO} alt="Drive" className="w-5 h-5" />
            Google Drive
          </DialogTitle>
          <DialogDescription>
            Select a file to attach to this card
          </DialogDescription>
        </DialogHeader>

        {!connected ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <HardDrive className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Google Drive not connected</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Google Drive from the Integrations page.
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
                  data-testid="drive-search-input"
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
                  {files.map((file) => {
                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                    return (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/80 cursor-pointer group transition-colors"
                        onClick={() => isFolder ? openFolder(file) : undefined}
                        data-testid={`drive-file-${file.id}`}
                      >
                        {getFileIcon(file.mimeType)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.modifiedTime && new Date(file.modifiedTime).toLocaleDateString()}
                            {file.size && ` · ${formatSize(parseInt(file.size))}`}
                          </p>
                        </div>
                        {isFolder ? (
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8"
                            onClick={(e) => { e.stopPropagation(); attachFile(file); }}
                            disabled={attaching === file.id}
                            data-testid={`attach-drive-file-${file.id}`}
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
                    );
                  })}

                  {nextPageToken && (
                    <div className="text-center py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchFiles(currentFolder.id, search, nextPageToken)}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load more'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
