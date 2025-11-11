import { useEffect, useState, useRef, useCallback, memo } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { usePdfiumEngine } from "@embedpdf/engines/react";
import './FlipBook.css';

// Componente de página individual usando @embedpdf/engines
function PDFPage({ engine, document, pageNum, renderScale = 1, isVisible = false }) {
    const imgRef = useRef(null);
    const [imageUrl, setImageUrl] = useState(null);
    const lastRenderedScaleRef = useRef(null);

    useEffect(() => {
        if (!engine || !document || !pageNum) return;
        
        // Renderizar siempre la primera vez
        const isFirstRender = lastRenderedScaleRef.current === null;
        
        if (!isFirstRender) {
            // Solo re-renderizar si el renderScale cambió significativamente
            if (Math.abs(lastRenderedScaleRef.current - renderScale) < 0.01) return;
            
            // Si no es visible y ya se renderizó una vez, no re-renderizar
            if (!isVisible) return;
        }
        
        let cancelled = false;
        
        const renderPage = async () => {
            try {
                const page = document.pages[pageNum - 1]; // pages es 0-based
                if (!page || cancelled) return;

                // Obtener DPR para pantallas de alta resolución
                const dpr = window.devicePixelRatio || 1;
                
                // Usar un factor de escala muy alto para máxima nitidez
                // Factor 2.0 como base + renderScale del usuario + dpr
                const highQualityScale = 2.0 * renderScale * dpr;

                console.log(`Rendering page ${pageNum} at scale: ${highQualityScale} (renderScale: ${renderScale}, dpr: ${dpr})`);

                // Renderizar con alta calidad usando dpr y scaleFactor
                const imageBlob = await engine
                    .renderPage(document, page, {
                        scaleFactor: highQualityScale, // Máxima calidad
                        dpr: 1, // Ya incluido en scaleFactor
                        withAnnotations: true,
                        imageType: 'image/png', // PNG para mejor calidad
                    })
                    .toPromise();

                if (cancelled) return;
                
                // Liberar URL anterior
                if (imageUrl) {
                    URL.revokeObjectURL(imageUrl);
                }

                // Crear nueva URL para la imagen
                const newImageUrl = URL.createObjectURL(imageBlob);
                setImageUrl(newImageUrl);
                lastRenderedScaleRef.current = renderScale;
            } catch (error) {
                if (!cancelled) {
                    console.error('Error rendering page:', error);
                }
            }
        };
        
        renderPage();
        
        return () => {
            cancelled = true;
        };
    }, [engine, document, pageNum, renderScale, isVisible, imageUrl]);
    
    // Cleanup: liberar URLs cuando se desmonte
    useEffect(() => {
        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);
    
    if (!document || !pageNum) {
        return <div className="blank-page" />;
    }
    
    return (
        <div 
            className="pdf-page-container" 
            style={{ 
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {imageUrl ? (
                <img
                    ref={imgRef}
                    src={imageUrl}
                    alt={`PDF Page ${pageNum}`}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        display: 'block',
                        imageRendering: 'crisp-edges', // Evitar suavizado/blur
                        WebkitFontSmoothing: 'antialiased',
                        objectFit: 'contain',
                    }}
                />
            ) : (
                <div style={{ padding: '20px', color: '#666' }}>Cargando...</div>
            )}
        </div>
    );
}

// Memoizar PDFPage para evitar re-renders innecesarios
const MemoizedPDFPage = memo(PDFPage, (prevProps, nextProps) => {
    // Solo re-renderizar si cambian props importantes
    return (
        prevProps.pageNum === nextProps.pageNum &&
        prevProps.renderScale === nextProps.renderScale &&
        prevProps.isVisible === nextProps.isVisible &&
        prevProps.document === nextProps.document &&
        prevProps.engine === nextProps.engine
    );
});

export default function FlipBook({ src = '/test.pdf', width = 1000, height = 700, minZoom = 0.6, maxZoom = 2.5, responsive = true, zoomDuration = 500, zooms = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5] }) {
    const { engine, isLoading: engineLoading, error: engineError } = usePdfiumEngine();
    const [isEngineReady, setIsEngineReady] = useState(false);
    const [pdfDocument, setPdfDocument] = useState(null);
    const [pages, setPages] = useState([]); // {pageNum}
    const [loading, setLoading] = useState(true);
    const [rendering, setRendering] = useState(false);
    const [error, setError] = useState(null);
    const [zoom, setZoom] = useState(1); // Zoom actual (animado suavemente)
    const [zoomIndex, setZoomIndex] = useState(1); // Índice en array de zooms (comienza en 100%)
    const [zooming, setZooming] = useState(false); // Si está animando zoom
    const [currentPage, setCurrentPage] = useState(1); // 1-based
    const bookRef = useRef(null);
    const renderTokenRef = useRef(0);
    const viewportRef = useRef(null);
    const containerRef = useRef(null);
    const flipbookContainerRef = useRef(null);
    const [baseViewport, setBaseViewport] = useState({ w: width, h: height });
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const zoomAnimationRef = useRef(null);

    // Inline Lucide icons (subset) - stroke inherits current color
    const icons = {
        chevronLeft: (
            <svg className="icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
            </svg>
        ),
        chevronRight: (
            <svg className="icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
            </svg>
        ),
        minus: (
            <svg className="icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
            </svg>
        ),
        plus: (
            <svg className="icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
        ),
        refreshCw: (
            <svg className="icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6l3 2" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6l-3-2" />
            </svg>
        )
    };

    // Inicializar el engine cuando esté disponible
    useEffect(() => {
        if (engine && !isEngineReady) {
            engine
                .initialize()
                .toPromise()
                .then(() => setIsEngineReady(true))
                .catch((err) => {
                    console.error('Error initializing engine:', err);
                    setError('No se pudo inicializar el motor PDF');
                });
        }
    }, [engine, isEngineReady]);

    // Cargar el documento PDF
    const loadPdf = useCallback(async () => {
        if (!engine || !isEngineReady) return;
        
        setLoading(true);
        setError(null);
        try {
            // Convertir ruta relativa a URL absoluta
            let pdfUrl = src;
            if (!src.startsWith('http')) {
                // Para rutas locales, usar la URL base actual
                const baseUrl = window.location.origin;
                // Limpiar la ruta (eliminar /src/ si existe)
                const cleanPath = src.replace(/^\/src\/assets\//, '/');
                pdfUrl = `${baseUrl}${cleanPath}`;
            }
            
            console.log('Loading PDF from:', pdfUrl);
            
            const fileUrl = {
                id: "flipbook-doc",
                url: pdfUrl,
            };
            
            const doc = await engine.openDocumentUrl(fileUrl).toPromise();
            setPdfDocument(doc);
            console.log(`Successfully opened document with ${doc.pageCount} pages.`);
        } catch (e) {
            console.error('Error loading PDF:', e);
            setError(`No se pudo cargar el PDF: ${e.message || 'Error desconocido'}`);
        } finally {
            setLoading(false);
        }
    }, [engine, isEngineReady, src]);

    // Ease in/out function (como en Vue)
    const easeInOut = useCallback((x) => {
        if (x < 0.5) {
            return Math.pow(x * 2, 2) / 2;
        }
        return 0.5 + (1 - Math.pow(1 - (x - 0.5) * 2, 2)) / 2;
    }, []);

    // Función de zoom animada (estilo Vue)
    const zoomTo = useCallback((targetZoom, zoomAt = null) => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        // Calcular punto fijo de zoom
        let fixedX, fixedY;
        if (zoomAt) {
            const rect = viewport.getBoundingClientRect();
            fixedX = zoomAt.pageX - rect.left;
            fixedY = zoomAt.pageY - rect.top;
        } else {
            fixedX = viewport.clientWidth / 2;
            fixedY = viewport.clientHeight / 2;
        }

        const startZoom = zoom;
        const endZoom = targetZoom;
        const startX = viewport.scrollLeft;
        const startY = viewport.scrollTop;
        
        // Calcular scroll final para mantener punto fijo
        const containerFixedX = fixedX + startX;
        const containerFixedY = fixedY + startY;
        const endX = containerFixedX / startZoom * endZoom - fixedX;
        const endY = containerFixedY / startZoom * endZoom - fixedY;

        const t0 = Date.now();
        setZooming(true);

        const animate = () => {
            const t = Date.now() - t0;
            let ratio = t / zoomDuration;
            if (ratio > 1) ratio = 1;
            
            const easedRatio = easeInOut(ratio);
            const currentZoom = startZoom + (endZoom - startZoom) * easedRatio;
            const currentX = startX + (endX - startX) * easedRatio;
            const currentY = startY + (endY - startY) * easedRatio;

            setZoom(currentZoom);
            setScrollLeft(currentX);
            setScrollTop(currentY);

            if (ratio < 1) {
                zoomAnimationRef.current = requestAnimationFrame(animate);
            } else {
                setZooming(false);
                setZoom(endZoom);
                setScrollLeft(endX);
                setScrollTop(endY);
                zoomAnimationRef.current = null;
            }
        };

        // Cancelar animación previa
        if (zoomAnimationRef.current) {
            cancelAnimationFrame(zoomAnimationRef.current);
        }

        animate();
    }, [zoom, zoomDuration, easeInOut]);

    // Zoom in/out con niveles discretos
    const zoomIn = useCallback((zoomAt = null) => {
        if (zooming || zoomIndex >= zooms.length - 1) return;
        const newIndex = zoomIndex + 1;
        setZoomIndex(newIndex);
        zoomTo(zooms[newIndex], zoomAt);
    }, [zooming, zoomIndex, zooms, zoomTo]);

    const zoomOut = useCallback((zoomAt = null) => {
        if (zooming || zoomIndex <= 0) return;
        const newIndex = zoomIndex - 1;
        setZoomIndex(newIndex);
        zoomTo(zooms[newIndex], zoomAt);
    }, [zooming, zoomIndex, zooms, zoomTo]);

    const resetZoom = useCallback(() => {
        setZoomIndex(1); // Volver a 100%
        zoomTo(zooms[1]);
    }, [zooms, zoomTo]);
    
    // Limpiar animación al desmontar
    useEffect(() => {
        return () => {
            if (zoomAnimationRef.current) {
                cancelAnimationFrame(zoomAnimationRef.current);
            }
        };
    }, []);

    const renderAllPages = useCallback(async (doc) => {
        if (!doc) return;
        const token = ++renderTokenRef.current;
        setRendering(true);
        try {
            const rendered = [];
            // Solo crear estructura básica de páginas
            for (let i = 1; i <= doc.pageCount; i++) {
                if (token !== renderTokenRef.current) return;
                rendered.push({ 
                    pageNum: i,
                });
            }
            if (token === renderTokenRef.current) {
                setPages(rendered);
            }
        } catch (e) {
            console.error(e);
            if (!error) setError('Error renderizando páginas');
        } finally {
            if (token === renderTokenRef.current) setRendering(false);
        }
    }, [error]);

    // Responsive recalculo de base (mantiene aspecto y reduce si el contenedor es más pequeño)
    useEffect(() => {
        if (!responsive) return; // modo fijo
        const ratio = height / width;
        function recalc() {
            if (!containerRef.current) return;
            const cw = containerRef.current.clientWidth; // ancho interno disponible
            const maxTarget = width; // no crecer más que el width original para no re-renderizar con más resolución
            const targetW = Math.max(320, Math.min(cw - 32, maxTarget)); // margen aproximado
            const targetH = targetW * ratio;
            setBaseViewport(v => (v.w !== targetW || v.h !== targetH ? { w: targetW, h: targetH } : v));
        }
        recalc();
        const ro = new ResizeObserver(() => recalc());
        if (containerRef.current) ro.observe(containerRef.current);
        window.addEventListener('orientationchange', recalc);
        window.addEventListener('resize', recalc);
        return () => {
            ro.disconnect();
            window.removeEventListener('orientationchange', recalc);
            window.removeEventListener('resize', recalc);
        };
    }, [responsive, width, height]);

    // cargar PDF cuando el engine esté listo
    useEffect(() => { 
        if (isEngineReady) {
            loadPdf(); 
        }
    }, [isEngineReady, loadPdf]);

    // renderizar páginas solo una vez al cargar
    useEffect(() => {
        if (!pdfDocument) return;
        renderAllPages(pdfDocument);
    }, [pdfDocument, renderAllPages]);

    // handler directo de flip
    const handleFlip = useCallback((e) => {
        if (!e) return;
        const leftIndex = e.data || 0; // índice base 0
        setCurrentPage(leftIndex + 1);
    }, []);

    // TODO: handler para navegación desde enlaces internos del PDF
    // Esto requeriría soporte adicional de @embedpdf/engines para extraer anotaciones
    // const handleNavigate = useCallback(({ page, zoom: linkZoom }) => {
    //     if (!bookRef.current || !pdfDocument) return;
    //     const api = bookRef.current.pageFlip();
    //     if (!api) return;
    //     try {
    //         const pageIndex = Math.max(0, Math.min(page - 1, pdfDocument.pageCount - 1));
    //         api.flip(pageIndex);
    //         if (linkZoom && typeof linkZoom === 'number') {
    //             const targetZoom = Math.max(minZoom, Math.min(linkZoom, maxZoom));
    //             zoomTo(targetZoom);
    //         }
    //     } catch (error) {
    //         console.error('Error navigating to page:', error);
    //     }
    // }, [pdfDocument, minZoom, maxZoom, zoomTo]);

    // Aplicar scroll controlado
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        
        viewport.scrollLeft = scrollLeft;
        viewport.scrollTop = scrollTop;
    }, [scrollLeft, scrollTop]);

    const totalPages = pdfDocument?.pageCount || pages.length || 0;
    const startPageIndex = totalPages > 0 ? Math.max(0, Math.min(currentPage - 1, totalPages - 1)) : 0;
    const evenPages = pages.length % 2 === 0 ? pages : [...pages, null];
    // normalizar indice de página (evitar placeholder de página en blanco)
    const clampPage = useCallback((p) => {
        if (!pdfDocument) return p;
        return Math.min(p, pdfDocument.pageCount);
    }, [pdfDocument]);

    const goPrev = () => {bookRef.current?.pageFlip().flipPrev(); };
    const goNext = () => {bookRef.current?.pageFlip().flipNext(); };

    // Ajusta el índice actual si se carga un documento nuevo o cambia su longitud.
    useEffect(() => {
        if (!pdfDocument) return;
        setCurrentPage(prev => Math.min(Math.max(prev, 1), pdfDocument.pageCount));
    }, [pdfDocument]);

    // Mantiene la página visible tras recrear el flipbook (por ejemplo cuando cambia el zoom).
    useEffect(() => {
        if (!totalPages || pages.length === 0) return;
        const api = bookRef.current?.pageFlip?.();
        if (!api) return;
        try {
            const currentIndex = api.getCurrentPageIndex?.();
            if (typeof currentIndex === 'number' && currentIndex !== startPageIndex) {
                api.flip(startPageIndex);
            }
        } catch (e) {
            console.error(e);
        }
    }, [pages, startPageIndex, totalPages]);

    // Panning (drag to scroll) cuando zoom > 1
    useEffect(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        
        let panState = { active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 };
        
        function onPointerDown(e) {
            if (zoom <= 1) return; // permitir flips normales
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

    if (engineLoading || !isEngineReady) return <div className="flipbook-status">Inicializando motor PDF...</div>;
    if (engineError) return <div className="flipbook-status error">Error: {engineError.message}</div>;
    if (loading) return <div className="flipbook-status">Cargando PDF...</div>;
    if (error) return <div className="flipbook-status error">{error}</div>;
    if (!pdfDocument) return <div className="flipbook-status">Esperando documento...</div>;

    const effectiveBaseW = responsive ? baseViewport.w : width;
    const effectiveBaseH = responsive ? baseViewport.h : height;
    const spreadWidth = effectiveBaseW;
    const pageWidth = spreadWidth / 2;
    const pageHeight = effectiveBaseH;

    // viewport mantiene tamaño base (spread original) para crear área de paneo
    const viewportStyle = {
        width: effectiveBaseW + 'px',
        height: effectiveBaseH + 'px',
        overflow: zoom > 1 ? 'auto' : 'hidden',
        cursor: zoom > 1 ? 'grab' : 'auto'
    };

    return (
    <div className="flipbook-container dark-theme" ref={containerRef}>
            <div className="flipbook-controls dark-layout">
                <div className="control-group nav-group">
                    <button className="btn" onClick={goPrev} disabled={currentPage <= 1} aria-label="Página anterior" title="Anterior (solo sin zoom)">{icons.chevronLeft}</button>
                    <span className="page-indicator" aria-live="polite">Pág {clampPage(currentPage)} / {totalPages}</span>
                    <button className="btn" onClick={goNext} disabled={currentPage >= totalPages} aria-label="Página siguiente" title="Siguiente (solo sin zoom)">{icons.chevronRight}</button>
                </div>
                <div className="control-group zoom-group">
                    <button className="btn ghost" onClick={() => zoomOut()} disabled={zooming || zoomIndex <= 0} aria-label="Alejar" title="Alejar">{icons.minus}</button>
                    <div className="slider-wrapper" title="Zoom">
                        <input className="zoom-slider" type="range" min={0} max={zooms.length - 1} step={1} value={zoomIndex} onChange={e => { setZoomIndex(parseInt(e.target.value)); zoomTo(zooms[parseInt(e.target.value)]); }} disabled={zooming} />
                    </div>
                    <button className="btn ghost" onClick={() => zoomIn()} disabled={zooming || zoomIndex >= zooms.length - 1} aria-label="Acercar" title="Acercar">{icons.plus}</button>
                    <span className="zoom-label" aria-live="polite">{Math.round(zoom * 100)}%</span>
                    <button className="btn ghost" onClick={resetZoom} disabled={zoom === 1 || zooming} aria-label="Reset zoom" title="Restablecer zoom (100%)">{icons.refreshCw}</button>
                </div>
                {rendering && <div className="render-indicator">Renderizando…</div>}
            </div>
            <div className="flipbook-viewport" ref={viewportRef} style={viewportStyle}>
                {zoom > 1 && <div className="pan-overlay" />}
                <div 
                    className="flipbook-wrapper" 
                    ref={flipbookContainerRef}
                    style={{ 
                        width: spreadWidth,
                        height: pageHeight,
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                        transition: zooming ? 'none' : 'transform 0.3s ease-out'
                    }}
                >
                    <HTMLFlipBook
                        width={pageWidth}
                        height={pageHeight}
                        size="fixed"
                        minWidth={315}
                        maxWidth={2000}
                        maxHeight={pageHeight}
                        drawShadow
                        showCover={true}
                        usePortrait={false}
                        mobileScrollSupport
                        showPageCorners={false}
                        ref={bookRef}
                        startPage={startPageIndex}
                        className="flipbook"
                        useMouseEvents={zoom <=1}
                        flippingTime={300}
                        onFlip={handleFlip}
                    >
                        {evenPages.map((pageData, idx) => {
                            // Determinar si la página es visible (página actual y vecinas)
                            const pageNumber = idx + 1;
                            const isVisible = Math.abs(pageNumber - currentPage) <= 1;
                            
                            return (
                                <div className="page" key={idx} data-density={pageData ? 'hard' : 'soft'}>
                                    <MemoizedPDFPage 
                                        engine={engine}
                                        document={pdfDocument}
                                        pageNum={pageData?.pageNum}
                                        renderScale={zoom}
                                        isVisible={isVisible}
                                    />
                                </div>
                            );
                        })}
                    </HTMLFlipBook>
                </div>
            </div>
        </div>
    );
}
