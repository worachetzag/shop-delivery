import { useState, useEffect } from 'react';
import config from '../config';

// Custom hook for responsive design
export const useResponsive = () => {
  const [screenSize, setScreenSize] = useState(config.getScreenSize());
  const [isMobile, setIsMobile] = useState(config.isMobile());
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(config.isDesktop());

  useEffect(() => {
    const handleResize = () => {
      const newScreenSize = config.getScreenSize();
      const newIsMobile = config.isMobile();
      const newIsTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      const newIsDesktop = config.isDesktop();

      setScreenSize(newScreenSize);
      setIsMobile(newIsMobile);
      setIsTablet(newIsTablet);
      setIsDesktop(newIsDesktop);
    };

    // Set initial values
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    screenSize,
    isMobile,
    isTablet,
    isDesktop,
    isIOS: config.isIOS(),
    isAndroid: config.isAndroid()
  };
};

// Custom hook for device detection
export const useDevice = () => {
  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: config.isMobile(),
    isIOS: config.isIOS(),
    isAndroid: config.isAndroid(),
    isDesktop: config.isDesktop(),
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : ''
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDeviceInfo({
        isMobile: config.isMobile(),
        isIOS: config.isIOS(),
        isAndroid: config.isAndroid(),
        isDesktop: config.isDesktop(),
        userAgent: navigator.userAgent
      });
    }
  }, []);

  return deviceInfo;
};

// Custom hook for viewport dimensions
export const useViewport = () => {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
};


