/**
 * printPrescription.ts
 * Dedicated, robust print engine for A5 Prescriptions.
 * Solves iframe sandboxing, modal overlays, CSS print-media conflicts,
 * and cross-browser preview/printing issues by rendering a clean,
 * isolated printable A5 document in an invisible iframe.
 */

import QRCode from 'qrcode';
import { toEnglishDigits } from './numberUtils';
import { formatQrDestination } from '../components/QrCodeImage';

export interface PrintPrescriptionData {
  config: {
    doctorName?: string;
    doctorNameEn?: string;
    specialtyAr?: string;
    specialtyEn?: string;
    degreesAr?: string;
    degreesEn?: string;
    phone?: string;
    logoUrl?: string | null;
    showLogo?: boolean;
    showHeader?: boolean;
    showFooter?: boolean;
    preprintedPaperMode?: boolean;
    showQr?: boolean;
    qrType?: string;
    qrWhatsappPhone?: string;
    qrCustomUrl?: string;
    qrSize?: string;
    footerFontSize?: string;
    outerMargin?: string;
    headerMarginTop?: string;
    footerMarginBottom?: string;
    sectionSpacing?: string;
    branches?: Array<{
      id?: string;
      name: string;
      address?: string;
      phone: string;
      workingHours?: string;
    }>;
  };
  patient?: {
    name?: string;
    age?: number | string;
    phone?: string;
    fileNumber?: number | string;
    date?: string;
  } | null;
  items?: Array<{
    id?: string;
    drugName: string;
    scientificName?: string;
    dosage?: string;
    dosageInstructions?: string;
    timing?: string;
    duration?: string;
    dosageForm?: string;
    strength?: string;
    notes?: string;
  }>;
  diagnoses?: Array<{
    id?: string;
    code?: string;
    nameAr?: string;
    nameEn?: string;
    isPrimary?: boolean;
  }>;
  lifestyleAdvice?: string;
  followupDate?: string;
}

export interface PrintVisitReportData {
  config?: {
    doctorName?: string;
    doctorNameEn?: string;
    specialtyAr?: string;
    specialtyEn?: string;
    degreesAr?: string;
    degreesEn?: string;
    phone?: string;
    logoUrl?: string | null;
    branches?: Array<{
      name: string;
      phone: string;
      address?: string;
    }>;
  };
  patient: {
    fullName: string;
    fileNumber?: number | string;
    age?: number | string;
    gender?: string;
    phone?: string;
  };
  visit: {
    visitId: string;
    visitType?: string;
    createdAt?: string;
    vitalSigns?: {
      bloodPressure?: string;
      pulse?: number | string;
      temperature?: number | string;
      randomBloodSugar?: number | string;
      oxygenSaturation?: number | string;
      weight?: number | string;
      height?: number | string;
      bmi?: number | string;
    };
    clinicalData?: {
      chiefComplaint?: string;
      diagnosis?: string[];
      treatment?: string;
      notes?: string;
    };
    receptionistData?: {
      symptoms?: string;
      chronicDiseases?: string[];
    };
  };
  medications?: Array<{
    name: string;
    strength?: string;
    dose?: string;
    duration?: string;
    instructions?: string;
  }>;
  labOrders?: Array<{
    testName: string;
    status?: string;
  }>;
  radiologyOrders?: Array<{
    radiologyName: string;
    status?: string;
  }>;
  followUp?: {
    scheduledDate?: string;
    notes?: string;
  };
}

const MARGIN_MAP: Record<string, string> = {
  very_tight: '2mm',
  tight: '4mm',
  normal: '7mm',
  wide: '10mm',
  very_wide: '14mm',
  balanced: '7mm',
};

