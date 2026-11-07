import type { Patient } from '../types/database';

export interface PatientValidationResult {
  valid: boolean;
  error?: string;
  sanitizedData?: Patient & { _rev: number };
  changedFields?: string[];
}

const IMMUTABLE_PATIENT_FIELDS = ['clinic_id', 'clinicId', 'patientId', 'createdAt', 'createdBy'] as const;

export function validateAndSanitizePatientUpdate(
  existingPatient: Partial<Patient> & Record<string, unknown>,
  updates: Partial<Patient> & Record<string, unknown>,
  hasUpdatePermission: boolean
): PatientValidationResult {
  if (!hasUpdatePermission) {
    return {
      valid: false,
      error: 'غير مصرح: ليس لديك صلاحية تعديل بيانات المرضى (patients.update).',
    };
  }

  const targetPatientId = String(existingPatient.patientId || updates.patientId || '').trim();
  if (!targetPatientId) {
    return {
      valid: false,
      error: 'معرف المريض (patientId) مفقود ولا يمكن إتمام التعديل.',
    };
  }

  // Reject explicit attempts to mutate clinic_id to a different value
  if (
    updates.clinic_id !== undefined &&
    existingPatient.clinic_id !== undefined &&
    updates.clinic_id !== existingPatient.clinic_id
  ) {
    return {
      valid: false,
      error: 'غير مصرح بتغيير معرف العيادة (clinic_id) لسجل المريض.',
    };
  }

  if (
    updates.patientId !== undefined &&
    existingPatient.patientId !== undefined &&
    String(updates.patientId).trim() !== String(existingPatient.patientId).trim()
  ) {
    return {
      valid: false,
      error: 'غير مصرح بتغيير المعرف الأساسي للمريض (patientId).',
    };
  }

  // Merge while stripping immutable fields from `updates`
  const safeUpdates: Record<string, unknown> = { ...updates };
  for (const field of IMMUTABLE_PATIENT_FIELDS) {
    delete safeUpdates[field];
  }

  const nextFullName =
    safeUpdates.fullName !== undefined
      ? String(safeUpdates.fullName || '').trim()
      : String(existingPatient.fullName || '').trim();

  if (nextFullName.length < 2 || nextFullName.length > 120) {
    return {
      valid: false,
      error: 'اسم المريض يجب أن يكون بين حرفين و120 حرفاً.',
    };
  }

  const nextPhone =
    safeUpdates.phone !== undefined
      ? String(safeUpdates.phone ?? '').trim()
      : String(existingPatient.phone ?? '').trim();

  if (nextPhone.length > 0) {
    const digitsOnly = nextPhone.replace(/[\s\-+()]/g, '');
    if (!/^\d{7,16}$/.test(digitsOnly)) {
      return {
        valid: false,
        error: 'رقم الهاتف غير صالح. يجب أن يتكون من 7 إلى 16 رقماً.',
      };
    }
  }

  const nextMedicalCode =
    safeUpdates.medicalCode !== undefined
      ? String(safeUpdates.medicalCode ?? '').trim()
      : String(existingPatient.medicalCode ?? '').trim();

  if (nextMedicalCode.length > 40) {
    return {
      valid: false,
      error: 'الكود الطبي يتجاوز الحد المسموح (40 حرفاً).',
    };
  }

  const nextDob =
    safeUpdates.dateOfBirth !== undefined ? safeUpdates.dateOfBirth : existingPatient.dateOfBirth;
  if (nextDob !== null && nextDob !== undefined && String(nextDob).trim() !== '') {
    const parsedDate = new Date(String(nextDob));
    const now = new Date();
    if (Number.isNaN(parsedDate.getTime()) || parsedDate > now || parsedDate.getFullYear() < 1900) {
      return {
        valid: false,
        error: 'تاريخ الميلاد غير صالح أو يقع في المستقبل.',
      };
    }
  }

  const sanitizeStringArray = (val: unknown, fallback: string[] = []): string[] => {
    if (!Array.isArray(val)) return fallback;
    return val
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0 && item.length <= 150)
      .slice(0, 50);
  };

  const nextAllergies =
    safeUpdates.allergies !== undefined
      ? sanitizeStringArray(safeUpdates.allergies)
      : sanitizeStringArray(existingPatient.allergies);

  const nextChronic =
    safeUpdates.chronicDiseases !== undefined
      ? sanitizeStringArray(safeUpdates.chronicDiseases)
      : sanitizeStringArray(existingPatient.chronicDiseases);

  const prevRev = typeof existingPatient._rev === 'number' && existingPatient._rev > 0 ? existingPatient._rev : 1;
  const timestamp = new Date().toISOString();

  const sanitizedData: Patient & { _rev: number } = {
    ...(existingPatient as Patient),
    ...(safeUpdates as Partial<Patient>),
    patientId: targetPatientId,
    fullName: nextFullName,
    phone: nextPhone,
    medicalCode: nextMedicalCode || (existingPatient.medicalCode as string) || `EG-${targetPatientId.slice(0, 5)}`,
    dateOfBirth: (nextDob as string | null) ?? null,
    allergies: nextAllergies,
    chronicDiseases: nextChronic,
    createdAt: String(existingPatient.createdAt || timestamp),
    createdBy: String(existingPatient.createdBy || 'system'),
    updatedAt: timestamp,
    _rev: prevRev + 1,
  };

  delete (sanitizedData as unknown as Record<string, unknown>).clinic_id;
  delete (sanitizedData as unknown as Record<string, unknown>).clinicId;

  const changedFields = Object.keys(safeUpdates).filter(
    (k) => JSON.stringify((existingPatient as Record<string, unknown>)[k]) !== JSON.stringify((sanitizedData as unknown as Record<string, unknown>)[k])
  );

  return {
    valid: true,
    sanitizedData,
    changedFields,
  };
}
