/**
 * Document Watermarking Service
 * Adds visitor email watermark to documents for tracking and security
 */

export interface WatermarkOptions {
  text: string; // Usually visitor email
  opacity?: number; // 0-1, default 0.3
  fontSize?: number; // default 12
  color?: string; // default #888888
  rotation?: number; // degrees, default -45
  position?: 'diagonal' | 'footer' | 'header' | 'tiled';
}

/**
 * Generate CSS for watermark overlay
 * This is used for client-side watermarking in the document viewer
 */
export function generateWatermarkCSS(options: WatermarkOptions): string {
  const {
    text,
    opacity = 0.3,
    fontSize = 14,
    color = '#888888',
    rotation = -45,
    position = 'diagonal',
  } = options;

  if (position === 'tiled') {
    return `
      .watermark-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 1000;
        overflow: hidden;
      }
      .watermark-overlay::before {
        content: '${text.replace(/'/g, "\\'")}';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(${rotation}deg);
        font-size: ${fontSize * 3}px;
        color: ${color};
        opacity: ${opacity};
        white-space: nowrap;
        pointer-events: none;
        font-family: Arial, sans-serif;
      }
      .watermark-tiled {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: repeating-linear-gradient(
          ${rotation}deg,
          transparent,
          transparent 100px,
          rgba(0,0,0,0.02) 100px,
          rgba(0,0,0,0.02) 200px
        );
        pointer-events: none;
      }
      .watermark-text {
        position: absolute;
        font-size: ${fontSize}px;
        color: ${color};
        opacity: ${opacity};
        transform: rotate(${rotation}deg);
        white-space: nowrap;
        pointer-events: none;
        font-family: Arial, sans-serif;
      }
    `;
  }

  if (position === 'footer') {
    return `
      .watermark-overlay {
        position: fixed;
        bottom: 10px;
        left: 0;
        right: 0;
        text-align: center;
        pointer-events: none;
        z-index: 1000;
      }
      .watermark-text {
        font-size: ${fontSize}px;
        color: ${color};
        opacity: ${opacity};
        font-family: Arial, sans-serif;
      }
    `;
  }

  if (position === 'header') {
    return `
      .watermark-overlay {
        position: fixed;
        top: 10px;
        left: 0;
        right: 0;
        text-align: center;
        pointer-events: none;
        z-index: 1000;
      }
      .watermark-text {
        font-size: ${fontSize}px;
        color: ${color};
        opacity: ${opacity};
        font-family: Arial, sans-serif;
      }
    `;
  }

  // Default: diagonal
  return `
    .watermark-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .watermark-text {
      font-size: ${fontSize * 2}px;
      color: ${color};
      opacity: ${opacity};
      transform: rotate(${rotation}deg);
      white-space: nowrap;
      pointer-events: none;
      font-family: Arial, sans-serif;
      user-select: none;
    }
  `;
}

/**
 * Generate watermark data for client-side rendering
 */
export function generateWatermarkData(options: WatermarkOptions) {
  const {
    text,
    opacity = 0.3,
    fontSize = 14,
    color = '#888888',
    rotation = -45,
    position = 'diagonal',
  } = options;

  return {
    text,
    opacity,
    fontSize,
    color,
    rotation,
    position,
    css: generateWatermarkCSS(options),
    // Generate tiled positions for comprehensive coverage
    tiledPositions: position === 'tiled' ? generateTiledPositions() : null,
  };
}

/**
 * Generate positions for tiled watermark pattern
 */
function generateTiledPositions(): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const spacing = 200; // pixels between watermarks
  
  for (let y = 0; y < 2000; y += spacing) {
    for (let x = 0; x < 2000; x += spacing) {
      // Offset every other row for better coverage
      const offsetX = (y / spacing) % 2 === 0 ? 0 : spacing / 2;
      positions.push({ x: x + offsetX, y });
    }
  }
  
  return positions;
}

/**
 * Generate watermark text from visitor info
 */
export function generateWatermarkText(
  visitorEmail: string,
  customText?: string,
  includeTimestamp?: boolean
): string {
  let text = customText || visitorEmail;
  
  if (includeTimestamp) {
    const timestamp = new Date().toISOString().split('T')[0];
    text = `${text} | ${timestamp}`;
  }
  
  return text;
}

/**
 * Check if watermarking should be applied based on room settings
 */
export function shouldApplyWatermark(room: {
  watermarkEnabled: boolean;
  watermarkText?: string | null;
}): boolean {
  return room.watermarkEnabled;
}
