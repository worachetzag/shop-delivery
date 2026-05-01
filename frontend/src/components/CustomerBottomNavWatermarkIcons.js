import React from 'react';

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
};

function strokeAttrs() {
  return {
    stroke: 'currentColor',
    strokeWidth: 1.35,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

export function BottomNavWatermarkHome() {
  const s = strokeAttrs();
  return (
    <svg {...svgProps} aria-hidden>
      <path
        {...s}
        d="M4 10.5 12 4l8 6.5V19a1.25 1.25 0 0 1-1.25 1.25h-5v-8h-3.5v8h-5A1.25 1.25 0 0 1 4 19V10.5z"
      />
    </svg>
  );
}

export function BottomNavWatermarkProducts() {
  const s = strokeAttrs();
  return (
    <svg {...svgProps} aria-hidden>
      <path {...s} d="M9 8V6a3 3 0 0 1 6 0v2" />
      <path {...s} d="M5.5 9h13l-1.2 11h-10.6L5.5 9z" />
    </svg>
  );
}

export function BottomNavWatermarkCart() {
  const s = strokeAttrs();
  return (
    <svg {...svgProps} aria-hidden>
      <path {...s} d="M6 7h13.5l-1.3 9H7.5L6 7zM6 7 5 4H2.75M10 20.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    </svg>
  );
}

export function BottomNavWatermarkOrders() {
  const s = strokeAttrs();
  return (
    <svg {...svgProps} aria-hidden>
      <path {...s} d="M9 3.75h6l1.25 2.25h4.5V20.5a1 1 0 0 1-1 1H4.25a1 1 0 0 1-1-1V6h4.5L9 3.75z" />
      <path {...s} d="M9 3.75v3h6v-3M8 11.25h8M8 14.75h8M8 18.25h5" />
    </svg>
  );
}

export function BottomNavWatermarkProfile() {
  const s = strokeAttrs();
  return (
    <svg {...svgProps} aria-hidden>
      <path {...s} d="M12 11.25a3 3 0 1 0-3-3 3 3 0 0 0 3 3z" />
      <path {...s} d="M6.75 19.25v-.75c0-2.35 2.35-4.25 5.25-4.25s5.25 1.9 5.25 4.25v.75" />
    </svg>
  );
}

export function BottomNavWatermarkLogin() {
  const s = strokeAttrs();
  return (
    <svg {...svgProps} aria-hidden>
      <path {...s} d="M9 11V8a3 3 0 0 1 6 0v3" />
      <rect {...s} x="7" y="11" width="10" height="10" rx="2" />
      <path {...s} d="M12 14v3" />
    </svg>
  );
}
