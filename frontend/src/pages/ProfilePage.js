import React, { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { apiPost } from '../utils/api';
import { Moon, Sun, ArrowLeft, Mail, Shield, Calendar, LogOut, Camera, Upload, Lock, Eye, EyeOff } from 'lucide-react';

const LOGO_URL = "/odapto-logo-new.png";
const API_BASE = process.env.REACT_APP_BACKEND_URL;

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
};

export default function ProfilePage() {
  const { user, logout, checkAuth } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const imgRef = useRef(null);

  const [showCropDialog, setShowCropDialog] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ unit: '%', width: 80, aspect: 1 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Change password state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="px-3 py-1 rounded-full bg-odapto-orange/10 text-odapto-orange text-sm font-medium">Admin</span>;
      case 'privileged':
        return <span className="px-3 py-1 rounded-full bg-odapto-teal/10 text-odapto-teal text-sm font-medium">Privileged</span>;
      default:
        return <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium">Normal</span>;
    }
  };

  const onSelectFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result);
        setShowCropDialog(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const onImageLoad = useCallback((e) => {
    imgRef.current = e.currentTarget;
    const { width, height } = e.currentTarget;
    const size = Math.min(width, height, 300);
    setCrop({
      unit: 'px',
      width: size,
      height: size,
      x: (width - size) / 2,
      y: (height - size) / 2,
    });
  }, []);

  const getCroppedImg = async () => {
    if (!imgRef.current || !completedCrop) return null;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const blob = await getCroppedImg();
      if (!blob) {
        toast.error('Please select a crop area');
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'profile.jpg');

      const response = await apiPost('/auth/profile-photo', formData, true);
      if (response.ok) {
        toast.success('Profile photo updated!');
        setShowCropDialog(false);
        setImageSrc(null);
        await checkAuth(); // Refresh user data
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Upload failed');
      }
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await apiPost('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      if (response.ok) {
        toast.success('Password changed successfully!');
        setShowPasswordDialog(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to change password');
      }
    } catch (error) {
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
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
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-muted transition-colors" data-testid="theme-toggle">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="bg-gradient-to-br from-odapto-orange/20 to-odapto-teal/20 p-8">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                  <AvatarImage src={getImageUrl(user?.picture)} alt={user?.name} />
                  <AvatarFallback className="bg-odapto-orange text-white text-2xl">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  data-testid="change-photo-btn"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onSelectFile}
                  className="hidden"
                  data-testid="photo-input"
                />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-bold mb-2">{user?.name}</h1>
                {getRoleBadge(user?.role)}
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid gap-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="w-10 h-10 rounded-full bg-odapto-orange/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-odapto-orange" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="w-10 h-10 rounded-full bg-odapto-teal/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-odapto-teal" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Account Type</p>
                  <p className="font-medium capitalize">{user?.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">User ID</p>
                  <p className="font-medium font-mono text-sm">{user?.user_id}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-3">Your Permissions</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Create workspaces and boards
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Use templates from the gallery
                </li>
                {(user?.role === 'privileged' || user?.role === 'admin') && (
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-odapto-teal" />
                    Publish boards as templates
                  </li>
                )}
                {user?.role === 'admin' && (
                  <>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-odapto-orange" />
                      Manage users and roles
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-odapto-orange" />
                      Manage template categories
                    </li>
                  </>
                )}
              </ul>
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <Button 
                variant="outline" 
                onClick={() => setShowPasswordDialog(true)}
                className="w-full"
                data-testid="change-password-btn"
              >
                <Lock className="w-4 h-4 mr-2" />
                Change Password
              </Button>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="w-full text-destructive hover:bg-destructive/10"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop Profile Photo</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {imageSrc && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
              >
                <img src={imageSrc} onLoad={onImageLoad} alt="Crop preview" style={{ maxHeight: '400px' }} />
              </ReactCrop>
            )}
            <p className="text-xs text-muted-foreground mt-2">Drag to adjust the crop area. Max 2MB.</p>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowCropDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleUpload} 
              disabled={uploading}
              className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
              data-testid="upload-photo-btn"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  data-testid="current-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="new-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="confirm-password-input"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={changingPassword}
                className="bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                data-testid="change-password-submit-btn"
              >
                {changingPassword ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
