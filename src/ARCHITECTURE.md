# FlipBook - Estructura del Código

## 📁 Estructura de Archivos

```
src/
├── FlipBook.jsx              # Componente principal
├── FlipBook.css              # Estilos del FlipBook
├── components/
│   ├── Icons.jsx            # Iconos SVG reutilizables
│   ├── FlipBookControls.jsx # Controles de navegación y zoom
│   └── PDFPage.jsx          # Componente de página PDF con enlaces y hotspots
└── hooks/
    └── useFlipBook.js       # Hooks personalizados para lógica compartida
```

## 🧩 Componentes

### FlipBook.jsx (Principal)
Componente principal que orquesta todos los demás componentes y hooks.

**Props:**
- `src`: Ruta del PDF
- `width`: Ancho base
- `height`: Alto base
- `responsive`: Activar modo responsive
- `zoomDuration`: Duración de animación de zoom
- `zooms`: Array de niveles de zoom

### FlipBookControls.jsx
Controles de navegación (prev/next) y zoom (in/out/reset).

**Props:**
- `currentPage`, `totalPages`: Estado de paginación
- `zoom`, `zooming`, `zoomIndex`: Estado de zoom
- `rendering`: Indicador de renderizado
- `onPrevPage`, `onNextPage`: Handlers de navegación
- `onZoomIn`, `onZoomOut`, `onResetZoom`: Handlers de zoom

### PDFPage.jsx
Renderiza una página PDF individual con enlaces y hotspots.

**Props:**
- `engine`, `document`: Motor y documento PDF
- `pageNum`: Número de página
- `renderScale`: Escala de renderizado
- `isVisible`: Si la página está visible
- `onLinkClick`, `onHotspotClick`: Handlers de interacción

**Subcomponentes internos:**
- `PageLinks`: Renderiza enlaces PDF clicables
- `PageHotspots`: Renderiza hotspots interactivos

### Icons.jsx
Iconos SVG para la interfaz.

**Iconos disponibles:**
- `ChevronLeft`, `ChevronRight`: Navegación
- `Plus`, `Minus`: Zoom
- `RefreshCw`: Reset

## 🪝 Hooks Personalizados

### useZoom
Maneja la lógica de zoom con animación suave.

**Retorna:**
- `zoom`: Nivel de zoom actual
- `zoomIn`, `zoomOut`, `resetZoom`: Funciones de control
- `zooming`: Estado de animación

### usePdfLoader
Carga y gestiona el documento PDF.

**Retorna:**
- `pdfDocument`: Documento cargado
- `loading`, `error`: Estados de carga

### useIsMobile
Detecta si el dispositivo es móvil (< 768px).

**Retorna:** `boolean`

### useHotspots
Carga hotspots desde JSON.

**Retorna:** Array de hotspots

### useResponsiveViewport
Calcula dimensiones responsive del viewport.

**Retorna:** `{ w, h }` - Dimensiones calculadas

## 🎨 Estilos CSS

### Clases principales:
- `.flipbook-container`: Contenedor principal
- `.flipbook-controls`: Barra de controles
- `.flipbook-viewport`: Área visible del libro
- `.flipbook-wrapper`: Envoltorio con transformaciones
- `.page`: Página individual
- `.pdf-page-container`: Contenedor de página PDF
- `.pdf-link`: Enlaces clicables
- `.pdf-hotspot-layer`: Capa de hotspots

### Responsive:
- `@media (max-width: 768px)`: Tablets y móviles
- `@media (max-width: 480px)`: Móviles pequeños
- `@media (orientation: landscape)`: Modo horizontal

## 🔄 Flujo de Datos

```
FlipBook (Principal)
    ├─> useZoom → Controla zoom animado
    ├─> usePdfLoader → Carga documento
    ├─> useIsMobile → Detecta dispositivo
    ├─> useHotspots → Carga datos interactivos
    ├─> useResponsiveViewport → Calcula dimensiones
    │
    ├─> FlipBookControls → UI de controles
    │
    └─> HTMLFlipBook (react-pageflip)
         └─> PDFPage (para cada página)
              ├─> PageLinks → Enlaces PDF
              └─> PageHotspots → Hotspots personalizados
```

## 🚀 Mejoras Implementadas

1. **Separación de responsabilidades**: Cada componente tiene una única función
2. **Hooks reutilizables**: Lógica extraída y compartible
3. **Menos código duplicado**: Eliminado código innecesario
4. **Mejor legibilidad**: Nombres claros y estructura organizada
5. **Estilos en CSS**: Movidos estilos inline al CSS
6. **Fácil mantenimiento**: Cambios aislados por archivo
7. **Mejor rendimiento**: Memoización optimizada

## 🛠️ Mantenimiento

### Para agregar nuevas características:

1. **Nuevo control UI**: Edita `FlipBookControls.jsx`
2. **Nueva funcionalidad de página**: Edita `PDFPage.jsx`
3. **Nueva lógica compartida**: Crea hook en `useFlipBook.js`
4. **Nuevo icono**: Añade a `Icons.jsx`
5. **Nuevos estilos**: Añade a `FlipBook.css`

### Backup:
El archivo original está guardado como `FlipBook.jsx.backup`
