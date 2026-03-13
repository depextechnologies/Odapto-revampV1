import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

const AnimatedSplashScreen = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Hide the native splash screen once our component is mounted
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide();
    }
  }, []);

  const handleVideoEnd = () => {
    setFadeOut(true);
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 500);
  };

  // Fallback: if video fails to load or play, skip after 3s
  useEffect(() => {
    const timeout = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 8000);
    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      data-testid="animated-splash-screen"
    >
      <video
        ref={videoRef}
        src="/splash-animation.mp4"
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        className="w-64 h-64 sm:w-80 sm:h-80 object-contain"
      />
    </div>
  );
};

export default AnimatedSplashScreen;