export async function generatePrescriptionHtml(data: PrintPrescriptionData): Promise<string> {
  const { config, patient, items = [], diagnoses = [], lifestyleAdvice, followupDate } = data;

  let qrSvgHtml = '';
  if (config.showQr) {
    try {
      const destination = formatQrDestination(
        config.qrType || 'whatsapp',
        config.qrWhatsappPhone,
        config.qrCustomUrl
      );

      qrSvgHtml = await QRCode.toString(destination.link, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('QR code generation failed:', err);
    }
  }

  const outerMargin = MARGIN_MAP[config.outerMargin || 'normal'] || '7mm';
  const headerMargin = config.preprintedPaperMode
    ? '25mm'
    : MARGIN_MAP[config.headerMarginTop || 'balanced'] || '7mm';
  const footerMargin = config.preprintedPaperMode
    ? '20mm'
    : MARGIN_MAP[config.footerMarginBottom || 'balanced'] || '7mm';

  const spacingClass =
    config.sectionSpacing === 'compact'
      ? '8px'
      : config.sectionSpacing === 'comfortable'
      ? '18px'
      : '12px';

  const footerSize =
    config.footerFontSize === 'small'
      ? '9px'
      : config.footerFontSize === 'large'
      ? '12px'
      : '10.5px';

  // Dynamic scaling parameters based on items count to fit A5 page perfectly
  const itemsCount = items.length;
  let itemPadding = '6px 10px';
  let itemMarginBottom = '6px';
  let drugFontSize = '13px';
  let instructionFontSize = '11.5px';
  let noteFontSize = '10px';
  let containerGap = spacingClass;

  let diagPadding = '6px 10px';
  let diagFontSize = '11.5px';

  let advicePadding = '6px 10px';
  let adviceFontSize = '11px';

  let followupPadding = '6px 10px';
  let followupFontSize = '11px';

  if (itemsCount >= 6) {
    itemPadding = '3px 6px';
    itemMarginBottom = '3px';
    drugFontSize = '10.5px';
    instructionFontSize = '9.5px';
    noteFontSize = '8.5px';
    containerGap = '4px';

    diagPadding = '3px 6px';
    diagFontSize = '10px';

    advicePadding = '3px 6px';
    adviceFontSize = '9.5px';

    followupPadding = '3px 6px';
    followupFontSize = '9.5px';
  } else if (itemsCount >= 4) {
    itemPadding = '4px 8px';
    itemMarginBottom = '4px';
    drugFontSize = '11.5px';
    instructionFontSize = '10.5px';
    noteFontSize = '9px';
    containerGap = '6px';

    diagPadding = '4px 8px';
    diagFontSize = '10.5px';

    advicePadding = '4px 8px';
    adviceFontSize = '10px';

    followupPadding = '4px 8px';
    followupFontSize = '10px';
  }

  // Build items HTML
  const itemsHtml = items.length > 0
    ? items.map((it, idx) => `
        <div style="padding: ${itemPadding}; margin-bottom: ${itemMarginBottom}; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #f8fafc; text-align: left; direction: ltr;">
          <div style="font-size: ${drugFontSize}; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
            ${idx + 1}. ${it.drugName || ''} ${it.strength || ''} ${it.dosageForm || ''} ${it.scientificName ? `<span style="font-size: calc(${drugFontSize} - 1.5px); font-weight: normal; color: #475569;">(${it.scientificName})</span>` : ''}
          </div>
          <div style="font-size: ${instructionFontSize}; color: #0f766e; font-weight: 600;">
            ${it.dosageInstructions || it.dosage || ''} ${it.timing ? `&bull; ${it.timing}` : ''} ${it.duration ? `&bull; لمدة ${it.duration}` : ''}
          </div>
          ${it.notes ? `<div style="font-size: ${noteFontSize}; color: #64748b; font-style: italic; margin-top: 2px;">توجيهات: ${it.notes}</div>` : ''}
        </div>
      `).join('')
    : `<div style="text-align: center; padding: 25px 0; color: #94a3b8; font-size: 12px;">لا توجد أدوية مضافة للروشتة حالياً.</div>`;

  // Build diagnoses HTML - strictly LTR and in English as requested
  const diagnosesHtml = diagnoses.length > 0
    ? `
      <div style="padding: ${diagPadding}; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #f8fafc; font-size: ${diagFontSize}; text-align: left; direction: ltr; color: #1e293b;">
        <strong style="color: #008f97;">Diagnosis:</strong> ${diagnoses.map(d => d.nameEn || d.nameAr || d.code).join(', ')}
      </div>
    `
    : '';

  // Advice HTML
  const adviceHtml = lifestyleAdvice
    ? `
      <div style="padding: ${advicePadding}; border: 1px solid #ccfbf1; border-radius: 6px; background-color: #f0fdfa; font-size: ${adviceFontSize}; text-align: right; color: #134e4a;">
        <strong style="color: #0f766e;">تعليمات طبية:</strong> ${lifestyleAdvice}
      </div>
    `
    : '';

  // Follow-up HTML
  const followupHtml = followupDate
    ? `
      <div style="padding: ${followupPadding}; border: 1px solid #fef3c7; border-radius: 6px; background-color: #fffbeb; font-size: ${followupFontSize}; text-align: right; color: #78350f; font-weight: 600;">
        موعد الاستشارة القادمة: ${followupDate}
      </div>
    `
    : '';

  // Branches HTML
  const branchesHtml = (config.branches || [])
    .map(b => `
      <div style="margin-bottom: 3px; font-size: ${footerSize}; line-height: 1.4; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px;">
        <strong style="color: #0f172a; white-space: nowrap;">${b.name}:</strong>
        ${b.address ? `<span style="color: #334155;">${b.address}</span>` : ''}
        ${b.phone ? `<span style="font-family: monospace; font-weight: 700; color: #0d9488; direction: ltr; white-space: nowrap; margin: 0 2px;">${toEnglishDigits(b.phone)}</span>` : ''}
        ${b.workingHours ? `<span style="color: #475569; display: inline-flex; align-items: center; gap: 3px;">• <strong style="color: #0f766e;">مواعيد العمل:</strong> ${toEnglishDigits(b.workingHours)}</span>` : ''}
      </div>
    `)
    .join('');

  // Complete HTML document optimized for standard A5 printing
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>روشتة_${patient?.name || 'مريض'}</title>
      <style>
        @page {
          size: A5 portrait;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #0f172a;
          font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          width: 148mm;
          height: 210mm;
          min-height: 210mm;
          max-height: 210mm;
          overflow: hidden;
        }
        .a5-container {
          width: 148mm;
          height: 210mm;
          min-height: 210mm;
          max-height: 210mm;
          padding-left: ${outerMargin};
          padding-right: ${outerMargin};
          padding-top: ${headerMargin};
          padding-bottom: ${footerMargin};
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #ffffff;
        }
        .header {
          border-bottom: 2.5px solid #00c2cb;
          padding-bottom: 8px;
          margin-bottom: 6px;
        }
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .doctor-ar {
          flex: 1;
          text-align: right;
        }
        .doctor-en {
          flex: 1;
          text-align: left;
          direction: ltr;
        }
        .doctor-name {
          font-size: 15px;
          font-weight: 800;
          color: #020617;
          margin: 0 0 2px 0;
        }
        .doctor-title {
          font-size: 11.5px;
          font-weight: 700;
          color: #008f97;
          margin: 0 0 3px 0;
        }
        .doctor-credentials {
          font-size: 9.5px;
          color: #475569;
          line-height: 1.35;
          margin: 0;
          white-space: pre-line;
        }
        .logo-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 50px;
        }
        .logo-img {
          width: 44px;
          height: 44px;
          object-fit: contain;
        }
        .logo-fallback {
          width: 38px;
          height: 38px;
          background: #020617;
          color: #00c2cb;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 18px;
        }
        .patient-bar {
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 6px 12px;
          margin-bottom: ${spacingClass};
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
        }
        .rx-symbol {
          font-family: Georgia, serif;
          font-size: 22px;
          font-weight: 900;
          font-style: italic;
          color: #008f97;
          margin-left: 6px;
        }
        .rx-header {
          display: flex;
          align-items: center;
          border-bottom: 1.5px solid #e2e8f0;
          padding-bottom: 3px;
          margin-bottom: 8px;
        }
        .content-body {
          flex: 1;
          overflow: hidden;
        }
        .footer {
          border-top: 2.5px solid #00c2cb;
          padding-top: 6px;
          margin-top: 6px;
        }
        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: ${footerSize};
          color: #475569;
        }
        .qr-code {
          width: 44px;
          height: 44px;
        }
        .qr-code-wrapper svg {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="a5-container">
        <!-- Top Section -->
        <div>
          ${!config.preprintedPaperMode && config.showHeader ? `
            <div class="header">
              <div class="header-content">
                <div class="doctor-ar">
                  <div class="doctor-name">${config.doctorName || 'طبيب العيادة'}</div>
                  <div class="doctor-title">${config.specialtyAr || 'التخصص الطبي العام'}</div>
                  <div class="doctor-credentials">${config.degreesAr || 'الدرجات العلمية والشهادات المهنية والزمالات المسجلة'}</div>
                </div>

                ${config.showLogo ? `
                  <div class="logo-box">
                    ${config.logoUrl ? `<img src="${config.logoUrl}" class="logo-img" width="44" height="44" style="width: 44px !important; height: 44px !important; max-width: 44px !important; max-height: 44px !important; object-fit: contain;" alt="Logo" />` : '<div class="logo-fallback">Rx</div>'}
                    <div style="font-size: 7px; font-weight: bold; color: #94a3b8; margin-top: 2px; text-transform: uppercase;">SOLI CLINIC</div>
                  </div>
                ` : ''}

                <div class="doctor-en">
                  <div class="doctor-name">${config.doctorNameEn || 'Dr. Hazem El-Kady'}</div>
                  <div class="doctor-title">${config.specialtyEn || 'Consultant of Cardiology'}</div>
                  <div class="doctor-credentials">${config.degreesEn || 'M.D., MRCP (London)'}</div>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Patient Meta Strip -->
          <div class="patient-bar">
            <div><strong>المريض:</strong> ${patient?.name || 'مريض غير مسجل'}</div>
            ${patient?.fileNumber ? `<div><strong>رقم الملف:</strong> #${toEnglishDigits(patient.fileNumber)}</div>` : ''}
            <div><strong>السن:</strong> ${patient?.age ? `${toEnglishDigits(patient.age)} سنة` : '-'}</div>
            <div><strong>التاريخ:</strong> <span style="font-family: monospace;">${toEnglishDigits(patient?.date || new Date().toLocaleDateString('ar-EG'))}</span></div>
          </div>
        </div>

        <!-- Middle Section: Medications -->
        <div class="content-body" style="direction: ltr; text-align: left; display: flex; flex-direction: column; gap: ${containerGap};">
          <!-- Diagnosis section on top of medications -->
          ${diagnosesHtml}

          <!-- Treatment section with RX icon next to the medications -->
          <div style="display: flex; gap: 12px; align-items: flex-start; direction: ltr;">
            <!-- RX symbol next to the treatment list -->
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 2px;">
              <span class="rx-symbol" style="font-family: Georgia, serif; font-size: 28px; font-weight: 900; font-style: italic; color: #008f97; margin: 0; line-height: 1;">℞</span>
            </div>
            
            <!-- Treatment list -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: ${itemMarginBottom};">
              ${itemsHtml}
            </div>
          </div>

          ${adviceHtml}
          ${followupHtml}
        </div>

        <!-- Bottom Section: Footer -->
        ${!config.preprintedPaperMode && config.showFooter ? `
          <div class="footer">
            <div class="footer-content">
              <div style="flex: 1; text-align: right;">
                ${branchesHtml}
                <div style="color: #64748b; margin-top: 2px;">
                  للحجز والاستفسار: <strong style="color: #0f172a; font-family: monospace;">${config.phone || '01092847162'}</strong>
                </div>
              </div>

              ${config.showQr ? `
                <div style="display: flex; flex-direction: column; align-items: center; margin-right: 8px;">
                  <div class="qr-code-wrapper" style="width: 44px; height: 44px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px; background: #fff; display: flex; align-items: center; justify-content: center; box-sizing: border-box; overflow: hidden;">
                    ${qrSvgHtml || `
                      <svg viewBox="0 0 100 100" class="qr-code" fill="#0f172a" style="width: 100%; height: 100%;">
                        <path d="M10 10h30v30h-30zM15 15v20h20v-20zM22 22h6v6h-6zM60 10h30v30h-30zM65 15v20h20v-20zM72 22h6v6h-6zM10 60h30v30h-30zM15 65v20h20v-20zM22 72h6v6h-6zM60 60h10v10h-10zM80 60h10v10h-10zM70 70h10v10h-10zM60 80h10v10h-10zM80 80h10v10h-10zM45 10h10v80h-10z" />
                      </svg>
                    `}
                  </div>
                  <div style="font-size: 7px; color: #64748b; font-weight: bold; margin-top: 2px;">
                    ${config.qrType === 'whatsapp' ? 'واتساب العيادة' : 'موقع العيادة'}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;

  return htmlContent;
}

export async function printPrescriptionDocument(data: PrintPrescriptionData) {
  const htmlContent = await generatePrescriptionHtml(data);

  // Create an invisible iframe to execute the print job cleanly
  const existingFrame = document.getElementById('soli-print-iframe');
  if (existingFrame) {
    existingFrame.remove();
  }

  const printIframe = document.createElement('iframe');
  printIframe.id = 'soli-print-iframe';
  printIframe.style.position = 'fixed';
  printIframe.style.top = '-9999px';
  printIframe.style.left = '-9999px';
  printIframe.style.width = '148mm';
  printIframe.style.height = '210mm';
  printIframe.style.border = 'none';
  printIframe.style.zIndex = '-9999';

  document.body.appendChild(printIframe);

  const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
  if (!iframeDoc) {
    // Fallback if iframe access fails
    window.print();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  // Wait for assets/fonts to render, then print
  setTimeout(() => {
    try {
      if (printIframe.contentWindow) {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Iframe print failed, falling back to window.print():', err);
      window.print();
    }
  }, 250);
}

export function printVisitReportDocument(data: PrintVisitReportData) {
  const { config = {}, patient, visit, medications = [], labOrders = [], radiologyOrders = [], followUp } = data;

  const doctorName = config.doctorName || 'طبيب العيادة';
  const doctorNameEn = config.doctorNameEn || 'Clinic Doctor';
  const specialtyAr = config.specialtyAr || 'التخصص الطبي العام للعيادة';
  const specialtyEn = config.specialtyEn || 'Clinic Medical Specialty';
  const degreesAr = config.degreesAr || 'الدرجات العلمية والشهادات المهنية المسجلة للعيادة';
  const degreesEn = config.degreesEn || 'Registered Medical Degrees & Professional Credentials';
  const phone = config.phone || '01092847162';

  const visitDateObj = visit.createdAt ? new Date(visit.createdAt) : new Date();
  const formattedVisitDate = toEnglishDigits(
    visitDateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
  );
  const formattedVisitTime = toEnglishDigits(
    visitDateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  );

  const complaint = visit.clinicalData?.chiefComplaint || visit.receptionistData?.symptoms || 'كشف ومتابعة طبية عامة';
  const diagnoses = visit.clinicalData?.diagnosis || [];
  const treatment = visit.clinicalData?.treatment || '';
  const notes = visit.clinicalData?.notes || '';

  const vitals = visit.vitalSigns as any;
  const recordedVitalsList: string[] = [];
  if (vitals) {
    const bp = vitals.bloodPressure || vitals.bp;
    const pulse = vitals.pulse;
    const temp = vitals.temperature || vitals.temp;
    const rbs = vitals.randomBloodSugar || vitals.rbs;
    const spo2 = vitals.oxygenSaturation || vitals.spo2;
    const weight = vitals.weight;

    if (bp && String(bp).trim()) {
      recordedVitalsList.push(`
        <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
          <span style="font-size: 9px; color: #64748b; display: block; font-weight: bold;">ضغط الدم</span>
          <strong style="font-size: 11px; color: #0f172a; font-family: monospace;">${toEnglishDigits(bp)}</strong>
        </div>
      `);
    }
    if (pulse && String(pulse).trim()) {
      recordedVitalsList.push(`
        <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
          <span style="font-size: 9px; color: #64748b; display: block; font-weight: bold;">النبض</span>
          <strong style="font-size: 11px; color: #0f172a; font-family: monospace;">${toEnglishDigits(pulse)} نبضة</strong>
        </div>
      `);
    }
    if (temp && String(temp).trim()) {
      recordedVitalsList.push(`
        <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
          <span style="font-size: 9px; color: #64748b; display: block; font-weight: bold;">الحرارة</span>
          <strong style="font-size: 11px; color: #0f172a; font-family: monospace;">${toEnglishDigits(temp)} °C</strong>
        </div>
      `);
    }
    if (rbs && String(rbs).trim()) {
      recordedVitalsList.push(`
        <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
          <span style="font-size: 9px; color: #64748b; display: block; font-weight: bold;">سكر عشوائي</span>
          <strong style="font-size: 11px; color: #0f172a; font-family: monospace;">${toEnglishDigits(rbs)} mg/dL</strong>
        </div>
      `);
    }
    if (spo2 && String(spo2).trim()) {
      recordedVitalsList.push(`
        <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
          <span style="font-size: 9px; color: #64748b; display: block; font-weight: bold;">الأكسجين</span>
          <strong style="font-size: 11px; color: #0f172a; font-family: monospace;">${toEnglishDigits(spo2)}%</strong>
        </div>
      `);
    }
    if (weight && String(weight).trim()) {
      recordedVitalsList.push(`
        <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
          <span style="font-size: 9px; color: #64748b; display: block; font-weight: bold;">الوزن</span>
          <strong style="font-size: 11px; color: #0f172a; font-family: monospace;">${toEnglishDigits(weight)} كجم</strong>
        </div>
      `);
    }
  }

  const vitalsHtml = recordedVitalsList.length > 0
    ? `
    <div style="margin-top: 14px; margin-bottom: 14px;">
      <div style="font-size: 12px; font-weight: 700; color: #0f766e; margin-bottom: 6px; border-bottom: 1px solid #ccfbf1; padding-bottom: 3px;">
        🫀 العلامات الحيوية (Vital Signs)
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        ${recordedVitalsList.join('')}
      </div>
    </div>
  `
    : '';

  const diagnosisHtml =
    diagnoses.length > 0
      ? `
    <div style="margin-bottom: 12px; padding: 8px 12px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px;">
      <strong style="color: #0f766e; font-size: 12px;">📋 التشخيص الإكلينيكي: </strong>
      <span style="color: #134e4a; font-size: 12px; font-weight: 600;">${diagnoses.join('، ')}</span>
    </div>
  `
      : '';

  const medsHtml =
    medications.length > 0
      ? `
    <div style="margin-bottom: 14px;">
      <div style="font-size: 12px; font-weight: 700; color: #0f766e; margin-bottom: 6px; border-bottom: 1px solid #ccfbf1; padding-bottom: 3px;">
        💊 الخطة العلاجية والأدوية الموصوفة (${toEnglishDigits(medications.length)})
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; direction: ltr; text-align: left;">
        ${medications
          .map(
            (m, idx) => `
          <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
            <div style="font-size: 12px; font-weight: 700; color: #0f172a;">
              ${idx + 1}. ${m.name} ${m.strength ? `(${m.strength})` : ''}
            </div>
            <div style="font-size: 11px; color: #0f766e; font-weight: 600;">
              ${m.dose || 'قرص'} ${m.duration ? `• لمدة ${m.duration}` : ''}
            </div>
            ${m.instructions ? `<div style="font-size: 10px; color: #64748b; font-style: italic;">${m.instructions}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `
      : treatment
      ? `
    <div style="margin-bottom: 12px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
      <strong style="color: #0f172a; font-size: 12px;">💊 العلاج والتعليمات: </strong>
      <span style="color: #334155; font-size: 12px;">${treatment}</span>
    </div>
  `
      : '';

  const labsHtml =
    labOrders.length > 0
      ? `
    <div style="margin-bottom: 10px; padding: 8px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 11.5px; color: #92400e;">
      <strong>🧪 التحاليل المخبرية المطلوبة: </strong>
      <span>${labOrders.map((l) => l.testName).join('، ')}</span>
    </div>
  `
      : '';

  const radsHtml =
    radiologyOrders.length > 0
      ? `
    <div style="margin-bottom: 10px; padding: 8px 12px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; font-size: 11.5px; color: #6b21a8;">
      <strong>🩻 الفحوصات والأشعة المطلوبة: </strong>
      <span>${radiologyOrders.map((r) => r.radiologyName).join('، ')}</span>
    </div>
  `
      : '';

  const followUpHtml = followUp?.scheduledDate
    ? `
    <div style="margin-bottom: 10px; padding: 8px 12px; background: #f0fdfa; border: 1px solid #a7f3d0; border-radius: 8px; font-size: 12px; color: #065f46; font-weight: bold;">
      🗓 موعد الاستشارة والمتابعة القادمة: <span style="font-family: monospace;">${toEnglishDigits(followUp.scheduledDate)}</span>
      ${followUp.notes ? ` <span style="font-size: 11px; font-weight: normal; color: #047857;">(${followUp.notes})</span>` : ''}
    </div>
  `
    : '';

  const notesHtml = notes
    ? `
    <div style="margin-bottom: 10px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11.5px; color: #475569;">
      <strong>📝 ملاحظات وتوصيات طبية: </strong>
      <span>${notes}</span>
    </div>
  `
    : '';

  const reportHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <title>تقرير زيارة طبية - ${patient.fullName}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 12mm;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body {
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          margin: 0;
          padding: 0;
          background: #fff;
          color: #0f172a;
          line-height: 1.5;
        }
        .report-container {
          width: 100%;
          max-width: 190mm;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .header {
          border-bottom: 2.5px solid #00c2cb;
          padding-bottom: 10px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .doctor-ar { text-align: right; }
        .doctor-en { text-align: left; direction: ltr; }
        .doctor-name { font-size: 15px; font-weight: 800; color: #08101c; }
        .doctor-title { font-size: 11px; font-weight: 700; color: #008f97; margin-top: 1px; }
        .doctor-credentials { font-size: 9.5px; color: #64748b; margin-top: 1px; }
        .logo-box { text-align: center; }
        .patient-bar {
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 14px;
          margin-bottom: 12px;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.2fr;
          gap: 8px;
          font-size: 11.5px;
        }
        .visit-type-badge {
          display: inline-block;
          padding: 2px 8px;
          background: #e0f2fe;
          color: #0369a1;
          border-radius: 6px;
          font-size: 11px;
          font-weight: bold;
        }
        .footer {
          margin-top: 20px;
          border-top: 1.5px solid #e2e8f0;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 10.5px;
          color: #64748b;
        }
        .signature-area {
          text-align: center;
          width: 140px;
          border-top: 1px dashed #94a3b8;
          padding-top: 4px;
          font-size: 10px;
          color: #475569;
        }
      </style>
    </head>
    <body>
      <div class="report-container">
        <!-- Header -->
        <div class="header">
          <div class="doctor-ar">
            <div class="doctor-name">${doctorName}</div>
            <div class="doctor-title">${specialtyAr}</div>
            <div class="doctor-credentials">${degreesAr}</div>
          </div>
          <div class="logo-box">
            <div style="width: 42px; height: 42px; background: #08101c; color: #00c2cb; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 15px; margin: 0 auto;">
              SOLI
            </div>
            <div style="font-size: 7.5px; font-weight: bold; color: #64748b; margin-top: 2px;">CLINICAL REPORT</div>
          </div>
          <div class="doctor-en">
            <div class="doctor-name">${doctorNameEn}</div>
            <div class="doctor-title">${specialtyEn}</div>
            <div class="doctor-credentials">${degreesEn}</div>
          </div>
        </div>

        <!-- Title -->
        <div style="text-align: center; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 15px; color: #0f172a;">تقرير كشف وزيارة طبية (Medical Visit Report)</h2>
          <span style="font-size: 11px; color: #64748b;">تاريخ التقرير: ${formattedVisitDate} — الساعة: ${formattedVisitTime}</span>
        </div>

        <!-- Patient Info Bar -->
        <div class="patient-bar">
          <div><strong>اسم المريض:</strong> ${patient.fullName}</div>
          <div><strong>رقم الملف:</strong> #${toEnglishDigits(patient.fileNumber || 1)}</div>
          <div><strong>السن:</strong> ${patient.age ? `${toEnglishDigits(patient.age)} سنة` : '-'}</div>
          <div><strong>نوع الزيارة:</strong> <span class="visit-type-badge">${visit.visitType === 'NEW' ? 'كشف جديد' : 'استشارة / متابعة'}</span></div>
        </div>

        <!-- Chief Complaint -->
        <div style="margin-bottom: 10px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11.5px;">
          <strong style="color: #0f172a;">الشكوى والأعراض الرئيسية: </strong>
          <span style="color: #334155;">${complaint}</span>
        </div>

        <!-- Vital Signs -->
        ${vitalsHtml}

        <!-- Diagnosis -->
        ${diagnosisHtml}

        <!-- Medications / Treatment -->
        ${medsHtml}

        <!-- Labs & Radiology -->
        ${labsHtml}
        ${radsHtml}

        <!-- Follow-up -->
        ${followUpHtml}

        <!-- Clinical Notes -->
        ${notesHtml}

        <!-- Footer -->
        <div class="footer">
          <div>
            <div>عيادة سولي التخصصية — للحجز والاستفسار: <strong style="color: #0f172a; font-family: monospace;">${phone}</strong></div>
            <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">صدر هذا التقرير رسمياً من المنظومة الطبية الإلكترونية للعيادة</div>
          </div>
          <div class="signature-area">
            توقيع / ختم الطبيب المعالج
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Print using invisible iframe
  const existingFrame = document.getElementById('soli-print-iframe');
  if (existingFrame) {
    existingFrame.remove();
  }

  const printIframe = document.createElement('iframe');
  printIframe.id = 'soli-print-iframe';
  printIframe.style.position = 'fixed';
  printIframe.style.top = '-9999px';
  printIframe.style.left = '-9999px';
  printIframe.style.width = '210mm';
  printIframe.style.height = '297mm';
  printIframe.style.border = 'none';
  printIframe.style.zIndex = '-9999';

  document.body.appendChild(printIframe);

  const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(reportHtml);
  iframeDoc.close();

  setTimeout(() => {
    try {
      if (printIframe.contentWindow) {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Iframe print failed, falling back to window.print():', err);
      window.print();
    }
  }, 250);
}

