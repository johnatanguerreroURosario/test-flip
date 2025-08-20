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

export default function FlipBook({ src = '/src/assets/test.pdf', width = 1000, height = 700, baseScale = 1.3, minZoom = 0.6, maxZoom = 2.5, responsive = true }) {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [pages, setPages] = useState([]); // {dataUrl,w,h}
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
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: context, viewport, enableWebGL: true }).promise;
                rendered.push({ dataUrl: canvas.toDataURL('image/png'), w: viewport.width, h: viewport.height });
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

    const totalPages = pdfDoc?.numPages || pages.length || 0;
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

    // Sincronizar página actual después de renderizaciones (ej. cambio de zoom recompone el componente)
    useEffect(() => {
        const api = bookRef.current?.pageFlip?.();
        if (api) {
            try {
                const page = api.getCurrentPageIndex?.(); // índice base 0
                if (typeof page === 'number') setCurrentPage(page + 1);
            } catch (_) { }
        }
    }, [zoom, pages.length]);

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
                        showCover={false}
                        usePortrait={false}
                        mobileScrollSupport
                        ref={bookRef}
                        className="flipbook"
                        useMouseEvents={zoom <=1}
                        style={{ transition: 'width .2s,height .2s' }}
                        key={`zoom-${zoom.toFixed(2)}-base-${effectiveBaseW}x${effectiveBaseH}`}
                        onFlip={handleFlip}
                    >
                        {evenPages.map((page, idx) => (
                            <div className="page" key={idx} data-density={page ? 'hard' : 'soft'}>
                                {page ? (
                                    <img
                                        src={page.dataUrl}
                                        alt={`Página ${idx + 1}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        draggable={false}
                                    />
                                ) : <div className="blank-page" />}
                            </div>
                        ))}
                    </HTMLFlipBook>
                </div>
            </div>
        </div>
    );
}
