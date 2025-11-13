import { Icons } from './Icons';

export default function FlipBookControls({
    currentPage,
    totalPages,
    zoom,
    zooming,
    zoomIndex,
    maxZoomIndex,
    rendering,
    onPrevPage,
    onNextPage,
    onZoomIn,
    onZoomOut,
    onResetZoom
}) {
    return (
        <div className="flipbook-controls dark-layout">
            <div className="control-group nav-group">
                <button 
                    className="btn" 
                    onClick={onPrevPage} 
                    disabled={currentPage <= 1} 
                    aria-label="Página anterior"
                    title="Anterior"
                >
                    <Icons.ChevronLeft />
                </button>
                <span className="page-indicator" aria-live="polite">
                    Pág {currentPage} / {totalPages}
                </span>
                <button 
                    className="btn" 
                    onClick={onNextPage} 
                    disabled={currentPage >= totalPages} 
                    aria-label="Página siguiente"
                    title="Siguiente"
                >
                    <Icons.ChevronRight />
                </button>
            </div>
            
            <div className="control-group zoom-group">
                <button 
                    className="btn ghost" 
                    onClick={onZoomOut} 
                    disabled={zooming || zoomIndex <= 0} 
                    aria-label="Alejar"
                    title="Alejar"
                >
                    <Icons.Minus />
                </button>
                <span className="zoom-label" aria-live="polite">
                    {Math.round(zoom * 100)}%
                </span>
                <button 
                    className="btn ghost" 
                    onClick={onZoomIn} 
                    disabled={zooming || zoomIndex >= maxZoomIndex} 
                    aria-label="Acercar"
                    title="Acercar"
                >
                    <Icons.Plus />
                </button>
                <button 
                    className="btn ghost" 
                    onClick={onResetZoom} 
                    disabled={zoom === 1 || zooming} 
                    aria-label="Reset zoom"
                    title="Restablecer zoom (100%)"
                >
                    <Icons.RefreshCw />
                </button>
            </div>
            
            {rendering && <div className="render-indicator">Renderizando…</div>}
        </div>
    );
}
