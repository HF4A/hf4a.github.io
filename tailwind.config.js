/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // HF4A theme colors
        space: {
          900: '#0f0f1a',
          800: '#1a1a2e',
          700: '#252542',
          600: '#2d2d4a',
        },
        // Card type header colors
        card: {
          thruster: '#e07b39',
          reactor: '#9b59b6',
          generator: '#e74c3c',
          radiator: '#00bcd4',
          robonaut: '#e91e63',
          refinery: '#c9a66b',
          colonist: '#607d8b',
          bernal: '#78909c',
          freighter: '#009688',
          'gw-thruster': '#bf360c',
          crew: '#ffc107',
          contract: '#3f51b5',
        },
        // Spectral type colors
        spectral: {
          C: '#4a90d9', // Carbonaceous (blue)
          D: '#8b4513', // Dark (brown)
          H: '#00ced1', // Hydrous (cyan)
          M: '#cd853f', // Metallic (bronze)
          S: '#ffd700', // Siliceous (gold)
          V: '#228b22', // Volcanic (green)
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
