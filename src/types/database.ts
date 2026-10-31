/**
 * SOLI MEDICAL — DATABASE ARCHITECTURE 
 * TypeScript Type Definitions & Database Schemas
 *
 * Core Relationship:
 * PATIENT
 *    │
 *    ├──────────────► APPOINTMENT
 *    │
 *    ├──────────────► VISIT
 *    │                    │
 *    │                    ├──► INVOICE
 *    │                    │       │
 *    │                    │       └──► PAYMENT
 *    │                    │
 *    │                    ├──► LAB ORDERS
 *    │                    │
 *    │                    ├──► RADIOLOGY ORDERS
 *    │                    │
 *    │                    ├──► PRESCRIPTION
 *    │                    │
 *    │                    └──► FOLLOW-UP
 *    │
 *    └──────────────► PATIENT FILE (Aggregate View)
 */

export type UserRole = 'DOCTOR' | 'SECRETARY' | 'ADMIN';

export interface User {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  preferredLanguage: 'ar' | 'en';
  createdAt: string;
  updatedAt: string;
}

export interface DoctorProfile {
  nameAr: string;
  nameEn: string;
  specialtyAr: string;
  specialtyEn: string;
  degreesAr: string;
  degreesEn: string;
  phone: string;
  email: string;
  licenseNumber: string;
  logoUrl: string;
  prescriptionSettings: {
    headerHeight?: number;
    footerHeight?: number;
    showWatermark?: boolean;
    paperSize?: 'A5' | 'A4';
  };
  createdAt: string;
  updatedAt: string;
}

export interface ClinicLocation {
  locationId: string;
  nameAr: string;
  nameEn: string;
  addressAr: string;
  addressEn: string;
  phone: string;
  active: boolean;
  workingHours: Array<{
    day: number; // 0 = Sunday, 1 = Monday, etc.
    enabled: boolean;
    from: string; // e.g. "16:00"
    to: string;   // e.g. "22:00"
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * PATIENT: Master patient record.
 * Rule: fullName is the ONLY required field at creation. All other fields are optional.
 */
export interface Patient {
  patientId: string;
  fullName: string; // REQUIRED
  phone?: string;
  nationalId?: string;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: string | null;
  bloodType?: string;
  allergies?: string[];
  chronicDiseases?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;

  // Visual/Auxiliary helpers
  fileNumber?: number | string;
  medicalCode?: string;
  governorate?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relation: string;
  };

  // Clinical Aggregate Summary Fields (المؤشرات المجمعة)
  hasClinicalFile?: boolean;
  visitsCount?: number;
  lastVisitAt?: string;
  lastDiagnosis?: string;
}

export type AppointmentStatus = 'SCHEDULED' | 'ARRIVED' | 'CANCELLED' | 'NO_SHOW';

/**
 * APPOINTMENT: Future booking.
 * Crucial rule: Does NOT contain paymentId, invoiceId, or visitId at creation.
 */
export interface Appointment {
  appointmentId: string;
  patientId?: string | null;
  patientName?: string;
  phone?: string;
  clinicLocationId: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  visitType: string;     // e.g. 'كشف جديد', 'استشارة'
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export type VisitType = 'NEW' | 'FOLLOW_UP' | 'REVIEW' | 'OTHER';
export type VisitSource = 'APPOINTMENT' | 'WALK_IN';
export type VisitStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/**
 * VISIT: Central entity & single source of truth for the clinic floor.
 * Waiting Queue is a VIEW derived from visits where status == "WAITING".
 */
export interface Visit {
  visitId: string;
  patientId: string;
  appointmentId: string | null; // null if WALK_IN, actual appointmentId if APPOINTMENT
  clinicLocationId: string;
  visitType: VisitType;
  source: VisitSource;
  status: VisitStatus;
  queueNumber: number | null; // Daily sequence: 1, 2, 3...

  receptionistData: {
    symptoms: string;
    chronicDiseases: string[];
    notes: string;
  };

  clinicalData: {
    chiefComplaint: string;
    history: string;
    examination: string;
    diagnosis: string[];
    treatment: string;
  };

