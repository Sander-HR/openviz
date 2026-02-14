/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./src/app/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#5D5FEF',
                'primary-dark': '#4A4CD9',
                panel: '#1A1A1A',
                'panel-border': '#333333',
                'text-secondary': '#B0B0B0',
            },
            borderRadius: {
                'panel': '16px',
            }
        },
    },
    plugins: [],
}
