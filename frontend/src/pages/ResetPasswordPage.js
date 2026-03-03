import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Moon, Sun, ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const LOGO_URL = "/odapto-logo-new.png";

export default function ResetPasswordPage() {
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  // Forgot password state
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Reset password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const response = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (response.ok) {
        setEmailSent(true);
      } else {
        toast.error('Failed to send reset email');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setSending(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setResetting(true);
    try {
      const response = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword })
      });
      if (response.ok) {
        setResetSuccess(true);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to reset password');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <Link to="/">
              <img src={LOGO_URL} alt="Odapto" className="h-8 w-auto" />
            </Link>
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-muted transition-colors">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          {!token ? (
            // Forgot Password Form
            emailSent ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="font-heading text-2xl font-bold mb-2">Check Your Email</h1>
                <p className="text-muted-foreground mb-6">
                  If an account exists for {email}, we've sent a password reset link.
                </p>
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <h1 className="font-heading text-2xl font-bold mb-2">Forgot Password?</h1>
                <p className="text-muted-foreground mb-6">Enter your email and we'll send you a reset link.</p>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        data-testid="forgot-email-input"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                    data-testid="send-reset-btn"
                  >
                    {sending ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>
                <p className="text-center mt-6 text-sm text-muted-foreground">
                  Remember your password?{' '}
                  <Link to="/login" className="text-odapto-orange hover:underline">Sign in</Link>
                </p>
              </>
            )
          ) : (
            // Reset Password Form
            resetSuccess ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="font-heading text-2xl font-bold mb-2">Password Reset!</h1>
                <p className="text-muted-foreground mb-6">Your password has been successfully reset.</p>
                <Link to="/login">
                  <Button className="w-full bg-odapto-orange hover:bg-odapto-orange-hover text-white">
                    Sign In Now
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <h1 className="font-heading text-2xl font-bold mb-2">Reset Password</h1>
                <p className="text-muted-foreground mb-6">Enter your new password below.</p>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        minLength={8}
                        data-testid="reset-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      data-testid="reset-confirm-password-input"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={resetting}
                    className="w-full bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                    data-testid="reset-password-btn"
                  >
                    {resetting ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </form>
              </>
            )
          )}
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-odapto-orange/10 via-background to-odapto-teal/10 items-center justify-center p-8">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-odapto-orange/10 flex items-center justify-center">
            <img src={LOGO_URL} alt="Odapto" className="h-12 w-auto" />
          </div>
          <h2 className="font-heading text-2xl font-bold mb-2">Secure Your Account</h2>
          <p className="text-muted-foreground max-w-sm">
            Keep your workspace safe with a strong password.
          </p>
        </div>
      </div>
    </div>
  );
}