  vitalSigns: {
    bloodPressure: string;
    pulse: number | null;
    temperature: number | null;
    weight: number | null;
    height: number | null;
    oxygenSaturation: number | null;
    randomBloodSugar: number | null;
  };

  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  doctorId: string;
  dayKey?: string;
}

export type InvoiceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';

export interface InvoiceItem {
  serviceId: string;
  nameAr: string;
  nameEn?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  invoiceId: string;
  patientId: string;
  visitId: string;
  clinicLocationId: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  dayKey?: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
export type PaymentStatus = 'PAID' | 'REFUNDED' | 'VOID';

export interface Payment {
  paymentId: string;
  patientId: string;
  visitId: string;
  invoiceId: string;
  clinicLocationId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  receiptNumber: string;
  paidAt: string;
  receivedBy: string;
  dayKey?: string;
}

export interface ServiceItem {
  serviceId: string;
  nameAr: string;
  nameEn: string;
  price: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FollowUpStatus = 'UPCOMING' | 'TODAY' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED';

/**
 * FOLLOW-UP:
 * Snapshot rule: isFree and fee are saved at creation based on policy and doctor's decision.
 * Changes to clinic settings later will NOT retroactively alter past follow-ups.
 */
export interface FollowUp {
  followUpId: string;
  patientId: string;
  sourceVisitId: string;
  clinicLocationId: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: FollowUpStatus;
  fee: number;
  isFree: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  dayKey?: string;
}

/**
 * PRESCRIPTION ITEM SNAPSHOT:
 * Snapshot rule: Stores name and strength so catalog edits later never alter historical prescriptions.
 */
export interface PrescriptionItemSnapshot {
  medicationId: string | null; // null if custom medication entered for this prescription only
  name: string;
  strength: string;
  form: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  prescriptionId: string;
  patientId: string;
  visitId: string;
  doctorId: string;
  clinicLocationId: string;
  items: PrescriptionItemSnapshot[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  dayKey?: string;
}

export type MedicationSource = 'LOCAL' | 'EGYPTIAN_ARCHIVE' | 'CUSTOM';

export interface Medication {
  medicationId: string;
  nameAr: string;
  nameEn: string;
  genericName: string;
  strength: string;
  form: string;
  manufacturer: string;
  source: MedicationSource;
  active: boolean; // Soft Delete: active = false
  createdAt: string;
  updatedAt: string;
}

export interface LabTest {
  labTestId: string;
  nameAr: string;
  nameEn: string;
  category: string;
  active: boolean;
  sampleType?: string;
  referenceRange?: string;
  fastingRequired?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'ORDERED' | 'RESULT' | 'REPORT';

export interface LabOrder {
  labOrderId: string;
  patientId: string;
  visitId: string;
  testId: string | null;
  testName: string;
  status: OrderStatus; // ORDERED (طلب) | RESULT (نتيجة) | REPORT (تقرير)
  result: string;
  notes: string;
  orderedAt: string;
  updatedAt: string;
  dayKey?: string;
}

export interface RadiologyType {
  radiologyId: string;
  nameAr: string;
  nameEn: string;
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RadiologyOrder {
  radiologyOrderId: string;
  patientId: string;
  visitId: string;
  radiologyTypeId: string | null;
  radiologyName: string;
  status: OrderStatus; // ORDERED (طلب) | RESULT (نتيجة) | REPORT (تقرير)
  result: string;
  report: string;
  notes: string;
  orderedAt: string;
  updatedAt: string;
  dayKey?: string;
}

export interface Diagnosis {
  diagnosisId: string;
  nameAr: string;
  nameEn: string;
  code: string;
  codeSystem: 'ICD10';
  active: boolean;
  createdAt: string;
}

export interface Symptom {
  symptomId: string;
  nameAr: string;
  nameEn: string;
  category: string;
  active: boolean;
}

export interface ChronicDisease {
  diseaseId: string;
  nameAr: string;
  nameEn: string;
  category: string;
  active: boolean;
  color?: string;
}

export interface DoctorSettings {
  doctorNameAr?: string;
  doctorNameEn?: string;
  specialtyAr?: string;
  specialtyEn?: string;
  degreesAr?: string;
  degreesEn?: string;
  syndicateNumber?: string;
  licenseYear?: string;
  phone?: string;
  logoUrl?: string;
  favoriteMedicationIds: string[];
  favoriteLabTestIds: string[];
  favoriteRadiologyIds: string[];
  favoriteDiagnosisIds: string[];
  favoriteSymptomIds: string[];
  favoriteChronicDiseaseIds: string[];
}

export interface SystemSettings {
  general: {
    defaultLanguage: 'ar' | 'en';
    supportedLanguages: string[];
  };
  clinic: {
    nameAr: string;
    nameEn: string;
    phone: string;
    currency: string;
    taxNumber?: string;
  };
  financial: {
    consultationFee: number;
    followupFee: number;
    consultationDurationDays: number;
  };
  followUp: {
    enabled: boolean;
    defaultFree: boolean;
    defaultDurationDays: number;
    defaultFee: number;
  };
  prescription: {
    paperSize: 'A5' | 'A4';
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    showDoctorName: boolean;
    showSpecialty: boolean;
    showPhone: boolean;
    showLogo: boolean;
    footerAr: string;
    footerEn: string;
    showQr: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    primaryColor: string;
  };
  queue: {
    autoCallNext: boolean;
    showEstimatedWaitTime: boolean;
  };
}
