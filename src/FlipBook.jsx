import { useEffect, useState, useRef, useCallback } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { usePdfiumEngine } from "@embedpdf/engines/react";
import './FlipBook.css';
import Modal from './Modal';
import PDFPage from './components/PDFPage';
import FlipBookControls from './components/FlipBookControls';
import { 
    useZoom, 
    usePdfLoader, 
    useIsMobile, 
    useHotspots, 
    useResponsiveViewport 
} from './hooks/useFlipBook';

export default function FlipBook({ 
    src = '/test.pdf', 
    width = 1000, 
    height = 700, 
    responsive = true, 
    zoomDuration = 150, 
    zooms = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5] 
}) {
    const { engine, isLoading: engineLoading, error: engineError } = usePdfiumEngine();
    const [isEngineReady, setIsEngineReady] = useState(false);
    const [pages, setPages] = useState([]);
    const [rendering, setRendering] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const bookRef = useRef(null);
    const renderTokenRef = useRef(0);
    const viewportRef = useRef(null);
    const containerRef = useRef(null);
    
    const isMobile = useIsMobile();
    const hotspots = useHotspots();
    const { pdfDocument, loading, error } = usePdfLoader({ engine, isEngineReady, src });
    const baseViewport = useResponsiveViewport({ containerRef, width, height, responsive, isFullscreen, isMobile });
    const { zoom, zoomIndex, zooming, zoomIn, zoomOut, resetZoom, maxZoomIndex } = useZoom({ 
        zoomDuration, 
        zooms, 
        viewportRef 
    });

    // Inicializar engine
    useEffect(() => {
        if (engine && !isEngineReady) {
            engine
                .initialize()
                .toPromise()
                .then(() => setIsEngineReady(true))
                .catch((err) => console.error('Error initializing engine:', err));
        }
    }, [engine, isEngineReady]);

    // Renderizar páginas
    const renderAllPages = useCallback(async (doc) => {
        if (!doc) return;
        const token = ++renderTokenRef.current;
        setRendering(true);
        
        try {
            const rendered = [];
            for (let i = 1; i <= doc.pageCount; i++) {
                if (token !== renderTokenRef.current) return;
                rendered.push({ pageNum: i });
            }
            if (token === renderTokenRef.current) {
                setPages(rendered);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (token === renderTokenRef.current) setRendering(false);
        }
    }, []);

    useEffect(() => {
        if (pdfDocument) {
            renderAllPages(pdfDocument);
        }
    }, [pdfDocument, renderAllPages]);

    // Handlers
    const handleFlip = useCallback((e) => {
        if (!e) return;
        const leftIndex = e.data || 0;
        setCurrentPage(leftIndex + 1);
    }, []);

    const handleLinkClick = useCallback((link) => {
        if (!link.target) return;
        
        const target = link.target;
        
        if (target.type === 'action' && target.action) {
            const action = target.action;
            
            if (action.type === 3 && action.uri) {
                window.open(action.uri, '_blank', 'noopener,noreferrer');
                return;
            }
            
            if (action.type === 4 && action.path) {
                alert(`Enlace a archivo: ${action.path}`);
                return;
            }
        }
        
        if (target.type === 'destination' && target.destination) {
            const dest = target.destination;
            const api = bookRef.current?.pageFlip();
            if (!api || !pdfDocument) return;
            
            try {
                const targetPageIndex = dest.pageIndex;
                if (typeof targetPageIndex === 'number') {
                    const pageIndex = Math.max(0, Math.min(targetPageIndex, pdfDocument.pageCount - 1));
                    api.flip(pageIndex);
                    setCurrentPage(pageIndex + 1);
                }
            } catch (error) {
                console.error('Error navigating to page:', error);
            }
        }
    }, [pdfDocument]);

    const handleHotspotClick = useCallback((hotspot) => {
        setModalContent({
            title: hotspot.title,
            content: hotspot.content,
            type: hotspot.type
        });
        setModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setModalOpen(false);
        setModalContent(null);
    }, []);

    const toggleFullscreen = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                console.error('Error al entrar en pantalla completa:', err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.error('Error al salir de pantalla completa:', err);
            });
        }
    }, []);

    const goPrev = () => {
        bookRef.current?.pageFlip().flipPrev();
    }
    const goNext = () => {
        bookRef.current?.pageFlip().flipNext();
    }

    // Ajustar página actual
    useEffect(() => {
        if (!pdfDocument) return;
        setCurrentPage(prev => Math.min(Math.max(prev, 1), pdfDocument.pageCount));
    }, [pdfDocument]);

    // Mantener página visible tras cambios
    useEffect(() => {
        const totalPages = pdfDocument?.pageCount || 0;
        if (!totalPages || pages.length === 0) return;
        
        const api = bookRef.current?.pageFlip?.();
        if (!api) return;
        
        try {
            const startPageIndex = Math.max(0, Math.min(currentPage - 1, totalPages - 1));
            const currentIndex = api.getCurrentPageIndex?.();
            if (typeof currentIndex === 'number' && currentIndex !== startPageIndex) {
                api.flip(startPageIndex);
            }
        } catch (e) {
            console.error(e);
        }
    }, [pages, currentPage, pdfDocument]);

    // Detectar cambios en fullscreen
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isNowFullscreen = !!document.fullscreenElement;
            setIsFullscreen(isNowFullscreen);
            
            // Pequeño delay para asegurar que el DOM se actualice
            setTimeout(() => {
                // Forzar recálculo del viewport
                window.dispatchEvent(new Event('resize'));
                
                // Actualizar el tamaño del flipbook sin remontarlo
                const api = bookRef.current?.pageFlip();
                if (api && typeof api.updateState === 'function') {
                    api.updateState();
                }
            }, 50);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
    
    // Actualizar tamaño del flipbook cuando cambien las dimensiones
    useEffect(() => {
        if (!pdfDocument) return;
        
        const api = bookRef.current?.pageFlip();
        if (!api) return;
        
        // Dar tiempo para que el DOM se actualice
        const timer = setTimeout(() => {
            if (typeof api.update === 'function') {
                try {
                    api.update();
                } catch {
                    // Silenciar errores si la API no soporta update
                }
            }
        }, 100);
        
        return () => clearTimeout(timer);
    }, [baseViewport.w, baseViewport.h, pdfDocument]);

    // Panning con zoom
    useEffect(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        
        let panState = { active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 };
        
        function onPointerDown(e) {
            if (zoom <= 1) return;
            panState = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                scrollLeft: vp.scrollLeft,
                scrollTop: vp.scrollTop
            };
            vp.classList.add('panning');
            e.preventDefault();
        }
        
        function onPointerMove(e) {
            if (!panState.active) return;
            const dx = e.clientX - panState.startX;
            const dy = e.clientY - panState.startY;
            vp.scrollLeft = panState.scrollLeft - dx;
            vp.scrollTop = panState.scrollTop - dy;
        }
        
        function onPointerUp() {
            if (panState.active) {
                panState.active = false;
                vp.classList.remove('panning');
            }
        }
        
        vp.addEventListener('pointerdown', onPointerDown, { passive: false });
        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp, { passive: true });
        
        return () => {
            vp.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [zoom]);

    // Estados de carga
    if (engineLoading || !isEngineReady) {
        return (
            <div className="flipbook-status">
                <div className="loader-container">
                    <div className="spinner"></div>
                    <p className="loader-text">Inicializando motor PDF...</p>
                    <div className="loader-subtext">Preparando el entorno de visualización</div>
                </div>
            </div>
        );
    }
    if (engineError) {
        return (
            <div className="flipbook-status error">
                <div className="error-container">
                    <div className="error-icon">⚠</div>
                    <p className="error-text">Error al inicializar</p>
                    <div className="error-message">{engineError.message}</div>
                </div>
            </div>
        );
    }
    if (loading) {
        return (
            <div className="flipbook-status">
                <div className="loader-container">
                    <div className="spinner pulse"></div>
                    <p className="loader-text">Cargando PDF...</p>
                    <div className="loader-subtext">Procesando documento</div>
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="flipbook-status error">
                <div className="error-container">
                    <div className="error-icon">✕</div>
                    <p className="error-text">Error al cargar documento</p>
                    <div className="error-message">{error}</div>
                </div>
            </div>
        );
    }
    if (!pdfDocument) {
        return (
            <div className="flipbook-status">
                <div className="loader-container">
                    <div className="spinner dots"></div>
                    <p className="loader-text">Esperando documento...</p>
                </div>
            </div>
        );
    }

    // Cálculos de dimensiones
    const effectiveBaseW = responsive ? baseViewport.w : width;
    const effectiveBaseH = responsive ? baseViewport.h : height;
    const spreadWidth = effectiveBaseW;
    // En móvil queremos que la página use todo el ancho disponible
    const pageWidth = isMobile ? spreadWidth : spreadWidth / 2;
    const pageHeight = effectiveBaseH;
    const totalPages = pdfDocument.pageCount;
    const bookPages = isMobile ? pages : (pages.length % 2 === 0 ? pages : [...pages, null]);
    const clampedPage = Math.min(currentPage, pdfDocument.pageCount);
    const startPageIndex = Math.max(0, Math.min(currentPage - 1, totalPages - 1));
    const flipbookKey = `${isMobile ? 'mobile' : 'desktop'}-${totalPages}`;

    const viewportStyle = isFullscreen ? {} : {
        width: effectiveBaseW + 'px',
        height: effectiveBaseH + 'px',
        overflow: zoom > 1 ? 'auto' : 'hidden',
        cursor: zoom > 1 ? 'grab' : 'auto'
    };

    const viewportClasses = `flipbook-viewport ${zoom > 1 ? 'zoomed' : ''} ${isFullscreen ? 'fullscreen-mode' : ''}`;

    return (
        <div className="flipbook-container" ref={containerRef}>
            <FlipBookControls
                currentPage={clampedPage}
                totalPages={totalPages}
                zoom={zoom}
                zooming={zooming}
                zoomIndex={zoomIndex}
                maxZoomIndex={maxZoomIndex}
                rendering={rendering}
                onPrevPage={goPrev}
                onNextPage={goNext}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onResetZoom={resetZoom}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
            />
            
            <div className={viewportClasses} ref={viewportRef} style={viewportStyle}>
                {zoom > 1 && <div className="pan-overlay" />}
                <div 
                    className="flipbook-wrapper"
                    style={{ 
                        width: isMobile ? '100%' : spreadWidth,
                        height: pageHeight,
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                        transition: zooming ? 'none' : 'transform 0.3s ease-out'
                    }}
                >
                    <HTMLFlipBook
                        key={flipbookKey}
                        width={pageWidth}
                        height={pageHeight}
                        size={isMobile ? 'fixed' : 'stretch'} /* Fixed obligatorio en mobile para una sola página */
                        drawShadow={false}
                        showCover={true}
                        usePortrait={isMobile ? true : false} /* True obligatorio en mobile para una sola página */
                        showPageCorners={false}
                        useMouseEvents={zoom <= 1}
                        mobileScrollSupport={true}
                        flippingTime={200}
                        ref={bookRef}
                        startPage={startPageIndex}
                        className="flipbook"
                        onFlip={handleFlip}
                        
                    >
                        {bookPages.map((pageData, idx) => {
                            const pageNumber = idx + 1;
                            const isVisible = Math.abs(pageNumber - currentPage) <= 1;
                            
                            return (
                                <div className="page" key={idx}>
                                    <PDFPage 
                                        engine={engine}
                                        document={pdfDocument}
                                        pageNum={pageData?.pageNum}
                                        renderScale={zoom}
                                        isVisible={isVisible}
                                        onLinkClick={handleLinkClick}
                                        hotspots={hotspots}
                                        onHotspotClick={handleHotspotClick}
                                    />
                                </div>
                            );
                        })}
                    </HTMLFlipBook>
                </div>
            </div>
            
            {modalOpen && modalContent && (
                <Modal
                    isOpen={modalOpen}
                    onClose={handleCloseModal}
                    title={modalContent.title}
                    content={modalContent.content}
                    type={modalContent.type}
                />
            )}
        </div>
    );
}
