// Iconos SVG para los controles
export const Icons = {
    ChevronLeft: () => (
        <svg className="icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
        </svg>
    ),
    ChevronRight: () => (
        <svg className="icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
        </svg>
    ),
    Minus: () => (
        <svg className="icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
        </svg>
    ),
    Plus: () => (
        <svg className="icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14" /><path d="M5 12h14" />
        </svg>
    ),
    RefreshCw: () => (
        <svg className="icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6l3 2" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6l-3-2" />
        </svg>
    )
};
