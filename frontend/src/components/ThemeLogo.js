import React from 'react';
import { useTheme } from '../context/ThemeContext';

// Logo variants:
// Desktop Light: logo-desktop-light.png
// Desktop Dark: logo-desktop-dark.png  
// Mobile Light: logo-mobile-light.png
// Mobile Dark: logo-mobile-dark.png

export default function ThemeLogo({ className = "h-8 w-auto", mobile = false }) {
  const { theme } = useTheme();
  
  // Determine which logo to use
  const logoSrc = mobile
    ? (theme === 'dark' ? '/logo-mobile-dark.png' : '/logo-mobile-light.png')
    : (theme === 'dark' ? '/logo-desktop-dark.png' : '/logo-desktop-light.png');
  
  return (
    <img 
      src={logoSrc} 
      alt="Odapto" 
      className={className}
      data-testid="theme-logo"
    />
  );
}

// Responsive logo that switches between mobile and desktop based on screen size
export function ResponsiveLogo({ className = "h-8 w-auto" }) {
  const { theme } = useTheme();
  
  return (
    <>
      {/* Desktop logo - hidden on small screens */}
      <img 
        src={theme === 'dark' ? '/logo-desktop-dark.png' : '/logo-desktop-light.png'} 
        alt="Odapto" 
        className={`${className} hidden sm:block`}
        data-testid="desktop-logo"
      />
      {/* Mobile logo - visible only on small screens */}
      <img 
        src={theme === 'dark' ? '/logo-mobile-dark.png' : '/logo-mobile-light.png'} 
        alt="Odapto" 
        className={`${className} block sm:hidden`}
        data-testid="mobile-logo"
      />
    </>
  );
}
