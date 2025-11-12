import { usePdfiumEngine } from "@embedpdf/engines/react";
import { useEffect, useState, useRef } from "react";

export const PDFProcessor = () => {
  const { engine, isLoading, error } = usePdfiumEngine();
  const [isReady, setIsReady] = useState(false);
  const [document, setDocument] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1.5);
  const canvasRef = useRef(null);

  useEffect(() => {
    // The engine object from the hook needs to be initialized once.
    if (engine && !isReady) {
      engine
        .initialize()
        .toPromise()
        .then(() => setIsReady(true));
    }
  }, [engine, isReady]);

  useEffect(() => {
    if (!engine || !isReady) return;

    const renderFirstPage = async (doc, scale = zoomLevel) => {
      try {
        const firstPage = doc.pages[0];

        const imageBlob = await engine
          .renderPage(doc, firstPage, {
            scaleFactor: scale,
            withAnnotations: true,
          })
          .toPromise();

        // In a browser, you can create a URL to display the image
        const imageUrl = URL.createObjectURL(imageBlob);

        if (canvasRef.current) {
          canvasRef.current.src = imageUrl;
        }
      } catch (err) {
        console.error("Failed to render page:", err);
      }
    };

    const loadDocument = async () => {
      try {
        let src = '/src/assets/link.pdf'; // Ruta del PDF a cargar
 let pdfUrl = src;
            if (!src.startsWith('http')) {
                // Para rutas locales, usar la URL base actual
                const baseUrl = window.location.origin;
                // Limpiar la ruta (eliminar /src/ si existe)
                const cleanPath = src.replace(/^\/src\/assets\//, '/');
                pdfUrl = `${baseUrl}${cleanPath}`;
            }

        const fileUrl = {
          id: "my-doc",
          url: pdfUrl,
        };

        const doc = await engine.openDocumentUrl(fileUrl).toPromise();

        console.log(
          `Successfully opened document with ${doc.pageCount} pages.`
        );

        setDocument(doc);
        setPageCount(doc.pageCount);

        // Renderizar la primera página
        if (doc.pages && doc.pages[0]) {
          renderFirstPage(doc);
        }
      } catch (err) {
        console.error("Failed to open document:", err);
      }
    };

    loadDocument();
  }, [engine, isReady, zoomLevel]);

  if (error) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        Error: {error.message}
      </div>
    );
  }

  if (isLoading || !isReady) {
    return <div style={{ padding: "20px" }}>Initializing PDF Engine...</div>;
  }

  if (!document) {
    return <div style={{ padding: "20px" }}>Loading PDF...</div>;
  }

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1.5);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>PDF Engine is ready to use!</h2>
      <p>Document has {pageCount} pages</p>
      
      {/* Zoom Controls */}
      <div style={{ 
        marginTop: "10px", 
        marginBottom: "20px",
        display: "flex",
        gap: "10px",
        alignItems: "center"
      }}>
        <button 
          onClick={handleZoomOut}
          disabled={zoomLevel <= 0.5}
          style={{
            padding: "8px 16px",
            backgroundColor: zoomLevel <= 0.5 ? "#ccc" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: zoomLevel <= 0.5 ? "not-allowed" : "pointer",
            fontSize: "16px",
            fontWeight: "bold"
          }}
        >
          🔍−
        </button>
        
        <span style={{ 
          minWidth: "80px", 
          textAlign: "center",
          fontWeight: "500"
        }}>
          {Math.round(zoomLevel * 100)}%
        </span>
        
        <button 
          onClick={handleZoomIn}
          disabled={zoomLevel >= 3.0}
          style={{
            padding: "8px 16px",
            backgroundColor: zoomLevel >= 3.0 ? "#ccc" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: zoomLevel >= 3.0 ? "not-allowed" : "pointer",
            fontSize: "16px",
            fontWeight: "bold"
          }}
        >
          🔍+
        </button>
        
        <button 
          onClick={handleResetZoom}
          style={{
            padding: "8px 16px",
            backgroundColor: "#64748b",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500"
          }}
        >
          Reset
        </button>
      </div>

      <div
        style={{
          marginTop: "20px",
          border: "1px solid #ccc",
          display: "inline-block",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
        }}
      >
        <img
          ref={canvasRef}
          alt="PDF Page"
          style={{ maxWidth: "100%", height: "auto", display: "block" }}
        />
      </div>
    </div>
  );
};
