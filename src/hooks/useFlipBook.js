import { useState, useEffect, useRef, useCallback } from 'react';

// Hook para manejar zoom animado
export function useZoom({ zoomDuration = 150, zooms = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], viewportRef }) {
    const [zoom, setZoom] = useState(1);
    const [zoomIndex, setZoomIndex] = useState(1);
    const [zooming, setZooming] = useState(false);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const zoomAnimationRef = useRef(null);

    const easeInOut = useCallback((x) => {
        if (x < 0.5) {
            return Math.pow(x * 2, 2) / 2;
        }
        return 0.5 + (1 - Math.pow(1 - (x - 0.5) * 2, 2)) / 2;
    }, []);

    const zoomTo = useCallback((targetZoom, zoomAt = null) => {
        const viewport = viewportRef.current;
        if (!viewport) return;

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

        if (zoomAnimationRef.current) {
            cancelAnimationFrame(zoomAnimationRef.current);
        }

        animate();
    }, [zoom, zoomDuration, easeInOut, viewportRef]);

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
        setZoomIndex(1);
        zoomTo(zooms[1]);
    }, [zooms, zoomTo]);

    // Limpiar animación
    useEffect(() => {
        return () => {
            if (zoomAnimationRef.current) {
                cancelAnimationFrame(zoomAnimationRef.current);
            }
        };
    }, []);

    // Aplicar scroll
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        
        viewport.scrollLeft = scrollLeft;
        viewport.scrollTop = scrollTop;
    }, [scrollLeft, scrollTop, viewportRef]);

    return {
        zoom,
        zoomIndex,
        zooming,
        zoomIn,
        zoomOut,
        resetZoom,
        maxZoomIndex: zooms.length - 1
    };
}

// Hook para cargar PDF
export function usePdfLoader({ engine, isEngineReady, src }) {
    const [pdfDocument, setPdfDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadPdf = useCallback(async () => {
        if (!engine || !isEngineReady) return;
        
        setLoading(true);
        setError(null);
        
        try {
            let pdfUrl = src;
            if (!src.startsWith('http')) {
                const baseUrl = window.location.origin;
                const cleanPath = src.replace(/^\/src\/assets\//, '/');
                pdfUrl = `${baseUrl}${cleanPath}`;
            }
            
            const fileUrl = { id: "flipbook-doc", url: pdfUrl };
            const doc = await engine.openDocumentUrl(fileUrl).toPromise();
            setPdfDocument(doc);
        } catch (e) {
            console.error('Error loading PDF:', e);
            setError(`No se pudo cargar el PDF: ${e.message || 'Error desconocido'}`);
        } finally {
            setLoading(false);
        }
    }, [engine, isEngineReady, src]);

    useEffect(() => {
        if (isEngineReady) {
            loadPdf();
        }
    }, [isEngineReady, loadPdf]);

    return { pdfDocument, loading, error };
}

// Hook para detectar móvil
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
}

// Hook para cargar hotspots
export function useHotspots() {
    const [hotspots, setHotspots] = useState([]);

    useEffect(() => {
        fetch('https://test-flip.vercel.app/hotspots.json')
            .then(res => res.json())
            .then(data => {
                if (data?.hotspots) {
                    setHotspots(data.hotspots);
                }
            })
            .catch(err => {
                console.error('Error cargando hotspots:', err);
            });
    }, []);

    return hotspots;
}

// Hook para viewport responsivo
export function useResponsiveViewport({ containerRef, width, height, responsive }) {
    const [baseViewport, setBaseViewport] = useState({ w: width, h: height });

    useEffect(() => {
        if (!responsive) return;
        
        const ratio = height / width;
        
        function recalc() {
            if (!containerRef.current) return;
            const cw = containerRef.current.clientWidth;
            const targetW = Math.max(320, Math.min(cw - 32, width));
            const targetH = targetW * ratio;
            setBaseViewport(v => 
                (v.w !== targetW || v.h !== targetH) ? { w: targetW, h: targetH } : v
            );
        }
        
        recalc();
        const ro = new ResizeObserver(recalc);
        if (containerRef.current) ro.observe(containerRef.current);
        
        window.addEventListener('orientationchange', recalc);
        window.addEventListener('resize', recalc);
        
        return () => {
            ro.disconnect();
            window.removeEventListener('orientationchange', recalc);
            window.removeEventListener('resize', recalc);
        };
    }, [responsive, width, height, containerRef]);

    return baseViewport;
}
