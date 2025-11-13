import { useEffect, useState, useRef, memo } from 'react';
import Hotspot from '../Hotspot';

// Componente para renderizar enlaces sobre la página
function PageLinks({ document, pageNum, links, onLinkClick, imgWidth, imgHeight }) {
    if (!links?.length) return null;

    const page = document.pages[pageNum - 1];
    if (!page || !imgWidth || !imgHeight) return null;

    const scaleX = imgWidth / page.size.width;
    const scaleY = imgHeight / page.size.height;

    return (
        <>
            {links.map((link, idx) => {
                const rect = link.rect;
                if (!rect?.origin || !rect?.size) return null;
                
                const left = rect.origin.x * scaleX;
                const top = rect.origin.y * scaleY;
                const width = rect.size.width * scaleX;
                const height = rect.size.height * scaleY;
                
                return (
                    <div
                        key={link.id || idx}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onLinkClick(link);
                        }}
                        className="pdf-link"
                        style={{
                            left: `${left}px`,
                            top: `${top}px`,
                            width: `${width}px`,
                            height: `${height}px`,
                        }}
                        title={link.target?.action?.uri || (link.target?.destination ? 'Enlace interno' : 'Enlace')}
                    />
                );
            })}
        </>
    );
}

// Componente para renderizar hotspots sobre la página
function PageHotspots({ pageNum, hotspots, onHotspotClick, imgWidth, imgHeight }) {
    if (!hotspots?.length || !imgWidth || !imgHeight) return null;

    const pageHotspots = hotspots.filter(h => h.page === pageNum);
    if (!pageHotspots.length) return null;

    return (
        <>
            {pageHotspots.map((hotspot) => (
                <Hotspot
                    key={hotspot.id}
                    hotspot={hotspot}
                    onClick={onHotspotClick}
                    imgWidth={imgWidth}
                    imgHeight={imgHeight}
                />
            ))}
        </>
    );
}

// Componente de página individual
function PDFPage({ 
    engine, 
    document, 
    pageNum, 
    renderScale = 1, 
    isVisible = false, 
    onLinkClick, 
    hotspots, 
    onHotspotClick 
}) {
    const imgRef = useRef(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [links, setLinks] = useState([]);
    const lastRenderedScaleRef = useRef(null);
    
    // Reset cuando cambia la imagen
    useEffect(() => {
        setImageLoaded(false);
        setImageDimensions({ width: 0, height: 0 });
    }, [pageNum, imageUrl]);

    // Observar cambios de tamaño
    useEffect(() => {
        const img = imgRef.current;
        if (!img || !imageLoaded) return;

        const measure = () => {
            const w = img.offsetWidth || img.clientWidth || 0;
            const h = img.offsetHeight || img.clientHeight || 0;
            setImageDimensions(prev => 
                (prev.width !== w || prev.height !== h) ? { width: w, height: h } : prev
            );
        };

        requestAnimationFrame(measure);
        setTimeout(measure, 50);

        const ro = new ResizeObserver(measure);
        ro.observe(img);
        return () => ro.disconnect();
    }, [imageLoaded, isVisible]);

    // Cargar anotaciones de enlaces
    useEffect(() => {
        if (!engine || !document || !pageNum) return;
        
        let cancelled = false;
        
        const loadAnnotations = async () => {
            try {
                const page = document.pages[pageNum - 1];
                if (!page || cancelled) return;
                
                const annotations = await engine.getPageAnnotations(document, page).toPromise();
                if (cancelled) return;
                
                const linkAnnotations = annotations.filter(anno => anno.type === 2);
                setLinks(linkAnnotations);
            } catch (error) {
                if (!cancelled) {
                    console.error(`Error loading annotations for page ${pageNum}:`, error);
                }
            }
        };
        
        loadAnnotations();
        return () => { cancelled = true; };
    }, [engine, document, pageNum]);

    // Renderizar página
    useEffect(() => {
        if (!engine || !document || !pageNum) return;
        
        const isFirstRender = lastRenderedScaleRef.current === null;
        
        if (!isFirstRender) {
            if (Math.abs(lastRenderedScaleRef.current - renderScale) < 0.01) return;
            if (!isVisible) return;
        }
        
        let cancelled = false;
        
        const renderPage = async () => {
            try {
                const page = document.pages[pageNum - 1];
                if (!page || cancelled) return;

                const dpr = window.devicePixelRatio || 1;
                const highQualityScale = 2.0 * renderScale * dpr;

                const imageBlob = await engine
                    .renderPage(document, page, {
                        scaleFactor: highQualityScale,
                        dpr: 1,
                        withAnnotations: true,
                        imageType: 'image/png',
                    })
                    .toPromise();

                if (cancelled) return;
                
                if (imageUrl) {
                    URL.revokeObjectURL(imageUrl);
                }

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
        return () => { cancelled = true; };
    }, [engine, document, pageNum, renderScale, isVisible, imageUrl]);
    
    // Cleanup URLs
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
        <div className="pdf-page-container">
            {imageUrl ? (
                <div className="pdf-page-content">
                    <img
                        ref={imgRef}
                        src={imageUrl}
                        alt={`PDF Page ${pageNum}`}
                        onLoad={() => setImageLoaded(true)}
                        className="pdf-page-image"
                    />
                    {imageLoaded && imageDimensions.width > 0 && (
                        <>
                            <div className="pdf-overlay-layer">
                                {links.length > 0 && (
                                    <PageLinks
                                        document={document}
                                        pageNum={pageNum}
                                        links={links}
                                        onLinkClick={onLinkClick}
                                        imgWidth={imageDimensions.width}
                                        imgHeight={imageDimensions.height}
                                    />
                                )}
                            </div>
                            <div className="pdf-hotspot-layer">
                                {hotspots?.length > 0 && (
                                    <PageHotspots
                                        pageNum={pageNum}
                                        hotspots={hotspots}
                                        onHotspotClick={onHotspotClick}
                                        imgWidth={imageDimensions.width}
                                        imgHeight={imageDimensions.height}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="pdf-page-loading">
                    <div className="mini-spinner"></div>
                </div>
            )}
        </div>
    );
}

// Memoizar PDFPage
export default memo(PDFPage, (prevProps, nextProps) => {
    return (
        prevProps.pageNum === nextProps.pageNum &&
        prevProps.renderScale === nextProps.renderScale &&
        prevProps.isVisible === nextProps.isVisible &&
        prevProps.document === nextProps.document &&
        prevProps.engine === nextProps.engine &&
        prevProps.onLinkClick === nextProps.onLinkClick &&
        prevProps.hotspots === nextProps.hotspots &&
        prevProps.onHotspotClick === nextProps.onHotspotClick
    );
});
