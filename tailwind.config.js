/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        feishu: {
          50: '#f0f5ff',
          100: '#e1eaff',
          200: '#bad0ff',
          300: '#8db1ff',
          400: '#5c8eff',
          500: '#3370ff', // Feishu brand primary
          600: '#1e56d4',
          700: '#1440a3',
          800: '#0e2d73',
          900: '#091c47',
        },
        text: {
          primary: '#1f2329',
          secondary: '#646a73',
          tertiary: '#8f959e',
          placeholder: '#bbbfc4',
        },
        border: {
          light: '#dee0e3',
          subtle: '#ebeef5',
        },
        bg: {
          base: '#f5f6f7',
          sidebar: '#f9f9fa',
          hover: '#eff0f1',
          active: '#e5e6eb',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.05)',
        flyout: '0 8px 24px rgba(31, 35, 41, 0.12)',
        modal: '0 16px 36px rgba(0, 0, 0, 0.16)',
      }
    },
  },
  plugins: [],
}
