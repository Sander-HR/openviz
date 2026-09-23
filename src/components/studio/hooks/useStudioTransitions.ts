export const studioPanelVariants = {
    visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
    hiddenTop: { opacity: 0, y: -20, transition: { duration: 0.4, ease: "easeIn" } },
    hiddenLeft: { opacity: 0, x: -20, transition: { duration: 0.4, ease: "easeIn" } },
    hiddenRight: { opacity: 0, x: 20, transition: { duration: 0.4, ease: "easeIn" } },
    hiddenBottom: { opacity: 0, y: 20, transition: { duration: 0.4, ease: "easeIn" } },
} as const;
