import { useEffect, useState, useRef, useCallback, memo } from 'react';
import HTMLFlipBook from 'react-pageflip';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import './FlipBook.css';

// Set worker (Vite + ESM friendly)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

// Componente de página individual
function PDFPage({ pdfDoc, pageNum, baseScale = 1.3, onNavigate, renderScale = 1, isVisible = false }) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const annotationLayerRef = useRef(null);
    const [scale, setScale] = useState(1);
    const lastRenderedScaleRef = useRef(null);
    const [viewport, setViewport] = useState(null);

    // Calcular viewport una sola vez
    useEffect(() => {
        if (!pdfDoc || !pageNum) return;
        
        let cancelled = false;
        
        const loadViewport = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                if (cancelled) return;
                const vp = page.getViewport({ scale: baseScale });
                setViewport(vp);
            } catch (error) {
                console.error('Error loading viewport:', error);
            }
        };
        
        loadViewport();
        
        return () => {
            cancelled = true;
        };
    }, [pdfDoc, pageNum, baseScale]);

    // Recalcular escala cuando cambia el tamaño del contenedor
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !viewport) return;

        const updateScale = () => {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            if (containerWidth > 0 && containerHeight > 0) {
                const scaleX = containerWidth / viewport.width;
                const scaleY = containerHeight / viewport.height;
                const actualScale = Math.min(scaleX, scaleY);
                setScale(actualScale);
            }
        };

        updateScale();

        const resizeObserver = new ResizeObserver(updateScale);
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
        };
    }, [viewport]);

    useEffect(() => {
        if (!pdfDoc || !pageNum || !viewport) return;
        
        // Renderizar siempre la primera vez
        const isFirstRender = lastRenderedScaleRef.current === null;
        
        if (!isFirstRender) {
            // Solo re-renderizar si el renderScale cambió significativamente
            if (Math.abs(lastRenderedScaleRef.current - renderScale) < 0.01) return;
            
            // Si no es visible y ya se renderizó una vez, no re-renderizar
            if (!isVisible) return;
        }
        
        let cancelled = false;
        let renderTask = null;
        
        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                if (cancelled) return;

                const canvas = canvasRef.current;
                const textLayerDiv = textLayerRef.current;
                const annotationLayerDiv = annotationLayerRef.current;
                
                if (!canvas || !textLayerDiv || !annotationLayerDiv) return;
                
                // Usar devicePixelRatio para HiDPI
                const dpr = window.devicePixelRatio || 1;
                const scaledViewport = page.getViewport({ 
                    scale: viewport.scale * renderScale * dpr 
                });
                
                const context = canvas.getContext('2d', { willReadFrequently: false });
                canvas.width = scaledViewport.width;
                canvas.height = scaledViewport.height;
                
                // Renderizar el canvas con alta resolución
                renderTask = page.render({
                    canvasContext: context,
                    viewport: scaledViewport,
                });
                
                await renderTask.promise;
                if (cancelled) return;
                
                lastRenderedScaleRef.current = renderScale;
                
                // Renderizar capa de texto (para selección) - actualmente no implementada
                // const textContent = await page.getTextContent();
                
                textLayerDiv.innerHTML = '';
                
                // Renderizar anotaciones (enlaces nativos del PDF)
                const annotations = await page.getAnnotations();
                if (cancelled) return;
                
                annotationLayerDiv.innerHTML = '';
                
                // Crear enlaces desde las anotaciones nativas del PDF
                for (const annotation of annotations) {
                    if (annotation.subtype === 'Link') {
                        const rect = pdfjsLib.Util.normalizeRect(
                            viewport.convertToViewportRectangle(annotation.rect)
                        );
                        
                        const linkElement = document.createElement('a');
                        linkElement.style.position = 'absolute';
                        linkElement.style.left = Math.min(rect[0], rect[2]) + 'px';
                        linkElement.style.top = Math.min(rect[1], rect[3]) + 'px';
                        linkElement.style.width = Math.abs(rect[2] - rect[0]) + 'px';
                        linkElement.style.height = Math.abs(rect[3] - rect[1]) + 'px';
                        
                        // Manejar diferentes tipos de enlaces
                        if (annotation.url) {
                            // Enlace externo
                            linkElement.href = annotation.url;
                            linkElement.target = '_blank';
                            linkElement.rel = 'noopener noreferrer';
                            linkElement.title = annotation.url;
                        } else if (annotation.dest) {
                            // Enlace interno (a otra página o destino nombrado)
                            linkElement.href = '#';
                            linkElement.onclick = async (e) => {
                                e.preventDefault();
                                try {
                                    let destArray = annotation.dest;
                                    
                                    // Si dest es una cadena (nombre de destino), resolverla
                                    if (typeof destArray === 'string') {
                                        destArray = await pdfDoc.getDestination(destArray);
                                    }
                                    
                                    if (destArray && Array.isArray(destArray)) {
                                        // destArray[0] contiene la referencia a la página
                                        const destRef = destArray[0];
                                        const pageIndex = await pdfDoc.getPageIndex(destRef);
                                        const targetPage = pageIndex + 1; // Convertir a 1-based
                                        
                                        // Extraer parámetros de zoom si existen
                                        let zoomValue = null;
                                        if (destArray.length > 1 && destArray[1]?.name) {
                                            // destArray[1] puede contener el tipo de vista (XYZ, Fit, FitH, etc.)
                                            // destArray[4] típicamente contiene el zoom para XYZ
                                            if (destArray[1].name === 'XYZ' && destArray[4]) {
                                                zoomValue = destArray[4];
                                            }
                                        }
                                        
                                        if (onNavigate) {
                                            onNavigate({ page: targetPage, zoom: zoomValue });
                                        }
                                    }
                                } catch (error) {
                                    console.error('Error navigating to destination:', error);
                                }
                            };
                            linkElement.title = `Ir a destino interno`;
                        } else if (annotation.action) {
                            // Acciones especiales (GoTo, URI, etc.)
                            linkElement.href = '#';
                            linkElement.onclick = async (e) => {
                                e.preventDefault();
                                
                                // Manejar acción GoTo
                                if (annotation.action === 'GoTo' && annotation.dest) {
                                    try {
                                        let destArray = annotation.dest;
                                        
                                        if (typeof destArray === 'string') {
                                            destArray = await pdfDoc.getDestination(destArray);
                                        }
                                        
                                        if (destArray && Array.isArray(destArray)) {
                                            const destRef = destArray[0];
                                            const pageIndex = await pdfDoc.getPageIndex(destRef);
                                            const targetPage = pageIndex + 1;
                                            
                                            let zoomValue = null;
                                            if (destArray.length > 1 && destArray[1]?.name === 'XYZ' && destArray[4]) {
                                                zoomValue = destArray[4];
                                            }
                                            
                                            if (onNavigate) {
                                                onNavigate({ page: targetPage, zoom: zoomValue });
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Error with GoTo action:', error);
                                    }
                                } else {
                                    console.log('Action not implemented:', annotation.action);
                                }
                            };
                            linkElement.title = `Acción: ${annotation.action}`;
                        }
                        
                        linkElement.className = 'pdf-link-native';
                        annotationLayerDiv.appendChild(linkElement);
                    }
                }
            } catch (error) {
                if (!cancelled && error.name !== 'RenderingCancelledException') {
                    console.error('Error rendering page:', error);
                }
            }
        };
        
        renderPage();
        
        return () => {
            cancelled = true;
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pdfDoc, pageNum, viewport, onNavigate, isVisible, renderScale]);
    
    if (!pdfDoc || !pageNum) {
        return <div className="blank-page" />;
    }
    
    return (
        <div 
            ref={containerRef}
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
            <div style={{
                position: 'relative',
                width: viewport ? `${viewport.width * scale}px` : '100%',
                height: viewport ? `${viewport.height * scale}px` : '100%',
            }}>
                <canvas 
                    ref={canvasRef}
                    style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                    }}
                />
                <div 
                    ref={textLayerRef}
                    className="textLayer"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: viewport ? `${viewport.width}px` : '100%',
                        height: viewport ? `${viewport.height}px` : '100%',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        pointerEvents: 'none',
                    }}
                />
                <div 
                    ref={annotationLayerRef}
                    className="annotationLayer"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: viewport ? `${viewport.width}px` : '100%',
                        height: viewport ? `${viewport.height}px` : '100%',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        zIndex: 10,
                    }}
                />
            </div>
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
        prevProps.pdfDoc === nextProps.pdfDoc
    );
});

