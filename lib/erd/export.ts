import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { ERDData } from '@/types/phases';

/**
 * Exports ERD diagram to SVG
 * Note: Mermaid renders to SVG internally, we extract it
 */
export async function exportToSVG(mermaidElementId: string): Promise<string> {
  // Try to find the container with the SVG
  let container = document.getElementById(mermaidElementId) as HTMLElement | null;
  
  // If not found, try to find any container with that ID pattern
  if (!container) {
    container = document.querySelector(`[id*="${mermaidElementId}"]`) as HTMLElement;
  }
  
  if (!container) {
    throw new Error('SVG container not found');
  }

  // Find the SVG element inside the container
  // It might be directly in the container or inside a wrapper div (from dangerouslySetInnerHTML)
  let svgElement = container.querySelector('svg') as SVGElement | null;
  
  // If not found, check inside any child divs (the diagram-wrapper)
  if (!svgElement) {
    const wrapper = container.querySelector('.diagram-wrapper');
    if (wrapper) {
      svgElement = wrapper.querySelector('svg') as SVGElement | null;
    }
  }
  
  if (!svgElement) {
    throw new Error('SVG element not found in container');
  }

  // STEP 1: Inline ALL computed styles into the original SVG BEFORE cloning
  // This ensures all CSS rules (from stylesheets) are converted to explicit attributes
  console.log('[ERD Export] Step 1: Inlining computed styles into original SVG');
  
  const originalTextElements = svgElement.querySelectorAll('text, tspan');
  console.log(`[ERD Export] Found ${originalTextElements.length} text elements in original SVG`);
  
  originalTextElements.forEach((textEl, idx) => {
    // Skip empty text elements
    if (!textEl.textContent || textEl.textContent.trim() === '') {
      return;
    }
    
    // Get ALL computed styles from the element
    const computedStyle = window.getComputedStyle(textEl as Element);
    
    // Log first few for debugging
    if (idx < 3) {
      console.log(`[ERD Export] Original text ${idx} computed styles:`, {
        content: textEl.textContent.substring(0, 20),
        fill: computedStyle.fill,
        color: computedStyle.color,
        fontFamily: computedStyle.fontFamily,
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight,
        opacity: computedStyle.opacity,
        visibility: computedStyle.visibility,
        display: computedStyle.display,
      });
    }
    
    // Helper to check if color is dark (matches background)
    const isDarkColor = (color: string): boolean => {
      if (!color || color === 'none' || color === 'transparent' || color === 'currentColor') {
        return true;
      }
      const colorLower = color.toLowerCase();
      if (colorLower.includes('#0a0e27') || 
          colorLower.includes('#121633') ||
          colorLower.includes('rgb(10, 14, 39)') ||
          colorLower.includes('rgb(18, 22, 51)') ||
          colorLower.includes('rgba(10, 14, 39')) {
        return true;
      }
      return false;
    };
    
    // Get fill color - prioritize computed fill, then color, then attribute
    let fill = computedStyle.fill || computedStyle.color || textEl.getAttribute('fill') || '';
    
    // If fill is dark, transparent, or invalid, force to white
    if (!fill || isDarkColor(fill) || fill === 'none' || fill === 'transparent' || fill === 'currentColor' || fill === 'rgba(0, 0, 0, 0)') {
      fill = '#ffffff';
    }
    
    // Inline ALL relevant CSS properties as explicit SVG attributes
    textEl.setAttribute('fill', fill);
    
    // Font properties
    const fontFamily = computedStyle.fontFamily || textEl.getAttribute('font-family') || 'Arial, sans-serif';
    textEl.setAttribute('font-family', fontFamily);
    
    const fontSize = computedStyle.fontSize || textEl.getAttribute('font-size') || '14px';
    const fontSizeNum = parseFloat(fontSize);
    if (!fontSizeNum || fontSizeNum < 8) {
      textEl.setAttribute('font-size', '14px');
    } else {
      textEl.setAttribute('font-size', fontSize);
    }
    
    const fontWeight = computedStyle.fontWeight || textEl.getAttribute('font-weight') || 'normal';
    textEl.setAttribute('font-weight', fontWeight);
    
    // Opacity
    const opacity = computedStyle.opacity;
    if (opacity && opacity !== '1' && opacity !== '') {
      textEl.setAttribute('opacity', opacity);
    } else if (textEl.getAttribute('opacity') === '0') {
      textEl.removeAttribute('opacity');
    }
    
    // Visibility - remove if hidden
    if (computedStyle.visibility === 'hidden') {
      textEl.removeAttribute('visibility');
    }
    
    // Display - remove if none
    if (computedStyle.display === 'none') {
      textEl.removeAttribute('display');
    }
    
    // Build style attribute with all properties
    let styleParts: string[] = [];
    styleParts.push(`fill: ${fill}`);
    if (fontFamily) styleParts.push(`font-family: ${fontFamily}`);
    if (fontSize && parseFloat(fontSize) >= 8) styleParts.push(`font-size: ${fontSize}`);
    if (fontWeight && fontWeight !== 'normal') styleParts.push(`font-weight: ${fontWeight}`);
    if (opacity && opacity !== '1' && opacity !== '') styleParts.push(`opacity: ${opacity}`);
    
    textEl.setAttribute('style', styleParts.join('; '));
    
    // Also check parent groups and inline their styles if they affect text
    let parent: Element | null = textEl.parentElement;
    while (parent && parent !== svgElement && parent instanceof SVGGElement) {
      const parentComputedStyle = window.getComputedStyle(parent as Element);
      const parentFill = parentComputedStyle.fill || parent.getAttribute('fill');
      
      // If parent has a fill that's not dark, text might inherit it
      if (parentFill && !isDarkColor(parentFill) && parentFill !== 'none' && parentFill !== 'transparent') {
        // Set fill on parent group so text can inherit
        if (!parent.getAttribute('fill')) {
          parent.setAttribute('fill', parentFill);
        }
      }
      
      parent = parent.parentElement;
    }
  });
  
  console.log('[ERD Export] Step 1 complete: All computed styles inlined');
  
  // Now clone the SVG (which now has all styles inlined)
  const clonedSvg = svgElement.cloneNode(true) as SVGElement;
  
  // Remove any transforms that might be applied for zoom/pan
  clonedSvg.removeAttribute('style');
  clonedSvg.removeAttribute('transform');

  // Serialize SVG to string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clonedSvg);
  
  // Parse and reprocess the SVG string to ensure text fill attributes are preserved
  const parser = new DOMParser();
  const reprocessedDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const reprocessedSvg = reprocessedDoc.querySelector('svg');
  
  if (reprocessedSvg) {
    // Ensure SVG has proper dimensions and viewBox
    const width = reprocessedSvg.getAttribute('width');
    const height = reprocessedSvg.getAttribute('height');
    let viewBox = reprocessedSvg.getAttribute('viewBox');
    
    // If no viewBox but we have width/height, create one
    if (!viewBox && width && height) {
      const w = parseFloat(width.toString().replace('px', '').replace('%', ''));
      const h = parseFloat(height.toString().replace('px', '').replace('%', ''));
      if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
        viewBox = `0 0 ${w} ${h}`;
        reprocessedSvg.setAttribute('viewBox', viewBox);
      }
    }
    
    // Remove any transforms on the SVG itself that might affect rendering
    reprocessedSvg.removeAttribute('transform');
    
    // Helper to check if color is dark (matches background)
    const isDarkColor = (color: string): boolean => {
      if (!color || color === 'none' || color === 'transparent' || color === 'currentColor') {
        return true;
      }
      // Check if it's a dark color (like #0a0e27 background)
      const colorLower = color.toLowerCase();
      if (colorLower.includes('#0a0e27') || 
          colorLower.includes('#121633') ||
          colorLower.includes('rgb(10, 14, 39)') ||
          colorLower.includes('rgb(18, 22, 51)') ||
          colorLower.includes('rgba(10, 14, 39')) {
        return true;
      }
      return false;
    };
    
    // Get viewBox bounds to check if text is positioned correctly
    let viewBoxBounds = { x: 0, y: 0, width: 0, height: 0 };
    if (viewBox) {
      const [x, y, w, h] = viewBox.split(' ').map(Number);
      viewBoxBounds = { x, y, width: w, height: h };
    }
    
    // Find all text elements (including those in groups) and ensure they have fill
    const textElements = reprocessedSvg.querySelectorAll('text, tspan');
    console.log(`[ERD Export] Processing ${textElements.length} text elements`);
    
    textElements.forEach((textEl, idx) => {
      // Log first few for debugging
      if (idx < 3) {
        console.log(`[ERD Export] Processing text ${idx}:`, {
          tag: textEl.tagName,
          content: textEl.textContent,
          fill: textEl.getAttribute('fill'),
          style: textEl.getAttribute('style'),
        });
      }
      
      // Skip empty text elements (but log them)
      if (!textEl.textContent || textEl.textContent.trim() === '') {
        if (idx < 3) {
          console.log(`[ERD Export] Skipping empty text element ${idx}`);
        }
        return;
      }
      
      let fill = textEl.getAttribute('fill');
      
      // Check if fill is dark (matches background) - if so, force white
      if (fill && isDarkColor(fill)) {
        fill = '#ffffff';
      }
      
      // Check if parent group has fill
      if (!fill || fill === 'none' || fill === 'transparent' || fill === 'currentColor') {
        let parent: Element | null = textEl.parentElement;
        while (parent && parent !== reprocessedSvg && parent instanceof Element) {
          const parentFill = parent.getAttribute('fill');
          if (parentFill && !isDarkColor(parentFill) && parentFill !== 'none' && parentFill !== 'transparent') {
            fill = parentFill;
            break;
          }
          parent = parent.parentElement;
        }
      }
      
      // If still no fill or invalid or dark, set to white
      if (!fill || isDarkColor(fill) || fill === 'none' || fill === 'transparent' || fill === 'currentColor' || fill === 'rgba(0, 0, 0, 0)') {
        fill = '#ffffff';
      }
      
      // Always set explicit fill attribute
      textEl.setAttribute('fill', fill);
      
      // Remove any stroke that might make text invisible
      if (textEl.getAttribute('stroke') === 'none' || !textEl.getAttribute('stroke')) {
        textEl.removeAttribute('stroke');
      }
      
      // Remove opacity that might make text invisible
      if (textEl.getAttribute('opacity') === '0') {
        textEl.removeAttribute('opacity');
      }
      
      // Check for transforms that might hide text
      const transform = textEl.getAttribute('transform');
      if (transform && (transform.includes('translate(0,0)') || transform.includes('scale(0'))) {
        // Remove problematic transforms
        textEl.removeAttribute('transform');
      }
      
      // Check parent groups for transforms and visibility issues that might hide text
      let parent: Element | null = textEl.parentElement;
      while (parent && parent !== reprocessedSvg && parent instanceof Element) {
        // Check for problematic transforms
        const parentTransform = parent.getAttribute('transform');
        if (parentTransform && (parentTransform.includes('scale(0') || parentTransform.includes('translate(9999'))) {
          // Remove problematic parent transforms
          parent.removeAttribute('transform');
        }
        
        // Check for visibility issues
        if (parent.getAttribute('visibility') === 'hidden') {
          parent.removeAttribute('visibility');
        }
        if (parent.getAttribute('display') === 'none') {
          parent.removeAttribute('display');
        }
        
        parent = parent.parentElement;
      }
      
      // Ensure font size is reasonable
      const fontSize = textEl.getAttribute('font-size') || '14px';
      const fontSizeNum = parseFloat(fontSize);
      if (!fontSizeNum || fontSizeNum < 8) {
        textEl.setAttribute('font-size', '14px');
      }
      
      // Check text positioning - ensure x and y are valid
      const x = textEl.getAttribute('x');
      const y = textEl.getAttribute('y');
      
      // If x or y are missing or invalid, try to get from computed style or set defaults
      if (x === null || x === '' || isNaN(parseFloat(x))) {
        // Don't set x if it's a tspan (it inherits from parent text)
        if (textEl.tagName === 'text') {
          // Try to get from computed style or use 0
          textEl.setAttribute('x', '0');
        }
      }
      if (y === null || y === '' || isNaN(parseFloat(y))) {
        if (textEl.tagName === 'text') {
          textEl.setAttribute('y', '0');
        }
      }
      
      // Ensure style attribute also has fill and no conflicting styles
      let style = textEl.getAttribute('style') || '';
      style = style.replace(/fill:\s*[^;]+;?/gi, '').trim();
      style = style.replace(/stroke:\s*none;?/gi, '').trim();
      style = style.replace(/opacity:\s*0;?/gi, '').trim();
      style = style.replace(/visibility:\s*hidden;?/gi, '').trim();
      style = style.replace(/display:\s*none;?/gi, '').trim();
      textEl.setAttribute('style', style ? `${style}; fill: ${fill};` : `fill: ${fill};`);
      
      // Remove visibility/display attributes that might hide text
      if (textEl.getAttribute('visibility') === 'hidden') {
        textEl.removeAttribute('visibility');
      }
      if (textEl.getAttribute('display') === 'none') {
        textEl.removeAttribute('display');
      }
      
      // Also check for class-based styling
      const classes = textEl.getAttribute('class') || '';
      if (classes.includes('mermaid') || classes.includes('er')) {
        // Keep the class but ensure fill is explicit
      }
    });
    
    // Debug: Log text element count and info
    const finalTextElements = reprocessedSvg.querySelectorAll('text, tspan');
    console.log(`[ERD Export] Found ${finalTextElements.length} text elements in SVG`);
    finalTextElements.forEach((textEl, idx) => {
      if (idx < 5) { // Log first 5 for debugging
        console.log(`[ERD Export] Text ${idx}:`, {
          content: textEl.textContent?.substring(0, 20),
          fill: textEl.getAttribute('fill'),
          x: textEl.getAttribute('x'),
          y: textEl.getAttribute('y'),
          fontSize: textEl.getAttribute('font-size'),
          visibility: textEl.getAttribute('visibility'),
          display: textEl.getAttribute('display'),
        });
      }
    });
    
    // Also check for any groups that might contain text and set fill on them too
    const groups = reprocessedSvg.querySelectorAll('g');
    groups.forEach((group) => {
      const groupText = group.querySelector('text, tspan');
      if (groupText && !group.getAttribute('fill')) {
        // If group contains text but has no fill, set it to white so text can inherit
        group.setAttribute('fill', '#ffffff');
      }
    });
    
    // STEP 2: Add CSS stylesheet as fallback for any remaining class-based styles
    console.log('[ERD Export] Step 2: Adding CSS stylesheet fallback');
    
    // Extract relevant CSS rules from document stylesheets
    let cssRules = '';
    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const sheet = document.styleSheets[i];
          if (sheet.cssRules) {
            for (let j = 0; j < sheet.cssRules.length; j++) {
              const rule = sheet.cssRules[j];
              if (rule instanceof CSSStyleRule) {
                const selector = rule.selectorText;
                // Look for Mermaid-related selectors
                if (selector && (
                  selector.includes('.mermaid') ||
                  selector.includes('.er') ||
                  selector.includes('text') ||
                  selector.includes('tspan')
                )) {
                  // Extract fill, color, font properties
                  const style = rule.style;
                  const fill = style.getPropertyValue('fill');
                  const color = style.getPropertyValue('color');
                  const fontFamily = style.getPropertyValue('font-family');
                  const fontSize = style.getPropertyValue('font-size');
                  const fontWeight = style.getPropertyValue('font-weight');
                  
                  if (fill || color || fontFamily || fontSize || fontWeight) {
                    let ruleText = selector + ' { ';
                    if (fill) ruleText += `fill: ${fill}; `;
                    if (color && !fill) ruleText += `fill: ${color}; `;
                    if (fontFamily) ruleText += `font-family: ${fontFamily}; `;
                    if (fontSize) ruleText += `font-size: ${fontSize}; `;
                    if (fontWeight) ruleText += `font-weight: ${fontWeight}; `;
                    ruleText += '}';
                    cssRules += ruleText + '\n';
                  }
                }
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheet, skip
          console.log('[ERD Export] Skipping cross-origin stylesheet');
        }
      }
    } catch (e) {
      console.log('[ERD Export] Error extracting CSS rules:', e);
    }
    
    // Add a style tag with the extracted CSS rules
    if (cssRules) {
      const styleElement = reprocessedDoc.createElement('style');
      styleElement.setAttribute('type', 'text/css');
      styleElement.textContent = cssRules;
      
      // Insert style tag as first child of SVG
      const firstChild = reprocessedSvg.firstChild;
      if (firstChild) {
        reprocessedSvg.insertBefore(styleElement, firstChild);
      } else {
        reprocessedSvg.appendChild(styleElement);
      }
      
      console.log('[ERD Export] Added CSS stylesheet with', cssRules.split('\n').length, 'rules');
    } else {
      // Add a minimal style tag as fallback
      const styleElement = reprocessedDoc.createElement('style');
      styleElement.setAttribute('type', 'text/css');
      styleElement.textContent = `
        .mermaid text, .mermaid tspan, .er text, .er tspan {
          fill: #ffffff !important;
          font-family: Arial, sans-serif;
          font-size: 14px;
        }
      `;
      const firstChild = reprocessedSvg.firstChild;
      if (firstChild) {
        reprocessedSvg.insertBefore(styleElement, firstChild);
      } else {
        reprocessedSvg.appendChild(styleElement);
      }
      console.log('[ERD Export] Added minimal CSS fallback');
    }
    
    // Re-serialize
    svgString = serializer.serializeToString(reprocessedSvg);
    console.log('[ERD Export] Step 2 complete: CSS stylesheet added');
  }

  // Add XML declaration and namespace if not present
  if (!svgString.includes('<?xml')) {
    svgString = `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`;
  }

  return svgString;
}

