import { useState, useEffect } from 'react';
import { CLINIC_INFO } from '../data/previewClinicData';
import { safeStorage, StorageKeys } from '../services/storage';

export interface PrescriptionDoctorInfo {
  doctorName: string;
  doctorNameEn: string;
  specialtyAr: string;
  specialtyEn: string;
  degreesAr: string;
  degreesEn: string;
  phone: string;
  logoUrl: string | null;
}

export function getPrescriptionDoctorInfo(): PrescriptionDoctorInfo {
  const fallback: PrescriptionDoctorInfo = {
    doctorName: CLINIC_INFO.doctorName || 'طبيب العيادة',
    doctorNameEn: 'Clinic Doctor',
    specialtyAr: CLINIC_INFO.doctorTitle || 'التخصص الطبي العام للعيادة',
    specialtyEn: 'Clinic Medical Specialty',
    degreesAr: CLINIC_INFO.doctorCredentials || 'الدرجات العلمية والشهادات المهنية المسجلة للعيادة',
    degreesEn: 'Registered Medical Degrees & Professional Credentials',
    phone: CLINIC_INFO.branches?.[0]?.mobile || '',
    logoUrl: CLINIC_INFO.logoUrl || null,
  };

  const parsed = safeStorage.getJSON<any | null>(StorageKeys.PRESCRIPTION_SETTINGS, null);
  const docProf = safeStorage.getJSON<any | null>('soli_doctor_profile', null);

  if (parsed || docProf) {
    const rawDocName =
      parsed?.doctorName?.trim() ||
      docProf?.doctorNameAr?.trim() ||
      docProf?.doctorName?.trim() ||
      docProf?.name?.trim() ||
      '';
    const rawDocNameEn =
      parsed?.doctorNameEn?.trim() ||
      docProf?.doctorNameEn?.trim() ||
      '';
    const rawSpecialtyAr =
      parsed?.specialtyAr?.trim() ||
      docProf?.specialtyAr?.trim() ||
      docProf?.specialty?.trim() ||
      docProf?.title?.trim() ||
      '';
    const rawSpecialtyEn =
      parsed?.specialtyEn?.trim() ||
      docProf?.specialtyEn?.trim() ||
      '';
    const rawDegreesAr =
      parsed?.degreesAr?.trim() ||
      (Array.isArray(docProf?.credentialsAr) ? docProf.credentialsAr.join(' • ') : docProf?.credentialsAr?.trim()) ||
      docProf?.degreesAr?.trim() ||
      '';
    const rawDegreesEn =
      parsed?.degreesEn?.trim() ||
      (Array.isArray(docProf?.credentialsEn) ? docProf.credentialsEn.join(' • ') : docProf?.credentialsEn?.trim()) ||
      docProf?.degreesEn?.trim() ||
      '';
    const rawPhone =
      parsed?.phone?.trim() ||
      docProf?.phone?.trim() ||
      '';

    return {
      doctorName: rawDocName || fallback.doctorName,
      doctorNameEn: rawDocNameEn || fallback.doctorNameEn,
      specialtyAr: rawSpecialtyAr || fallback.specialtyAr,
      specialtyEn: rawSpecialtyEn || fallback.specialtyEn,
      degreesAr: rawDegreesAr || fallback.degreesAr,
      degreesEn: rawDegreesEn || fallback.degreesEn,
      phone: rawPhone || fallback.phone,
      logoUrl: parsed?.logoUrl || docProf?.logoUrl || fallback.logoUrl,
    };
  }

  return fallback;
}

export function usePrescriptionDoctor(): PrescriptionDoctorInfo {
  const [info, setInfo] = useState<PrescriptionDoctorInfo>(getPrescriptionDoctorInfo);

  useEffect(() => {
    const handleUpdate = () => {
      setInfo(getPrescriptionDoctorInfo());
    };

    window.addEventListener('soli_prescription_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('soli_prescription_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return info;
}
