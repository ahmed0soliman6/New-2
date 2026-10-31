import { Visit, Prescription, LabOrder, RadiologyOrder } from '../types/database';
import { PrescriptionItem, LabOrderItem, RadiologyOrderItem } from '../types';
import { PatientDiagnosis } from '../components/examination/DiagnosisCard';

export interface SmartClinicalSuggestions {
  frequentDrugs: Array<{
    drugName: string;
    strength?: string;
    dosageForm?: string;
    scientificName?: string;
    instructions?: string;
    count: number;
  }>;
  frequentDiagnoses: Array<{
    name: string;
    count: number;
  }>;
  frequentLabs: Array<{
    testName: string;
    count: number;
  }>;
  frequentRadiology: Array<{
    type: string;
    count: number;
  }>;
  frequentInstructions: Array<{
    text: string;
    count: number;
  }>;
  contextualSuggestions: Array<{
    type: 'drug' | 'lab' | 'radiology' | 'instruction';
    title: string;
    subtitle?: string;
    data: any;
    reason: string;
  }>;
}

/**
 * Memory key for custom learned clinical patterns
 */
const MEMORY_KEY = 'soli_clinical_doctor_memory';

export interface LearnedMemory {
  drugs: Record<string, { count: number; item: any }>;
  diagnoses: Record<string, number>;
  labs: Record<string, number>;
  radiology: Record<string, number>;
  instructions: Record<string, number>;
}

export function loadDoctorClinicalMemory(): LearnedMemory {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load clinical memory', e);
  }
  return {
    drugs: {},
    diagnoses: {},
    labs: {},
    radiology: {},
    instructions: {},
  };
}

export function saveDoctorClinicalMemory(memory: LearnedMemory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch (e) {
    console.warn('Failed to save clinical memory', e);
  }
}

/**
 * Saves completed exam into continuous clinical memory
 */
export function recordExamToClinicalMemory(data: {
  prescriptionItems?: PrescriptionItem[];
  labOrders?: LabOrderItem[];
  radiologyOrders?: RadiologyOrderItem[];
  diagnoses?: PatientDiagnosis[];
  lifestyleAdvice?: string;
}) {
  const memory = loadDoctorClinicalMemory();

  // 1. Record Drugs
  data.prescriptionItems?.forEach((item) => {
    if (!item.drugName) return;
    const key = `${item.drugName.trim().toLowerCase()}_${(item.strength || '').trim().toLowerCase()}`;
    if (!memory.drugs[key]) {
      memory.drugs[key] = {
        count: 1,
        item: {
          drugName: item.drugName,
          strength: item.strength || '',
          dosageForm: item.dosageForm || 'قرص',
          scientificName: item.scientificName || '',
          instructions: item.dosageInstructions || item.dosage || 'قرص بعد الأكل مرتين يومياً',
        },
      };
    } else {
      memory.drugs[key].count += 1;
    }
  });

  // 2. Record Diagnoses
  data.diagnoses?.forEach((d) => {
    const name = (d.nameAr || d.nameEn || '').trim();
    if (name) {
      memory.diagnoses[name] = (memory.diagnoses[name] || 0) + 1;
    }
  });

  // 3. Record Labs
  data.labOrders?.forEach((l) => {
    const name = (l.name || l.testName || '').trim();
    if (name) {
      memory.labs[name] = (memory.labs[name] || 0) + 1;
    }
  });

  // 4. Record Radiology
  data.radiologyOrders?.forEach((r) => {
    const type = (r.name || r.type || '').trim();
    if (type) {
      memory.radiology[type] = (memory.radiology[type] || 0) + 1;
    }
  });

  // 5. Record Instructions
  if (data.lifestyleAdvice) {
    const lines = data.lifestyleAdvice.split('\n');
    lines.forEach((line) => {
      const clean = line.replace(/^[•\-\*]\s*/, '').trim();
      if (clean && clean.length > 5) {
        memory.instructions[clean] = (memory.instructions[clean] || 0) + 1;
      }
    });
  }

  saveDoctorClinicalMemory(memory);
}

/**
 * Analyzes past visits, prescriptions, orders, and local memory
 * to generate smart AI clinical recommendations for the current exam.
 */
