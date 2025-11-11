import { useEffect, useState, useRef, useCallback } from 'react';
import HTMLFlipBook from 'react-pageflip';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import './FlipBook.css';

// Set worker (Vite + ESM friendly)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

// Componente de página individual que usa un iframe o embed para renderizar el PDF nativamente
function PDFPage({ pdfDoc, pageNum, viewport, onNavigate }) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const annotationLayerRef = useRef(null);
    const [scale, setScale] = useState(1);

    // Recalcular escala cuando cambia el tamaño del contenedor o el viewport
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
        if (!pdfDoc || !pageNum) return;
        
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
                
                const context = canvas.getContext('2d', { willReadFrequently: false });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                // Renderizar el canvas
                renderTask = page.render({
                    canvasContext: context,
                    viewport,
                });
                
                await renderTask.promise;
                if (cancelled) return;
                
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
    }, [pdfDoc, pageNum, viewport, onNavigate]);
    
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
                width: `${viewport.width * scale}px`,
                height: `${viewport.height * scale}px`,
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
                        width: `${viewport.width}px`,
                        height: `${viewport.height}px`,
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
                        width: `${viewport.width}px`,
                        height: `${viewport.height}px`,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        zIndex: 10,
                    }}
                />
            </div>
        </div>
    );
}

export default function FlipBook({ src = '/src/assets/test.pdf', width = 1000, height = 700, baseScale = 1.3, minZoom = 0.6, maxZoom = 2.5, responsive = true }) {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [pages, setPages] = useState([]); // {pageNum, viewport}
    const [loading, setLoading] = useState(true);
    const [rendering, setRendering] = useState(false);
    const [error, setError] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [currentPage, setCurrentPage] = useState(1); // 1-based
    const bookRef = useRef(null);
    const renderTokenRef = useRef(0);
    const viewportRef = useRef(null);
    const panState = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
    const containerRef = useRef(null);
    const [baseViewport, setBaseViewport] = useState({ w: width, h: height });

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

    const renderAllPages = useCallback(async (doc, scaleMultiplier, pixelScale = 1) => {
        if (!doc) return;
        const token = ++renderTokenRef.current;
        setRendering(true);
        try {
            const rendered = [];
            for (let i = 1; i <= doc.numPages; i++) {
                if (token !== renderTokenRef.current) return;
                const page = await doc.getPage(i);
                const viewport = page.getViewport({ scale: baseScale * scaleMultiplier * pixelScale });
                rendered.push({ 
                    pageNum: i,
                    viewport
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
    }, [baseScale, error]);

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

    // renderizar con zoom
    useEffect(() => {
        if (!pdfDoc) return;
        // pixelScale: si el ancho base efectivo es menor al original, reducimos pixelScale para no renderizar más grande de lo necesario.
        const pixelScale = (responsive ? (baseViewport.w / width) : 1) || 1;
        renderAllPages(pdfDoc, zoom, pixelScale);
    }, [pdfDoc, zoom, renderAllPages, baseViewport.w, baseViewport.h, responsive, width]);

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
            
            // Aplicar zoom si se especificó (linkZoom suele ser un valor como 1.5 para 150%)
            if (linkZoom && typeof linkZoom === 'number') {
                const targetZoom = Math.max(minZoom, Math.min(linkZoom, maxZoom));
                setZoom(targetZoom);
            }
        } catch (error) {
            console.error('Error navigating to page:', error);
        }
    }, [pdfDoc, minZoom, maxZoom]);

    const totalPages = pdfDoc?.numPages || pages.length || 0;
    const startPageIndex = totalPages > 0 ? Math.max(0, Math.min(currentPage - 1, totalPages - 1)) : 0;
    const evenPages = pages.length % 2 === 0 ? pages : [...pages, null];

    const incrementZoom = (delta) => setZoom(z => Math.min(maxZoom, Math.max(minZoom, +(z + delta).toFixed(2))));
    const resetZoom = () => setZoom(1);
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
        function onPointerDown(e) {
            if (zoom <= 1) return; // permitir flips normales
            panState.current = {
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
            const st = panState.current;
            if (!st.active) return;
            const dx = e.clientX - st.startX;
            const dy = e.clientY - st.startY;
            vp.scrollLeft = st.scrollLeft - dx;
            vp.scrollTop = st.scrollTop - dy;
        }
        function onPointerUp() {
            if (panState.current.active) {
                panState.current.active = false;
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
    const spreadWidth = effectiveBaseW * zoom;
    const pageWidth = spreadWidth / 2;
    const pageHeight = effectiveBaseH * zoom;

    // viewport mantiene tamaño base (spread original) para crear área de paneo
    const viewportStyle = {
        width: effectiveBaseW + 'px',
        height: effectiveBaseH + 'px',
        overflow: zoom > 1 ? 'auto' : 'hidden',
        cursor: zoom > 1 ? (panState.current.active ? 'grabbing' : 'grab') : 'default'
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
                    <button className="btn ghost" onClick={() => incrementZoom(-0.25)} disabled={rendering || zoom <= minZoom} aria-label="Alejar" title="Alejar">{icons.minus}</button>
                    <div className="slider-wrapper" title="Zoom">
                        <input className="zoom-slider" type="range" min={minZoom} max={maxZoom} step={0.25} value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} disabled={rendering} />
                    </div>
                    <button className="btn ghost" onClick={() => incrementZoom(0.25)} disabled={rendering || zoom >= maxZoom} aria-label="Acercar" title="Acercar">{icons.plus}</button>
                    <span className="zoom-label" aria-live="polite">{Math.round(zoom * 100)}%</span>
                    <button className="btn ghost" onClick={resetZoom} disabled={zoom === 1 || rendering} aria-label="Reset zoom" title="Restablecer zoom">{icons.refreshCw}</button>
                </div>
                {rendering && <div className="render-indicator">Renderizando…</div>}
            </div>
            <div className="flipbook-viewport" ref={viewportRef} style={viewportStyle}>
                {zoom > 1 && <div className="pan-overlay" />}
                <div className="flipbook-wrapper" style={{ width: spreadWidth, height: pageHeight }}>
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
                        style={{ transition: 'width .2s,height .2s' }}
                        key={`zoom-${zoom.toFixed(2)}-base-${effectiveBaseW}x${effectiveBaseH}`}
                        onFlip={handleFlip}
                    >
                        {evenPages.map((pageData, idx) => (
                            <div className="page" key={idx} data-density={pageData ? 'hard' : 'soft'}>
                                <PDFPage 
                                    pdfDoc={pdfDoc} 
                                    pageNum={pageData?.pageNum} 
                                    viewport={pageData?.viewport}
                                    onNavigate={handleNavigate}
                                />
                            </div>
                        ))}
                    </HTMLFlipBook>
                </div>
            </div>
        </div>
    );
}
