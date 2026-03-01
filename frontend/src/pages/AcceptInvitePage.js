import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Users, Briefcase, CheckSquare, Clock, AlertCircle, CheckCircle, LogIn, UserPlus } from 'lucide-react';

const AcceptInvitePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        const response = await apiGet(`/invitations/${token}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || 'Failed to load invitation');
        }
        setInvitation(data);
        setError(null);
      } catch (err) {
        if (err.message?.includes('expired')) {
          setError('This invitation has expired. Please ask the sender for a new invitation.');
        } else if (err.message?.includes('already been used')) {
          setError('This invitation has already been used.');
        } else {
          setError(err.message || 'Invalid or expired invitation link.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    setAccepting(true);
    try {
      const response = await apiPost(`/invitations/${token}/accept`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to accept invitation');
      }
      const result = await response.json();
      setAccepted(true);
      toast.success('Invitation accepted!', {
        description: `You've joined "${invitation.target_name}"`
      });
      
      // Navigate after a short delay
      setTimeout(() => {
        navigate(result.redirect || '/dashboard');
      }, 1500);
    } catch (err) {
      toast.error('Failed to accept invitation', {
        description: err.message
      });
    } finally {
      setAccepting(false);
    }
  };

  const getIcon = () => {
    if (!invitation) return <Briefcase className="w-12 h-12 text-odapto-orange" />;
    switch (invitation.invitation_type) {
      case 'workspace':
        return <Briefcase className="w-12 h-12 text-odapto-orange" />;
      case 'board':
        return <Users className="w-12 h-12 text-odapto-teal" />;
      case 'card':
        return <CheckSquare className="w-12 h-12 text-odapto-orange" />;
      default:
        return <Briefcase className="w-12 h-12 text-odapto-orange" />;
    }
  };

  const getTypeLabel = () => {
    if (!invitation) return 'Invitation';
    switch (invitation.invitation_type) {
      case 'workspace':
        return 'Workspace Invitation';
      case 'board':
        return 'Board Invitation';
      case 'card':
        return 'Task Assignment';
      default:
        return 'Invitation';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-odapto-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle className="text-xl">Invitation Error</CardTitle>
            <CardDescription className="text-base">{error || 'Unable to load invitation details'}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link to="/dashboard">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <CardTitle className="text-xl text-green-600">Invitation Accepted!</CardTitle>
            <CardDescription className="text-base">
              You've successfully joined "{invitation.target_name}"
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-odapto-orange border-t-transparent rounded-full animate-spin" />
              Redirecting...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-odapto-orange/20 to-odapto-teal/20 flex items-center justify-center mb-4">
            {getIcon()}
          </div>
          <div className="inline-flex items-center justify-center gap-1 px-3 py-1 mb-2 text-xs font-medium bg-odapto-orange/10 text-odapto-orange rounded-full">
            {getTypeLabel()}
          </div>
          <CardTitle className="text-2xl">{invitation.target_name}</CardTitle>
          <CardDescription className="text-base mt-2">
            <span className="font-medium text-foreground">{invitation.invited_by_name}</span> has invited you to join
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-odapto-teal/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-odapto-teal" />
              </div>
              <div>
                <p className="text-sm font-medium">Invited by</p>
                <p className="text-sm text-muted-foreground">{invitation.invited_by_name}</p>
              </div>
            </div>
            
            {invitation.role && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-odapto-orange/20 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-odapto-orange" />
                </div>
                <div>
                  <p className="text-sm font-medium">Your Role</p>
                  <p className="text-sm text-muted-foreground capitalize">{invitation.role}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Expires</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(invitation.expires_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {user ? (
            <div className="space-y-3">
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full bg-odapto-orange hover:bg-odapto-orange/90 text-white"
                size="lg"
                data-testid="accept-invite-btn"
              >
                {accepting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept Invitation
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Signed in as <span className="font-medium">{user.email}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground mb-4">
                Sign in or create an account to accept this invitation
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Link to={`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
                  <Button variant="outline" className="w-full" data-testid="login-to-accept-btn">
                    <LogIn className="w-4 h-4 mr-2" />
                    Log In
                  </Button>
                </Link>
                <Link to={`/register?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}&email=${encodeURIComponent(invitation.email)}`}>
                  <Button className="w-full bg-odapto-orange hover:bg-odapto-orange/90 text-white" data-testid="register-to-accept-btn">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Sign Up
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitePage;
