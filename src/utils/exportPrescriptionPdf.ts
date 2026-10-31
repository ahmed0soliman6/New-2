import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { generatePrescriptionHtml, PrintPrescriptionData } from './printPrescription';

export async function exportPrescriptionToPdf(
  target: string | PrintPrescriptionData,
  patientName: string = 'مريض'
) {
  // If structured data is passed, render directly from the verified print prescription HTML engine
  if (typeof target === 'object' && target !== null && 'config' in target) {
    let sandbox: HTMLDivElement | null = null;
    try {
      const html = await generatePrescriptionHtml(target);
      sandbox = document.createElement('div');
      sandbox.id = 'pdf-render-sandbox';
      sandbox.style.position = 'fixed';
      sandbox.style.top = '0';
      sandbox.style.left = '-9999px';
      sandbox.style.width = '148mm';
      sandbox.style.minHeight = '210mm';
      sandbox.style.backgroundColor = '#ffffff';
      sandbox.style.zIndex = '-9999';
      sandbox.style.overflow = 'hidden';
      sandbox.innerHTML = html;
      document.body.appendChild(sandbox);

      // Preload images and enforce strictly bounded logo dimensions
      const images = Array.from(sandbox.querySelectorAll('img'));
      await Promise.all(
        images.map((img) => {
          img.style.width = '44px';
          img.style.height = '44px';
          img.style.maxWidth = '44px';
          img.style.maxHeight = '44px';
          img.style.objectFit = 'contain';
          img.setAttribute('width', '44');
          img.setAttribute('height', '44');
          if (img.complete) return Promise.resolve(true);
          return new Promise((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(true);
          });
        })
      );

      // Give browser small microtask to calculate fonts and layouts
      await new Promise((r) => setTimeout(r, 60));

      const a5Element = (sandbox.querySelector('.a5-container') as HTMLElement) || sandbox;
      const canvas = await html2canvas(a5Element, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123,
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        unit: 'mm',
        format: 'a5',
        orientation: 'portrait',
      });

      // A5 dimensions in mm: 148 x 210
      pdf.addImage(imgData, 'PNG', 0, 0, 148, 210, undefined, 'FAST');
      pdf.save(`روشتة_${patientName || 'مريض'}.pdf`);
      return;
    } catch (error) {
      console.error('Failed to export prescription PDF via HTML engine, fallback to DOM element:', error);
    } finally {
      if (sandbox && sandbox.parentElement) {
        sandbox.parentElement.removeChild(sandbox);
      }
    }
  }

  // Fallback: Export from DOM element ID
  const elementId = typeof target === 'string' ? target : 'printable-prescription-pad';
  const element =
    document.getElementById('examination-prescription-preview-sheet') ||
    document.getElementById(elementId) ||
    document.getElementById('printable-prescription-pad');

  if (!element) {
    window.print();
    return;
  }

  // Check if element is hidden
  const isHidden = window.getComputedStyle(element).display === 'none' || element.offsetParent === null;
  const parent = element.parentElement;
  let originalParentStyle = '';

  try {
    if (isHidden && parent) {
      originalParentStyle = parent.getAttribute('style') || '';
      parent.setAttribute(
        'style',
        `${originalParentStyle}; display: block !important; position: fixed !important; left: -9999px !important; top: 0 !important; visibility: visible !important; opacity: 1 !important; z-index: -9999 !important;`
      );
    }

    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
        // Enforce strict logo and image bounds in cloned DOM so they never explode
        const clonedImgs = clonedDoc.querySelectorAll('img');
        clonedImgs.forEach((img) => {
          img.style.width = '44px';
          img.style.height = '44px';
          img.style.maxWidth = '44px';
          img.style.maxHeight = '44px';
          img.style.objectFit = 'contain';
          img.setAttribute('width', '44');
          img.setAttribute('height', '44');
        });
      },
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a5',
      orientation: 'portrait',
    });

    // A5 dimensions in mm: 148 x 210
    pdf.addImage(imgData, 'PNG', 0, 0, 148, 210, undefined, 'FAST');
    pdf.save(`روشتة_${patientName || 'مريض'}.pdf`);
  } catch (error) {
    console.error('Failed to export prescription PDF, fallback to window.print():', error);
    window.print();
  } finally {
    if (isHidden && parent) {
      if (originalParentStyle) {
        parent.setAttribute('style', originalParentStyle);
      } else {
        parent.removeAttribute('style');
      }
    }
  }
}

