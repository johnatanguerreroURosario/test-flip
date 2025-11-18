import { useState } from 'react';
import './Hotspot.css';

export default function Hotspot({ hotspot, onClick, imgWidth, imgHeight, originalPageWidth, originalPageHeight }) {
    const [showTooltip, setShowTooltip] = useState(false);

    if (!hotspot || !hotspot.position) return null;

    // Validar dimensiones
    if (!imgWidth || !imgHeight || imgWidth === 0 || imgHeight === 0) {
        return null;
    }

    if (!originalPageWidth || !originalPageHeight || originalPageWidth === 0 || originalPageHeight === 0) {
        return null;
    }

    // Calcular factor de escala entre el tamaño original del PDF y el tamaño renderizado
    const scaleX = imgWidth / originalPageWidth;
    const scaleY = imgHeight / originalPageHeight;

    // Aplicar escala a las posiciones del hotspot
    const { x, y, width, height } = hotspot.position;
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;
    const scaledWidth = width * scaleX;
    const scaledHeight = height * scaleY;

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        onClick(hotspot);
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
    };

    const handleMouseUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
    };

    const handleMouseMove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
    };

    const handlePointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
    };

    const handlePointerUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
    };

    return (
        <div
            className="hotspot-wrapper"
            style={{
                position: 'absolute',
                left: `${scaledX}px`,
                top: `${scaledY}px`,
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
                pointerEvents: 'auto',
                zIndex: 200,
            }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onMouseMove={handleMouseMove}
        >
            <div
                className="hotspot"
                onClick={handleClick}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                style={{
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                    touchAction: 'none',
                }}
            >
                {/* Punto pulsante en el centro del hotspot */}
                <div className="hotspot-pulse">
                    {/* Tooltip */}
                    {showTooltip && hotspot.tooltip && (
                        <div className="hotspot-tooltip">
                            {hotspot.tooltip}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
