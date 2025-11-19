import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_MOBILE_BREAKPOINT = 768;

const getIsTouchDevice = () => {
    if (typeof window === 'undefined') return false;
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const maxTouch = nav?.maxTouchPoints || nav?.msMaxTouchPoints || 0;
    return 'ontouchstart' in window || maxTouch > 0;
};

const computeIsMobileViewport = (breakpoint = DEFAULT_MOBILE_BREAKPOINT) => {
    if (typeof window === 'undefined') return false;
    const { innerWidth: width, innerHeight: height } = window;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
    const touchDevice = getIsTouchDevice();
    if (width <= breakpoint) {
        return true;
    }
    const shortestSide = Math.min(width, height);
    return touchDevice && coarsePointer && shortestSide <= breakpoint + 160;
};

// Hook para manejar zoom animado
export function useZoom({ zoomDuration = 150, zooms = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], viewportRef }) {
    const [zoom, setZoom] = useState(1);
    const [zoomIndex, setZoomIndex] = useState(0);
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
        setZoomIndex(0);
        zoomTo(zooms[0]);
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
export function useIsMobile(breakpoint = DEFAULT_MOBILE_BREAKPOINT) {
    const [isMobile, setIsMobile] = useState(() => computeIsMobileViewport(breakpoint));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const checkMobile = () => {
            setIsMobile(computeIsMobileViewport(breakpoint));
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        window.addEventListener('orientationchange', checkMobile);
        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('orientationchange', checkMobile);
        };
    }, [breakpoint]);

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
export function useResponsiveViewport({ containerRef, width, height, responsive, isFullscreen, isMobile }) {
    const [baseViewport, setBaseViewport] = useState(() => {
        // Inicialización más inteligente
        if (responsive && typeof window !== 'undefined') {
            const isMobileView = window.innerWidth < 768;
            // En móvil queremos una sola página a ancho casi completo,
            // en desktop usamos el spread de dos páginas
            const singlePageRatio = height / (width / 2); // ratio de una página individual
            const spreadRatio = height / width; // ratio del spread completo
            const ratio = isMobileView ? singlePageRatio : spreadRatio;
            
            // Menos margen en móvil para aprovechar todo el ancho
            const horizontalMargin = isMobileView ? 4 : 32;
            const maxContentWidth = isMobileView ? window.innerWidth - horizontalMargin : Math.min(window.innerWidth - horizontalMargin, width);
            const availableW = Math.max(320, maxContentWidth);
            const availableH = window.innerHeight - 150; // espacio para controles
            
            // Calcular basándose en qué dimensión es más restrictiva
            let targetW = Math.max(320, availableW);
            let targetH = targetW * ratio;
            
            // Si la altura calculada excede el espacio disponible, ajustar por altura
            if (targetH > availableH) {
                targetH = availableH;
                targetW = targetH / ratio;
            }
            
            return { w: Math.round(targetW), h: Math.round(targetH) };
        }
        return { w: width, h: height };
    });
    
    const recalcTimeoutRef = useRef(null);
    const isRecalculatingRef = useRef(false);

    useEffect(() => {
        function recalc() {
            // Evitar recálculos múltiples simultáneos
            if (isRecalculatingRef.current) return;
            if (recalcTimeoutRef.current) {
                clearTimeout(recalcTimeoutRef.current);
            }
            
            isRecalculatingRef.current = true;
            
            const container = containerRef.current;
            const isMobileView = isMobile || window.innerWidth < 768;
            
            // En móvil el ratio es de una página sola, en desktop es de dos páginas
            const singlePageRatio = height / (width / 2);
            const spreadRatio = height / width;
            const ratio = isMobileView ? singlePageRatio : spreadRatio;
            
            let targetW, targetH;
            
            if (isFullscreen && document.fullscreenElement) {
                // En fullscreen, calcular basado en viewport real
                const availableW = window.innerWidth - 16;
                const availableH = window.innerHeight - 90; // espacio para controles
                
                // Mantener aspect ratio
                const viewportRatio = availableW / availableH;
                const contentRatio = 1 / ratio;
                
                if (viewportRatio > contentRatio) {
                    // Limitado por altura
                    targetH = availableH;
                    targetW = targetH / ratio;
                } else {
                    // Limitado por ancho
                    targetW = availableW;
                    targetH = targetW * ratio;
                }
            } else if (responsive) {
                // Modo normal responsivo
                const cw = container ? container.clientWidth : window.innerWidth;
                const availableH = window.innerHeight - 150; // espacio para controles
                
                // Menos margen en móvil para aprovechar más espacio y una sola página
                const horizontalMargin = isMobileView ? 4 : 32;
                const contentMaxWidth = isMobileView ? cw - horizontalMargin : Math.min(cw - horizontalMargin, width);
                targetW = Math.max(320, contentMaxWidth);
                targetH = targetW * ratio;
                
                // Si la altura excede el espacio disponible, ajustar
                if (targetH > availableH) {
                    targetH = availableH;
                    targetW = targetH / ratio;
                }
            } else {
                // Modo fijo
                targetW = width;
                targetH = height;
            }
            
            setBaseViewport(v => {
                const newW = Math.round(targetW);
                const newH = Math.round(targetH);
                return (v.w !== newW || v.h !== newH) ? { w: newW, h: newH } : v;
            });
            
            // Marcar recálculo como completado después de un breve delay
            recalcTimeoutRef.current = setTimeout(() => {
                isRecalculatingRef.current = false;
            }, 200);
        }
        
        // Ejecutar inmediatamente
        recalc();
        
        // Observar cambios en el container
        const ro = new ResizeObserver(() => {
            if (!isRecalculatingRef.current) {
                recalc();
            }
        });
        if (containerRef.current) ro.observe(containerRef.current);
        
        const handleResize = () => {
            if (!isRecalculatingRef.current) {
                recalc();
            }
        };
        
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        
        return () => {
            if (recalcTimeoutRef.current) {
                clearTimeout(recalcTimeoutRef.current);
            }
            isRecalculatingRef.current = false;
            ro.disconnect();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, [responsive, width, height, containerRef, isFullscreen, isMobile]);

    return baseViewport;
}