export function getSmartClinicalSuggestions(
  visits: Visit[] = [],
  prescriptions: Prescription[] = [],
  labOrders: LabOrder[] = [],
  radiologyOrders: RadiologyOrder[] = [],
  currentDiagnoses: PatientDiagnosis[] = []
): SmartClinicalSuggestions {
  const memory = loadDoctorClinicalMemory();

  const drugMap: Record<string, { drugName: string; strength?: string; dosageForm?: string; scientificName?: string; instructions?: string; count: number }> = {};
  const diagnosisMap: Record<string, number> = {};
  const labMap: Record<string, number> = {};
  const radMap: Record<string, number> = {};
  const instructionMap: Record<string, number> = {};

  // 1. Merge Local Learned Memory
  Object.entries(memory.drugs).forEach(([_, val]) => {
    const key = val.item.drugName;
    if (!drugMap[key]) {
      drugMap[key] = { ...val.item, count: val.count };
    } else {
      drugMap[key].count += val.count;
    }
  });

  Object.entries(memory.diagnoses).forEach(([name, count]) => {
    diagnosisMap[name] = (diagnosisMap[name] || 0) + count;
  });

  Object.entries(memory.labs).forEach(([name, count]) => {
    labMap[name] = (labMap[name] || 0) + count;
  });

  Object.entries(memory.radiology).forEach(([name, count]) => {
    radMap[name] = (radMap[name] || 0) + count;
  });

  Object.entries(memory.instructions).forEach(([text, count]) => {
    instructionMap[text] = (instructionMap[text] || 0) + count;
  });

  // 2. Parse Database Prescriptions
  prescriptions.forEach((p) => {
    p.items?.forEach((it) => {
      const drugName = it.name;
      if (!drugName) return;
      const key = drugName.trim();
      if (!drugMap[key]) {
        drugMap[key] = {
          drugName: drugName,
          strength: it.strength || '',
          dosageForm: it.form || 'قرص',
          scientificName: '',
          instructions: it.instructions || it.dose || '',
          count: 1,
        };
      } else {
        drugMap[key].count += 1;
      }
    });
  });

  // 3. Parse Database Visits
  visits.forEach((v) => {
    v.clinicalData?.diagnosis?.forEach((d) => {
      const name = d.trim();
      if (name) diagnosisMap[name] = (diagnosisMap[name] || 0) + 1;
    });

    if (v.clinicalData?.treatment) {
      const lines = v.clinicalData.treatment.split('\n');
      lines.forEach((line) => {
        const clean = line.replace(/^[•\-\*]\s*/, '').trim();
        if (clean && clean.length > 5) {
          instructionMap[clean] = (instructionMap[clean] || 0) + 1;
        }
      });
    }
  });

  // 4. Parse Database Lab Orders
  labOrders.forEach((l) => {
    if (l.testName) {
      const name = l.testName.trim();
      labMap[name] = (labMap[name] || 0) + 1;
    }
  });

  // 5. Parse Database Radiology Orders
  radiologyOrders.forEach((r) => {
    if (r.radiologyName) {
      const name = r.radiologyName.trim();
      radMap[name] = (radMap[name] || 0) + 1;
    }
  });

  // Sort and pick top items
  const frequentDrugs = Object.values(drugMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const frequentDiagnoses = Object.entries(diagnosisMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const frequentLabs = Object.entries(labMap)
    .map(([testName, count]) => ({ testName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const frequentRadiology = Object.entries(radMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const frequentInstructions = Object.entries(instructionMap)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Contextual associations based on active selected diagnoses
  const contextualSuggestions: Array<{
    type: 'drug' | 'lab' | 'radiology' | 'instruction';
    title: string;
    subtitle?: string;
    data: any;
    reason: string;
  }> = [];

  if (currentDiagnoses.length > 0) {
    const diagNames = currentDiagnoses.map((d) => (d.nameAr || d.nameEn || '').toLowerCase());

    // Match visits with similar diagnosis
    visits.forEach((v) => {
      const hasMatch = v.clinicalData?.diagnosis?.some((d) =>
        diagNames.some((curr) => d.toLowerCase().includes(curr) || curr.includes(d.toLowerCase()))
      );

      if (hasMatch && v.clinicalData?.treatment) {
        contextualSuggestions.push({
          type: 'instruction',
          title: 'إرشاد متكرر مع هذا التشخيص',
          subtitle: v.clinicalData.treatment.slice(0, 60) + '...',
          data: v.clinicalData.treatment,
          reason: 'موصى به استناداً لكشوفات سابقة لنفس التشخيص',
        });
      }
    });
  }

  return {
    frequentDrugs,
    frequentDiagnoses,
    frequentLabs,
    frequentRadiology,
    frequentInstructions,
    contextualSuggestions,
  };
}
