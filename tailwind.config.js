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
                note: ['var(--font-note)', 'cursive'],
                mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
            },
            colors: {
                // shadcn/ui semantic tokens — mapped to the OpenViz workbench palette
                border: "#3C3C3E",
                input: "#3C3C3E",
                ring: "#4C4CEF",
                background: "#161616",
                foreground: "#FAFAFA",
                primary: {
                    DEFAULT: "#4C4CEF",
                    dark: "#3F3FD9",
                    foreground: "#FAFAFA",
                },
                secondary: {
                    DEFAULT: "#2F2F31",
                    foreground: "#FAFAFA",
                },
                destructive: {
                    DEFAULT: "#EF4444",
                    foreground: "#FAFAFA",
                },
                muted: {
                    DEFAULT: "#2F2F31",
                    foreground: "#808085",
                },
                accent: {
                    DEFAULT: "rgba(255, 255, 255, 0.08)",
                    foreground: "#FAFAFA",
                },
                popover: {
                    DEFAULT: "#2F2F31",
                    foreground: "#FAFAFA",
                },
                card: {
                    DEFAULT: "#242425",
                    foreground: "#FAFAFA",
                },

                // OpenViz workbench tokens (used across studio chrome)
                'viz-bg': '#161616',
                'viz-panel': '#242425',
                'viz-surface': '#2F2F31',
                'viz-border': '#3C3C3E',
                'viz-muted': '#808085',
                'viz-accent': '#4C4CEF',
                'viz-selected': '#343476',
                // Dark-canvas dot grid (100% opacity, ui-translation §3.8)
                'viz-canvas-dot': '#2a2a2c',

                // Legacy tokens kept for existing components
                'primary-dark': '#136AE0',
                panel: '#242425',
                'panel-light': '#2F2F31',
                'panel-border': '#3C3C3E',
                'text-secondary': '#808085',
                'studio-ink': '#FAFAFA',
                'studio-grid': '#202B3D',
            },
            borderRadius: {
                'panel': '16px',
                'xl2': '12px',
            },
            boxShadow: {
                // OpenViz floating pill / panel shadow
                'viz': '0px 2px 4px 0px rgba(0, 0, 0, 0.25), inset 0px 0.5px 1px 0px rgba(180, 180, 180, 0.25)',
            },
        },
    },
    plugins: [],
}