export default function FlipBook({ src = '/src/assets/test.pdf', width = 1000, height = 700, baseScale = 1.3, minZoom = 0.6, maxZoom = 2.5, responsive = true, zoomDuration = 500, zooms = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5] }) {
    const [pdfDoc, setPdfDoc] = useState(null);
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

    const loadPdf = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const doc = await pdfjsLib.getDocument(src).promise;
            setPdfDoc(doc);
        } catch (e) {
            console.error(e);
            setError('No se pudo cargar el PDF');
        } finally {
            setLoading(false);
        }
    }, [src]);

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
            // Solo crear estructura básica, no calcular viewports aún
            for (let i = 1; i <= doc.numPages; i++) {
                if (token !== renderTokenRef.current) return;
                rendered.push({ 
                    pageNum: i,
                    viewport: null // Se calculará bajo demanda en PDFPage
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

    // cargar
    useEffect(() => { loadPdf(); }, [loadPdf]);

    // renderizar páginas solo una vez al cargar
    useEffect(() => {
        if (!pdfDoc) return;
        renderAllPages(pdfDoc);
    }, [pdfDoc, renderAllPages]);

    // handler directo de flip
    const handleFlip = useCallback((e) => {
        if (!e) return;
        const leftIndex = e.data || 0; // índice base 0
        setCurrentPage(leftIndex + 1);
    }, []);

    // handler para navegación desde enlaces internos del PDF
    const handleNavigate = useCallback(({ page, zoom: linkZoom }) => {
        if (!bookRef.current || !pdfDoc) return;
        
        const api = bookRef.current.pageFlip();
        if (!api) return;
        
        try {
            // Navegar a la página (convertir de 1-based a 0-based para el índice)
            const pageIndex = Math.max(0, Math.min(page - 1, pdfDoc.numPages - 1));
            api.flip(pageIndex);
            
            // Aplicar zoom si se especificó
            if (linkZoom && typeof linkZoom === 'number') {
                const targetZoom = Math.max(minZoom, Math.min(linkZoom, maxZoom));
                zoomTo(targetZoom);
            }
        } catch (error) {
            console.error('Error navigating to page:', error);
        }
    }, [pdfDoc, minZoom, maxZoom, zoomTo]);

    // Aplicar scroll controlado
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        
        viewport.scrollLeft = scrollLeft;
        viewport.scrollTop = scrollTop;
    }, [scrollLeft, scrollTop]);

    const totalPages = pdfDoc?.numPages || pages.length || 0;
    const startPageIndex = totalPages > 0 ? Math.max(0, Math.min(currentPage - 1, totalPages - 1)) : 0;
    const evenPages = pages.length % 2 === 0 ? pages : [...pages, null];
    // normalizar indice de página (evitar placeholder de página en blanco)
    const clampPage = useCallback((p) => {
        if (!pdfDoc) return p;
        return Math.min(p, pdfDoc.numPages);
    }, [pdfDoc]);

    const goPrev = () => {bookRef.current?.pageFlip().flipPrev(); };
    const goNext = () => {bookRef.current?.pageFlip().flipNext(); };

    // Ajusta el índice actual si se carga un documento nuevo o cambia su longitud.
    useEffect(() => {
        if (!pdfDoc) return;
        setCurrentPage(prev => Math.min(Math.max(prev, 1), pdfDoc.numPages));
    }, [pdfDoc]);

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

    if (loading) return <div className="flipbook-status">Cargando PDF...</div>;
    if (error) return <div className="flipbook-status error">{error}</div>;

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
                                        pdfDoc={pdfDoc} 
                                        pageNum={pageData?.pageNum}
                                        baseScale={baseScale}
                                        onNavigate={handleNavigate}
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
