import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { CLINIC_INFO } from '../data/previewClinicData';
import { findBranch } from './clinicBranches';
import { getPrescriptionDoctorInfo } from './prescriptionDoctor';
import type { PatientListItem } from '../types';
import { formatAppDate, toEnglishDigits } from './numberUtils';
import type {
  FollowUp,
  Invoice,
  LabOrder,
  Patient,
  Prescription,
  RadiologyOrder,
  Visit,
} from '../types/database';

export interface MedicalRecordPdfData {
  patient: PatientListItem;
  patientCanonical?: Patient;
  visits?: Visit[];
  invoices?: Invoice[];
  prescriptions?: Prescription[];
  labOrders?: LabOrder[];
  radiologyOrders?: RadiologyOrder[];
  followUps?: FollowUp[];
}

/**
 * Downloads a comprehensive, beautifully formatted Medical Dossier PDF (A4 multi-page)
 * containing full patient demographics, chronic diseases, allergies, clinical visits history,
 * vital signs, diagnoses, prescriptions, lab results, radiology imaging reports, and financial accounts.
 */
export async function exportPatientMedicalDossierPdf(data: MedicalRecordPdfData) {
  const {
    patient,
    patientCanonical,
    visits = [],
    invoices = [],
    prescriptions = [],
    labOrders = [],
    radiologyOrders = [],
    followUps = [],
  } = data;

  const patientName = patientCanonical?.fullName || patient.name || 'مريض';
  const phone = patientCanonical?.phone || patient.phone || 'غير مسجل';
  const genderStr = (patientCanonical?.gender || patient.gender) === 'female' ? 'أنثى' : 'ذكر';
  const age = patient.age || 30;
  const bloodType = patientCanonical?.bloodType || patient.bloodType || 'غير محدد';
  const address = patientCanonical?.address || patient.address || patientCanonical?.governorate || patient.governorate || 'غير مسجل';
  const emergencyName = patientCanonical?.emergencyContact?.name || patient.emergencyContact?.name || 'غير مسجل';
  const emergencyPhone = patientCanonical?.emergencyContact?.phone || patient.emergencyContact?.phone || 'غير مسجل';
  const allergies = patientCanonical?.allergies || patient.allergies || [];
  const chronicDiseases = patientCanonical?.chronicDiseases || patient.chronicConditions || [];
  const notes = patientCanonical?.notes || '';

  // Filter patient related records
  const pVisits = visits.filter((v) => v.patientId === patient.id);
  const pPrescriptions = prescriptions.filter((pr) => pr.patientId === patient.id);
  const pLabOrders = labOrders.filter((l) => l.patientId === patient.id);
  const pRadiologyOrders = radiologyOrders.filter((r) => r.patientId === patient.id);
  const pInvoices = invoices.filter((i) => i.patientId === patient.id);

  // Create temporary container for HTML rendering
  const container = document.createElement('div');
  container.id = 'temp-medical-dossier-pdf-container';
  container.setAttribute(
    'style',
    'position: fixed; left: -9999px; top: 0; width: 800px; background-color: #ffffff; color: #0f172a; font-family: "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl; text-align: right; padding: 24px; box-sizing: border-box; z-index: -9999;'
  );

  const printDate = formatAppDate(new Date());

  const doctorInfo = getPrescriptionDoctorInfo();
  const branch = findBranch();
  const branchPhone = branch.phone || branch.mobile || doctorInfo.phone || '01092847162';
  const doctorDisplayName = doctorInfo.doctorName || CLINIC_INFO.doctorName;

  let htmlContent = `
    <div style="border: 2px solid #008f97; border-radius: 12px; padding: 20px; background: #ffffff; margin-bottom: 20px;">
      <!-- Clinic Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; color: #008f97; font-weight: bold;">عيادة ${doctorDisplayName}</h1>
          <div style="font-size: 13px; color: #334155; font-weight: bold; margin-top: 3px;">${doctorInfo.specialtyAr || CLINIC_INFO.doctorTitle}</div>
          <div style="font-size: 11px; color: #64748b;">${doctorInfo.degreesAr || CLINIC_INFO.doctorCredentials}</div>
        </div>
        <div style="text-align: left; font-size: 11px; color: #475569;">
          <div style="background: #e6fffa; color: #008f97; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-bottom: 4px; border: 1px solid #b2f5ea;">
            الملف الطبي الشامل للمريض
          </div>
          <div>تاريخ الطباعة: <strong>${printDate}</strong></div>
          <div>هاتف العيادة: <strong>${branchPhone}</strong></div>
        </div>
      </div>

      <!-- Patient Demographics Box -->
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 12px;">
          <div><span style="color: #64748b;">اسم المريض:</span> <strong style="font-size: 14px; color: #0f172a;">${patientName}</strong></div>
          <div><span style="color: #64748b;">رقم الملف:</span> <strong style="color: #008f97; font-family: monospace;">#${toEnglishDigits(patient.fileNumber || 1)}</strong></div>
          <div><span style="color: #64748b;">رقم الهاتف:</span> <strong>${toEnglishDigits(phone)}</strong></div>
          <div><span style="color: #64748b;">السن / النوع:</span> <strong>${toEnglishDigits(age)} سنة • ${genderStr}</strong></div>
          <div><span style="color: #64748b;">فصيلة الدم:</span> <strong style="color: #e11d48;">${bloodType}</strong></div>
          <div><span style="color: #64748b;">العنوان:</span> <strong>${address}</strong></div>
          <div><span style="color: #64748b;">طوارئ:</span> <strong>${emergencyName} (${toEnglishDigits(emergencyPhone)})</strong></div>
          <div><span style="color: #64748b;">تاريخ التسجيل:</span> <strong>${toEnglishDigits(patient.registrationDate || '2024-02-10')}</strong></div>
          <div><span style="color: #64748b;">إجمالي الزيارات:</span> <strong>${toEnglishDigits(pVisits.length)} زيارة</strong></div>
        </div>
      </div>

      <!-- Medical Alerts & Chronic Conditions -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="background: ${allergies.length > 0 ? '#fff1f2' : '#f8fafc'}; border: 1px solid ${allergies.length > 0 ? '#fecdd3' : '#e2e8f0'}; border-radius: 8px; padding: 10px; font-size: 11.5px;">
          <div style="color: #e11d48; font-weight: bold; margin-bottom: 4px;">⚠️ سجل الحساسية الدوائية والغذائية:</div>
          <div style="color: #334155;">${allergies.length > 0 ? allergies.join(' • ') : 'لا توجد حساسية مسجلة (سليم)'}</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; font-size: 11.5px;">
          <div style="color: #16a34a; font-weight: bold; margin-bottom: 4px;">🩺 الأمراض المزمنة المثبتة:</div>
          <div style="color: #334155;">${chronicDiseases.length > 0 ? chronicDiseases.join(' • ') : 'لا توجد أمراض مزمنة مسجلة'}</div>
        </div>
      </div>

      ${notes ? `
        <div style="background: #fdf4ff; border: 1px solid #f0abfc; border-radius: 8px; padding: 8px 12px; font-size: 11.5px; margin-bottom: 16px;">
          <strong style="color: #a21caf;">ملاحظات عامة: </strong> <span>${notes}</span>
        </div>
      ` : ''}

      <!-- Section: Prescriptions History -->
      <div style="margin-top: 20px; margin-bottom: 16px;">
        <div style="background: #008f97; color: #ffffff; padding: 6px 12px; font-size: 13px; font-weight: bold; border-radius: 6px; margin-bottom: 10px;">
          💊 سجل الروشتات والوصفات الدوائية (${pPrescriptions.length})
        </div>
        ${pPrescriptions.length === 0 ? '<div style="font-size: 11.5px; color: #94a3b8; padding: 8px;">لا توجد روشتات مسجلة.</div>' : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${pPrescriptions.map((pr) => `
              <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #fafafa; font-size: 11.5px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; color: #008f97; margin-bottom: 6px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">
                  <span>روشتة طبية - ${formatAppDate(pr.createdAt)}</span>
                  <span>${toEnglishDigits(pr.items.length)} أصناف دوائية</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                  ${pr.items.map((it, idx) => `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 8px;">
                      <strong>${toEnglishDigits(idx + 1)}. ${it.name} ${it.strength || ''}</strong>
                      <div style="color: #0f766e; font-size: 10.5px;">${toEnglishDigits(it.dose || '')} ${it.instructions ? `• ${toEnglishDigits(it.instructions)}` : ''} ${it.duration ? `• ${toEnglishDigits(it.duration)}` : ''}</div>
                    </div>
                  `).join('')}
                </div>
                ${pr.notes ? `<div style="margin-top: 4px; font-size: 10.5px; color: #64748b; font-style: italic;">تعليمات: ${pr.notes}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Section: Clinical Visits History -->
      <div style="margin-top: 20px; margin-bottom: 16px;">
        <div style="background: #008f97; color: #ffffff; padding: 6px 12px; font-size: 13px; font-weight: bold; border-radius: 6px; margin-bottom: 10px;">
          🩺 سجل الزيارات والكشوفات الإكلينيكية (${toEnglishDigits(pVisits.length)})
        </div>
        ${pVisits.length === 0 ? '<div style="font-size: 11.5px; color: #94a3b8; padding: 8px;">لا توجد زيارات مسجلة.</div>' : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${pVisits.map((v) => `
              <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #ffffff; font-size: 11.5px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; color: #1e293b; margin-bottom: 4px;">
                  <span>${formatAppDate(v.createdAt)} — ${v.visitType === 'NEW' ? 'كشف جديد' : 'متابعة / استشارة'}</span>
                  <span style="color: #008f97;">${v.clinicalData?.chiefComplaint || v.receptionistData?.symptoms || 'كشف باطنة'}</span>
                </div>
                ${(() => {
                  if (!v.vitalSigns) return '';
                  const parts: string[] = [];
                  const vs = v.vitalSigns as any;
                  const bp = vs.bloodPressure || vs.bp;
                  const pulse = vs.pulse;
                  const temp = vs.temperature || vs.temp;
                  const rbs = vs.randomBloodSugar || vs.rbs;
                  const spo2 = vs.oxygenSaturation || vs.spo2;
                  const weight = vs.weight;

                  if (bp && String(bp).trim()) parts.push(`ضغط: ${toEnglishDigits(bp)}`);
                  if (pulse && String(pulse).trim()) parts.push(`نبض: ${toEnglishDigits(pulse)}`);
                  if (temp && String(temp).trim()) parts.push(`حرارة: ${toEnglishDigits(temp)}°C`);
                  if (rbs && String(rbs).trim()) parts.push(`سكر عشوائي: ${toEnglishDigits(rbs)} mg/dL`);
                  if (spo2 && String(spo2).trim()) parts.push(`أكسجين: ${toEnglishDigits(spo2)}%`);
                  if (weight && String(weight).trim()) parts.push(`وزن: ${toEnglishDigits(weight)} كجم`);
                  if (parts.length === 0) return '';
                  return `<div style="font-size: 10.5px; color: #475569; background: #f8fafc; padding: 4px 8px; border-radius: 4px; margin-bottom: 4px;">
                    العلامات الحيوية: ${parts.join(' | ')}
                  </div>`;
                })()}
                ${v.clinicalData?.diagnosis && v.clinicalData.diagnosis.length > 0 ? `
                  <div style="color: #0f172a; margin-top: 2px;">
                    <strong>التشخيص:</strong> ${v.clinicalData.diagnosis.join('، ')}
                  </div>
                ` : ''}
                ${v.clinicalData?.treatment ? `
                  <div style="color: #334155; margin-top: 2px; font-size: 11px;">
                    <strong>الخطة العلاجية:</strong> ${v.clinicalData.treatment}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Section: Labs & Radiology -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; margin-bottom: 16px;">
        <!-- Labs -->
        <div>
          <div style="background: #0d9488; color: #ffffff; padding: 5px 10px; font-size: 12px; font-weight: bold; border-radius: 6px; margin-bottom: 8px;">
            🧪 الفحوصات والتحاليل المعملية (${toEnglishDigits(pLabOrders.length)})
          </div>
          ${pLabOrders.length === 0 ? '<div style="font-size: 11px; color: #94a3b8;">لا توجد تحاليل مسجلة.</div>' : `
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
              ${pLabOrders.map((l) => `
                <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; background: #fafafa;">
                  <div style="font-weight: bold; color: #0f172a;">${l.testName}</div>
                  <div style="font-size: 10px; color: #64748b;">${formatAppDate(l.orderedAt)}</div>
                  ${l.result ? `<div style="color: #15803d; font-weight: bold; margin-top: 2px;">النتيجة: ${toEnglishDigits(l.result)}</div>` : '<div style="color: #b45309;">بانتظار النتيجة</div>'}
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Radiology -->
        <div>
          <div style="background: #7c3aed; color: #ffffff; padding: 5px 10px; font-size: 12px; font-weight: bold; border-radius: 6px; margin-bottom: 8px;">
            🩻 الأشعة والتصوير الطبي (${toEnglishDigits(pRadiologyOrders.length)})
          </div>
          ${pRadiologyOrders.length === 0 ? '<div style="font-size: 11px; color: #94a3b8;">لا توجد فحوصات أشعة مسجلة.</div>' : `
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
              ${pRadiologyOrders.map((r) => `
                <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; background: #fafafa;">
                  <div style="font-weight: bold; color: #0f172a;">${r.radiologyName}</div>
                  <div style="font-size: 10px; color: #64748b;">${formatAppDate(r.orderedAt)}</div>
                  ${r.report || r.result ? `<div style="color: #6b21a8; font-size: 10.5px; margin-top: 2px;">التقرير: ${toEnglishDigits(r.report || r.result)}</div>` : '<div style="color: #b45309;">بانتظار التقرير</div>'}
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <!-- Financial Summary & Invoices -->
      <div style="margin-top: 20px; border-top: 2px solid #e2e8f0; pt-3;">
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
          <div>
            <strong>إجمالي المعاملات المالية المسجلة:</strong> ${toEnglishDigits(pInvoices.length)} فاتورة
          </div>
          <div style="color: #008f97; font-weight: bold; font-size: 13px;">
            إجمالي المدفوعات: ${toEnglishDigits(patient.totalPaid || 0)} ج.م
          </div>
        </div>
      </div>

      <!-- Clinic Footer Signature -->
      <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 11px; color: #475569;">
        <div>
          <div>${branch.name}${branch.address ? ` • ${branch.address}` : ''}</div>
          <div>للحجز والاستفسار: ${branchPhone}</div>
        </div>
        <div style="text-align: left;">
          <div>توقيع واعتماد الطبيب المعالج:</div>
          <div style="margin-top: 20px; font-weight: bold; color: #008f97;">د. ${doctorDisplayName}</div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`الملف_الطبي_${patientName.replace(/\s+/g, '_')}_file_${toEnglishDigits(patient.fileNumber || 1)}.pdf`);
  } catch (err) {
    console.error('Error generating medical dossier PDF:', err);
    alert('حدث خطأ أثناء تحميل الملف الطبي، يرجى المحاولة مرة أخرى.');
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