/**
 * Exports ERD diagram to PNG
 * Uses html2canvas on the rendered element for better compatibility
 */
export async function exportToPNG(mermaidElementId: string): Promise<Blob> {
  // Find the container element
  let container = document.getElementById(mermaidElementId) as HTMLElement | null;
  
  if (!container) {
    container = document.querySelector(`[id*="${mermaidElementId}"]`) as HTMLElement;
  }
  
  if (!container) {
    throw new Error('Mermaid element not found');
  }

  // Find the actual SVG element to ensure it's visible
  const svgElement = container.querySelector('svg') as SVGElement | null;
  if (!svgElement) {
    throw new Error('SVG element not found');
  }

  // Temporarily remove zoom/pan transforms for export
  const wrapper = container.querySelector('.diagram-wrapper') as HTMLElement | null;
  const originalTransform = wrapper?.style.transform || '';
  const originalOverflow = container.style.overflow || '';
  
  if (wrapper) {
    wrapper.style.transform = 'scale(1) translate(0, 0)';
  }
  container.style.overflow = 'visible';

  try {
    // STEP 3: Ensure all computed styles are inlined before html2canvas processes
    console.log('[ERD Export PNG] Inlining computed styles before capture');
    
    // Inline styles in the SVG before html2canvas processes it
    const svgForCapture = container.querySelector('svg') as SVGElement | null;
    if (svgForCapture) {
      const textElements = svgForCapture.querySelectorAll('text, tspan');
      textElements.forEach((textEl) => {
        if (!textEl.textContent || textEl.textContent.trim() === '') {
          return;
        }
        
        const computedStyle = window.getComputedStyle(textEl as Element);
        
        // Get fill
        let fill = computedStyle.fill || computedStyle.color || textEl.getAttribute('fill') || '#ffffff';
        
        // Check if dark color
        const isDarkColor = (color: string): boolean => {
          if (!color || color === 'none' || color === 'transparent' || color === 'currentColor') {
            return true;
          }
          const colorLower = color.toLowerCase();
          if (colorLower.includes('#0a0e27') || 
              colorLower.includes('#121633') ||
              colorLower.includes('rgb(10, 14, 39)') ||
              colorLower.includes('rgb(18, 22, 51)')) {
            return true;
          }
          return false;
        };
        
        if (isDarkColor(fill) || !fill || fill === 'none' || fill === 'transparent') {
          fill = '#ffffff';
        }
        
        // Inline all styles
        textEl.setAttribute('fill', fill);
        if (!textEl.getAttribute('font-family')) {
          textEl.setAttribute('font-family', computedStyle.fontFamily || 'Arial, sans-serif');
        }
        if (!textEl.getAttribute('font-size')) {
          const fontSize = computedStyle.fontSize || '14px';
          const fontSizeNum = parseFloat(fontSize);
          textEl.setAttribute('font-size', fontSizeNum >= 8 ? fontSize : '14px');
        }
        
        // Build style attribute
        const styleParts = [
          `fill: ${fill}`,
          `font-family: ${computedStyle.fontFamily || 'Arial, sans-serif'}`,
          `font-size: ${computedStyle.fontSize || '14px'}`,
        ];
        textEl.setAttribute('style', styleParts.join('; '));
      });
    }
    
    // Use html2canvas to capture the container with higher scale for better text rendering
    const canvas = await html2canvas(container, {
      backgroundColor: '#0a0e27',
      scale: 3, // Increased from 2 to 3 for better text rendering
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: container.scrollWidth || container.offsetWidth,
      height: container.scrollHeight || container.offsetHeight,
      onclone: (clonedDoc) => {
        // Ensure all text has explicit styles in the cloned document
        const clonedSvg = clonedDoc.querySelector(`#${mermaidElementId} svg`) || 
                          clonedDoc.querySelector(`[id*="${mermaidElementId}"] svg`);
        
        if (clonedSvg && svgElement) {
          const clonedTextElements = clonedSvg.querySelectorAll('text, tspan');
          const originalTextElements = svgElement.querySelectorAll('text, tspan');
          
          // Match cloned elements with originals by index
          clonedTextElements.forEach((clonedTextEl, index) => {
            if (!clonedTextEl.textContent || clonedTextEl.textContent.trim() === '') {
              return;
            }
            
            const originalTextEl = originalTextElements[index];
            let fill = '#ffffff';
            
            if (originalTextEl) {
              const computedStyle = window.getComputedStyle(originalTextEl as Element);
              fill = computedStyle.fill || computedStyle.color || '#ffffff';
              
              // Check if dark
              const isDarkColor = fill.includes('#0a0e27') || fill.includes('#121633') || 
                                  fill === 'none' || fill === 'transparent' || fill === 'currentColor';
              if (isDarkColor) {
                fill = '#ffffff';
              }
            }
            
            // Set explicit attributes
            (clonedTextEl as SVGTextElement).setAttribute('fill', fill);
            (clonedTextEl as SVGTextElement).setAttribute('style', `fill: ${fill};`);
            
            // Also set font properties
            if (originalTextEl) {
              const computedStyle = window.getComputedStyle(originalTextEl as Element);
              (clonedTextEl as SVGTextElement).setAttribute('font-family', computedStyle.fontFamily || 'Arial, sans-serif');
              (clonedTextEl as SVGTextElement).setAttribute('font-size', computedStyle.fontSize || '14px');
            }
          });
        }
      },
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          // Restore original styles
          if (wrapper) {
            wrapper.style.transform = originalTransform;
          }
          container.style.overflow = originalOverflow;
          
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create PNG blob'));
          }
        },
        'image/png',
        1.0
      );
    });
  } catch (error) {
    // Restore original styles on error
    if (wrapper) {
      wrapper.style.transform = originalTransform;
    }
    container.style.overflow = originalOverflow;
    throw error;
  }
}

/**
 * Exports ERD diagram to PDF
 */
export async function exportToPDF(
  mermaidElementId: string,
  filename: string = 'erd-diagram.pdf'
): Promise<void> {
  const element = document.getElementById(mermaidElementId);
  if (!element) {
    throw new Error('Mermaid element not found');
  }

  // First, get PNG blob
  const pngBlob = await exportToPNG(mermaidElementId);
  const pngUrl = URL.createObjectURL(pngBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [img.width, img.height],
      });

      pdf.addImage(pngUrl, 'PNG', 0, 0, img.width, img.height);
      pdf.save(filename);
      URL.revokeObjectURL(pngUrl);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(pngUrl);
      reject(new Error('Failed to load image for PDF export'));
    };
    img.src = pngUrl;
  });
}

/**
 * Exports ERD data to JSON file
 */
export function exportToJSON(erd: ERDData, filename: string = 'erd-data.json'): void {
  const jsonString = JSON.stringify(erd, null, 2);
  downloadString(jsonString, filename, 'application/json');
}

/**
 * Downloads a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a string as a file
 */
export function downloadString(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

