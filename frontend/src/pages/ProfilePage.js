import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
import { 
  Moon, 
  Sun, 
  ArrowLeft,
  Mail,
  Shield,
  Calendar,
  LogOut
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_27d48b6b-dd80-4045-b25e-4aeef47ff911/artifacts/8ilbqloe_download.png";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
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

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              data-testid="theme-toggle"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-odapto-orange/20 to-odapto-teal/20 p-8">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={user?.picture} alt={user?.name} />
                <AvatarFallback className="bg-odapto-orange text-white text-2xl">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-heading text-2xl font-bold mb-2">{user?.name}</h1>
                {getRoleBadge(user?.role)}
              </div>
            </div>
          </div>

          {/* Details */}
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

            {/* Role Permissions */}
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
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-odapto-orange" />
                      View platform analytics
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-border">
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
    </div>
  );
}
