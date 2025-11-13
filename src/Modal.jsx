import { useEffect } from 'react';
import './Modal.css';

export default function Modal({ isOpen, onClose, title, content, type = 'text' }) {
    // Cerrar con tecla Escape
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevenir scroll del body cuando el modal está abierto
            document.body.style.overflow = 'hidden';
        }
        
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Renderizar contenido según el tipo
    const renderContent = () => {
        if (!content) return null;

        switch (type) {
            case 'image':
                return (
                    <div className="modal-content-wrapper">
                        {content.text && <p className="modal-text">{content.text}</p>}
                        {content.imageUrl && (
                            <div className="modal-image-container">
                                <img 
                                    src={content.imageUrl} 
                                    alt={title || 'Imagen del modal'} 
                                    className="modal-image"
                                />
                            </div>
                        )}
                    </div>
                );
            
            case 'video':
                return (
                    <div className="modal-content-wrapper">
                        {content.text && <p className="modal-text">{content.text}</p>}
                        {content.videoUrl && (
                            <div className="modal-video-container">
                                <iframe
                                    src={content.videoUrl}
                                    title={title || 'Video'}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="modal-video"
                                />
                            </div>
                        )}
                    </div>
                );
            
            case 'text':
            default:
                return (
                    <div className="modal-content-wrapper">
                        {content.text && <p className="modal-text">{content.text}</p>}
                    </div>
                );
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{title || 'Información'}</h2>
                    <button 
                        className="modal-close-btn" 
                        onClick={onClose}
                        aria-label="Cerrar modal"
                        title="Cerrar (Esc)"
                    >
                        <svg 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div className="modal-body">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
