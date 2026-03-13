import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { ResponsiveLogo } from '../components/ThemeLogo';
import { Moon, Sun, ArrowLeft } from 'lucide-react';

// Integration logos
const GOOGLE_DRIVE_LOGO = "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg";
const ONEDRIVE_LOGO = "https://upload.wikimedia.org/wikipedia/commons/3/3c/Microsoft_Office_OneDrive_%282019%E2%80%93present%29.svg";
const DROPBOX_LOGO = "https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg";

const integrations = [
  {
    name: 'Google Drive',
    logo: GOOGLE_DRIVE_LOGO,
    description: 'Connect your Google Drive to attach files directly from the cloud.',
    status: 'coming_soon'
  },
  {
    name: 'OneDrive',
    logo: ONEDRIVE_LOGO,
    description: 'Access and attach files from your Microsoft OneDrive account.',
    status: 'coming_soon'
  },
  {
    name: 'Dropbox',
    logo: DROPBOX_LOGO,
    description: 'Link your Dropbox to easily share and attach files to cards.',
    status: 'coming_soon'
  }
];

export default function IntegrationsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
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

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="font-heading text-3xl font-bold mb-3">Integrations</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Connect your favorite cloud storage services to enhance your workflow.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {integrations.map((integration) => (
            <div 
              key={integration.name}
              className="bg-card border border-border rounded-xl p-6 text-center relative overflow-hidden"
            >
              {/* Coming Soon Badge */}
              <div className="absolute top-3 right-3">
                <span className="px-2 py-1 text-xs font-medium bg-odapto-orange/10 text-odapto-orange rounded-full">
                  Coming Soon
                </span>
              </div>

              {/* Logo */}
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <img 
                  src={integration.logo} 
                  alt={integration.name}
                  className="w-12 h-12 object-contain"
                />
              </div>

              {/* Name */}
              <h3 className="font-heading font-semibold text-lg mb-2">
                {integration.name}
              </h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground">
                {integration.description}
              </p>

              {/* Disabled Connect Button */}
              <button 
                disabled
                className="mt-4 w-full py-2 px-4 rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
              >
                Connect
              </button>
            </div>
          ))}
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
