import { useState, useEffect } from 'react';
import { getDynamicDoctorName } from '../data/previewClinicData';

export function useDoctorName(): string {
  const [doctorName, setDoctorName] = useState<string>(() => getDynamicDoctorName());

  useEffect(() => {
    const handleUpdate = () => {
      setDoctorName(getDynamicDoctorName());
    };

    window.addEventListener('soli_prescription_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('soli_prescription_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return doctorName;
}
