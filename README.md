# 📖 FlipBook PDF Viewer

Visor de PDF interactivo con efecto de libro animado, zoom, hotspots personalizables y navegación táctil.
Implementado para el cátalogo de servicios de la Decanatura del Medio Universitario de la Universidad del Rosario.


## ✨ Features

- **Efecto Flipbook**: Animación realista de pasar páginas
- **Responsive**: Adaptado para desktop y móvil (una página en móvil, doble página en desktop)
- **Zoom interactivo**: 7 niveles de zoom con panning
- **Hotspots**: Áreas interactivas configurables que abren modales con contenido
- **Navegación**: Enlaces internos del PDF, controles de navegación y pantalla completa
- **Optimizado**: Renderizado lazy de páginas visibles solamente

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/johnatanguerreroURosario/test-flip.git
cd flipbook2

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El proyecto estará disponible en `http://localhost:5173`

## 📁 Arquitectura

```
src/
├── App.jsx                    # Componente principal
├── FlipBook.jsx              # Lógica principal del flipbook
├── components/
│   ├── FlipBookControls.jsx  # Controles de navegación y zoom
│   ├── Icons.jsx             # Iconos SVG
│   └── PDFPage.jsx           # Renderizado de página individual
├── hooks/
│   └── useFlipBook.js        # Custom hooks (zoom, PDF loader, hotspots, etc.)
├── Modal.jsx                 # Modal para hotspots
├── Hotspot.jsx              # Componente de hotspot individual
└── assets/                   # Recursos estáticos

public/
└── hotspots.json            # Configuración de hotspots
```

### Tecnologías principales

- **React 19** + **Vite** - Framework y build tool
- **react-pageflip** - Efecto de animación de libro
- **@embedpdf/engines** - Renderizado de PDF con PDFium - WebAssembly
- **Custom hooks** - Lógica modular y reutilizable

### Componentes clave

- **FlipBook**: Orquesta toda la funcionalidad del visor
- **PDFPage**: Renderiza cada página del PDF con hotspots y enlaces
- **FlipBookControls**: Barra de controles (navegación, zoom, fullscreen)
- **Modal**: Muestra contenido de hotspots (texto, imágenes, videos)

### Hooks personalizados

- `useZoom`: Gestión de niveles de zoom
- `usePdfLoader`: Carga del documento PDF
- `useHotspots`: Carga de configuración de hotspots
- `useIsMobile`: Detección de dispositivo móvil
- `useResponsiveViewport`: Cálculo de dimensiones responsivas

## 🎨 Configurar Hotspots

Edita `public/hotspots.json`:

```json
{
  "hotspots": [
    {
      "page": 1,
      "x": 50,
      "y": 30,
      "width": 15,
      "height": 10,
      "title": "Título del hotspot",
      "content": "Contenido que aparecerá en el modal",
      "type": "text"
    }
  ]
}
```

- **page**: Número de página (1-indexed)
- **x, y**: Posición en porcentaje (0-100)
- **width, height**: Tamaño en porcentaje
- **type**: `text`, `image`, o `video`

## 🏗️ Build y Despliegue

```bash
# Generar build de producción
npm run build

# Tener en cuenta la configuración de de vite.config.js: Se debe ajustar la base según el dominio de despliegue
// vite.config.js
export default {
  base: 'https://appsweb01.urosario.edu.co/man-files-portal/flipbook/',
};


#Para desplegar como módulo frontend embebido

<link rel="stylesheet" href="ruta/index-xyz.css">
<div id="root"></div>
<script type="module" src="ruta/index-xyz.js"></script>

# En el servidor web, servir los archivos estáticos de la carpeta `dist`

/flipbook
    /assets
        index-xyz.css
        index-xyz.js
        direct-engine-xyz.js
        worker-engine-xyz.js
        pdfium-xyz.wasm
```