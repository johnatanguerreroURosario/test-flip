# Guía de Hotspots

## Cómo funcionan las coordenadas

Los hotspots ahora se escalan automáticamente según el tamaño de visualización de la página PDF. Las coordenadas en el archivo `hotspots.json` deben especificarse en **píxeles relativos al tamaño original del PDF**.

### Sistema de coordenadas

- **x**: Posición horizontal desde la esquina superior izquierda de la página PDF
- **y**: Posición vertical desde la esquina superior izquierda de la página PDF
- **width**: Ancho del área del hotspot
- **height**: Alto del área del hotspot

Todas las medidas están en píxeles basados en el tamaño original del PDF.

### Cómo obtener las coordenadas correctas

1. Abre tu PDF en un visor que muestre coordenadas (como Adobe Acrobat)
2. Identifica la posición del área donde quieres colocar el hotspot
3. Anota las coordenadas x, y y las dimensiones width, height
4. Usa esas coordenadas en el archivo `hotspots.json`

### Ejemplo de hotspot

```json
{
  "id": "hotspot-1",
  "page": 1,
  "position": {
    "x": 200,
    "y": 150,
    "width": 100,
    "height": 100
  },
  "type": "text",
  "title": "Título del Hotspot",
  "content": {
    "text": "Contenido del hotspot"
  },
  "tooltip": "Mensaje del tooltip"
}
```

### Ventajas del sistema actual

✅ Los hotspots mantienen su posición relativa en:
- Vista normal
- Vista fullscreen
- Diferentes tamaños de pantalla
- Zoom aplicado

✅ Las coordenadas se escalan automáticamente según:
- El tamaño original del PDF
- El tamaño renderizado de la página
- El viewport actual

### Notas técnicas

El sistema calcula automáticamente los factores de escala:

```javascript
const scaleX = imgWidth / originalPageWidth;
const scaleY = imgHeight / originalPageHeight;

const scaledX = x * scaleX;
const scaledY = y * scaleY;
const scaledWidth = width * scaleX;
const scaledHeight = height * scaleY;
```

Esto garantiza que los hotspots se posicionen correctamente independientemente del tamaño de visualización.
