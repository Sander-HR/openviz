/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./src/app/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
                display: ['var(--font-display)', 'var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
            },
            colors: {
                primary: '#2F8CFF',
                'primary-dark': '#136AE0',
                panel: '#121A25',
                'panel-border': '#263247',
                'text-secondary': '#9FB1CC',
                'studio-ink': '#F4F7FB',
                'studio-grid': '#202B3D',
            },
            borderRadius: {
                'panel': '16px',
            }
        },
    },
    plugins: [],
}
