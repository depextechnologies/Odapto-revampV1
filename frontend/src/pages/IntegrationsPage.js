import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ResponsiveLogo } from '../components/ThemeLogo';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { apiGet, apiDelete } from '../utils/api';
import { API } from '../config';
import {
  Moon, Sun, ArrowLeft, Check, ExternalLink, Unplug, Loader2
} from 'lucide-react';

const GOOGLE_DRIVE_LOGO = "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg";
const ONEDRIVE_LOGO = "https://upload.wikimedia.org/wikipedia/commons/3/3c/Microsoft_Office_OneDrive_%282019%E2%80%93present%29.svg";
const DROPBOX_LOGO = "https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg";

export default function IntegrationsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(null);

  useEffect(() => {
    fetchStatus();
    // Handle callback params
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === 'google_drive') {
      toast.success('Google Drive connected successfully!');
    } else if (connected === 'dropbox') {
      toast.success('Dropbox connected successfully!');
    } else if (error) {
      toast.error(`Connection failed: ${error.replace(/_/g, ' ')}`);
    }
  }, [searchParams]);

  const fetchStatus = async () => {
    try {
      const res = await apiGet('/integrations/status');
      if (res.ok) setStatus(await res.json());
    } catch {
      // not logged in or error
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (provider) => {
    const token = localStorage.getItem('odapto_session_token') || sessionStorage.getItem('odapto_session_token');
    if (provider === 'google_drive') {
      window.location.href = `${API}/integrations/google-drive/connect${token ? `?token=${token}` : ''}`;
    } else if (provider === 'dropbox') {
      window.location.href = `${API}/integrations/dropbox/connect${token ? `?token=${token}` : ''}`;
    }
  };

  const handleDisconnect = async (provider) => {
    setDisconnecting(provider);
    try {
      const endpoint = provider === 'google_drive'
        ? '/integrations/google-drive/disconnect'
        : provider === 'dropbox'
        ? '/integrations/dropbox/disconnect'
        : null;

      if (endpoint) {
        const res = await apiDelete(endpoint);
        if (res.ok) {
          const name = provider === 'google_drive' ? 'Google Drive' : provider === 'dropbox' ? 'Dropbox' : provider;
          toast.success(`${name} disconnected`);
          fetchStatus();
        } else {
          toast.error('Failed to disconnect');
        }
      }
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(null);
    }
  };

  const integrations = [
    {
      key: 'google_drive',
      name: 'Google Drive',
      logo: GOOGLE_DRIVE_LOGO,
      description: 'Connect your Google Drive to attach files directly from the cloud.',
      available: true
    },
    {
      key: 'onedrive',
      name: 'OneDrive',
      logo: ONEDRIVE_LOGO,
      description: 'Access and attach files from your Microsoft OneDrive account.',
      available: false
    },
    {
      key: 'dropbox',
      name: 'Dropbox',
      logo: DROPBOX_LOGO,
      description: 'Link your Dropbox to easily share and attach files to cards.',
      available: true
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 hover:bg-muted rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link to="/">
                <ResponsiveLogo className="h-8 w-auto" />
              </Link>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="font-heading text-3xl font-bold mb-3">Integrations</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Connect your favorite cloud storage services to enhance your workflow.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {integrations.map((integration, index) => {
            const isConnected = status?.[integration.key]?.connected;
            const connectedEmail = status?.[integration.key]?.email;

            return (
              <motion.div
                key={integration.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-card border rounded-xl p-6 text-center relative overflow-hidden transition-all ${
                  isConnected
                    ? 'border-green-500/50 shadow-sm shadow-green-500/10'
                    : 'border-border'
                }`}
                data-testid={`integration-card-${integration.key}`}
              >
                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  {isConnected ? (
                    <span className="px-2 py-1 text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Connected
                    </span>
                  ) : !integration.available ? (
                    <span className="px-2 py-1 text-xs font-medium bg-odapto-orange/10 text-odapto-orange rounded-full">
                      Coming Soon
                    </span>
                  ) : null}
                </div>

                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <img
                    src={integration.logo}
                    alt={integration.name}
                    className="w-12 h-12 object-contain"
                  />
                </div>

                <h3 className="font-heading font-semibold text-lg mb-2">
                  {integration.name}
                </h3>

                <p className="text-sm text-muted-foreground mb-1">
                  {integration.description}
                </p>

                {isConnected && connectedEmail && (
                  <p className="text-xs text-green-600 dark:text-green-400 mb-3 truncate">
                    {connectedEmail}
                  </p>
                )}

                {/* Action Button */}
                {!user ? (
                  <Link to="/login">
                    <Button variant="outline" className="mt-4 w-full" size="sm">
                      Login to Connect
                    </Button>
                  </Link>
                ) : isConnected ? (
                  <Button
                    variant="outline"
                    className="mt-4 w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    size="sm"
                    onClick={() => handleDisconnect(integration.key)}
                    disabled={disconnecting === integration.key}
                    data-testid={`disconnect-${integration.key}`}
                  >
                    {disconnecting === integration.key ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Unplug className="w-4 h-4 mr-2" />
                    )}
                    Disconnect
                  </Button>
                ) : integration.available ? (
                  <Button
                    className="mt-4 w-full bg-odapto-orange hover:bg-odapto-orange-hover text-white"
                    size="sm"
                    onClick={() => handleConnect(integration.key)}
                    disabled={loading}
                    data-testid={`connect-${integration.key}`}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect
                  </Button>
                ) : (
                  <Button disabled className="mt-4 w-full" variant="outline" size="sm">
                    Coming Soon
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">
            More integrations coming soon. Stay tuned!
          </p>
        </div>
      </main>
    </div>
  );
}
