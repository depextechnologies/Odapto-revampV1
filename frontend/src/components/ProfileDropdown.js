import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';
import { API_BASE_URL } from '../config';
import { User, Plug, Lock, HelpCircle, Crown, LogOut } from 'lucide-react';

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

const getInitials = (name) => {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
};

export default function ProfileDropdown({ variant = 'default' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  // Variant styles for different backgrounds
  const triggerClass = variant === 'board' 
    ? 'cursor-pointer ring-2 ring-white/30 hover:ring-white/50 transition-all'
    : 'cursor-pointer hover:ring-2 hover:ring-odapto-orange/30 transition-all';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className={`h-9 w-9 ${triggerClass}`} data-testid="profile-dropdown-trigger">
          <AvatarImage src={getImageUrl(user?.picture)} alt={user?.name} />
          <AvatarFallback className="bg-odapto-orange text-white text-sm">
            {getInitials(user?.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2 border-b border-border">
          <p className="font-medium text-sm">{user?.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/profile" className="flex items-center gap-2" data-testid="dropdown-profile">
            <User className="w-4 h-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/integrations" className="flex items-center gap-2" data-testid="dropdown-integrations">
            <Plug className="w-4 h-4" />
            Integrations
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/profile?tab=password" className="flex items-center gap-2" data-testid="dropdown-change-password">
            <Lock className="w-4 h-4" />
            Change Password
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/help" className="flex items-center gap-2" data-testid="dropdown-help">
            <HelpCircle className="w-4 h-4" />
            Help
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/upgrade" className="flex items-center gap-2" data-testid="dropdown-upgrade">
            <Crown className="w-4 h-4 text-odapto-orange" />
            <span className="text-odapto-orange font-medium">Upgrade Plan</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleLogout} 
          className="cursor-pointer text-destructive focus:text-destructive"
          data-testid="dropdown-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
