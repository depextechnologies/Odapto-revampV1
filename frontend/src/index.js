import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Initialize Capacitor plugins
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';

// Platform-specific initialization
const initCapacitor = async () => {
  if (Capacitor.isNativePlatform()) {
    // Configure status bar
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#E67E4C' });
    } catch (e) {
      console.log('StatusBar not available');
    }

    // Hide splash screen after app loads
    try {
      await SplashScreen.hide();
    } catch (e) {
      console.log('SplashScreen not available');
    }

    // Keyboard configuration for better UX
    try {
      Keyboard.setAccessoryBarVisible({ isVisible: true });
    } catch (e) {
      console.log('Keyboard not available');
    }
  }
};

initCapacitor();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
