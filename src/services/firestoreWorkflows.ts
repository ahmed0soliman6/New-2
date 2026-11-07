import { supabase, clinicId } from './supabase';
import { notifyTableMutated, markTombstone } from './offlineSync';
import type {
  Appointment,
  Patient,
  PaymentMethod,
  PrescriptionItemSnapshot,
  OrderStatus,
  Visit,
} from '../types/database';
import { toDayKey, todayKey } from '../utils/dayKey';

export type Firestore = unknown;

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

function requireDb() {
  if (!supabase) {
    throw new Error('قاعدة البيانات غير متصلة حالياً. يرجى التحقق من إعدادات الاتصال بـ Supabase.');
  }
  return supabase;
}

function toArabicError(error: unknown, fallbackMessage: string): Error {
  const raw = error instanceof Error ? error.message : String((error as any)?.message || error || '');
  if (raw.includes('Appointment not found')) {
    return new Error('الموعد غير موجود في قاعدة البيانات.');
  }
  if (raw.includes('Only scheduled appointments can be checked in')) {
    return new Error('لا يمكن تسجيل الحضور إلا للمواعيد المجدولة فقط.');
  }
  if (raw.includes('Unauthorized') || raw.includes('caller must be an active doctor or admin')) {
    return new Error('غير مصرح لحسابك بتنفيذ هذه العملية الطبية.');
  }
  if (raw.includes('violates row-level security policy') || raw.includes('row-level security')) {
    return new Error('غير مصرح لحسابك بتعديل أو حذف هذه السجلات.');
  }
  return new Error(fallbackMessage);
}

/**
 * Strips all undefined fields recursively before JSONB serialization.
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value.constructor === Object
    ) {
      result[key] = removeUndefined(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const emptyClinicalData = {
  chiefComplaint: '',
  history: '',
  examination: '',
  diagnosis: [] as string[],
  treatment: '',
};

const emptyVitals = {
  bloodPressure: '',
  pulse: null,
  temperature: null,
  weight: null,
  height: null,
  oxygenSaturation: null,
  randomBloodSugar: null,
};

export async function checkInAppointmentTransaction(params: {
  db: Firestore;
  appointmentId: string;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  receivedBy: string;
  queueNumber?: number;
  receptionistData: Visit['receptionistData'];
}): Promise<{ appointment: Appointment; visit: Visit }> {
  const client = requireDb();
  const today = todayKey();
  const timestamp = now();
  const visitId = id('vis');
  const invoiceId = id('inv');
  const paymentId = id('pay');
  const receiptNumber = id('REC');

  const { data, error } = await client.rpc('check_in_appointment', {
    p_clinic_id: clinicId,
    p_appointment_id: params.appointmentId,
    p_today: today,
    p_timestamp: timestamp,
    p_requested_queue_number: params.queueNumber && params.queueNumber > 0 ? params.queueNumber : null,
    p_visit_id: visitId,
    p_invoice_id: invoiceId,
    p_payment_id: paymentId,
    p_receipt_number: receiptNumber,
    p_payment_amount: Number(params.paymentAmount) || 0,
    p_payment_method: params.paymentMethod,
    p_received_by: params.receivedBy,
    p_receptionist_data: removeUndefined(
      params.receptionistData || { symptoms: '', chronicDiseases: [], notes: '' }
    ),
  });

  if (error || !data) {
    throw toArabicError(error, 'تعذر تسجيل حضور الموعد في قاعدة البيانات');
  }

  const payload = data as { appointment: Appointment; visit: Visit };
  notifyTableMutated(['appointments', 'visits', 'invoices', 'payments'], false);
  return {
    appointment: payload.appointment,
    visit: payload.visit,
  };
}

export async function registerWalkInTransaction(params: {
  db: Firestore;
  patient: Patient;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  receivedBy: string;
  clinicLocationId: string;
  queueNumber?: number;
  appointmentId?: string | null;
  receptionistData: Visit['receptionistData'];
}): Promise<Visit> {
  const client = requireDb();
  const today = todayKey();
  const timestamp = now();
  const visitId = id('vis');
  const invoiceId = id('inv');
  const paymentId = id('pay');
  const receiptNumber = id('REC');

  const sanitizedPatient = removeUndefined({
    ...params.patient,
    createdAt: params.patient.createdAt || timestamp,
    updatedAt: timestamp,
  });

  const { data, error } = await client.rpc('register_walk_in', {
    p_clinic_id: clinicId,
    p_today: today,
    p_timestamp: timestamp,
    p_requested_queue_number: params.queueNumber && params.queueNumber > 0 ? params.queueNumber : null,
    p_patient_id: params.patient.patientId,
    p_patient_data: sanitizedPatient,
    p_visit_id: visitId,
    p_invoice_id: invoiceId,
    p_payment_id: paymentId,
    p_receipt_number: receiptNumber,
    p_payment_amount: Number(params.paymentAmount) || 0,
    p_payment_method: params.paymentMethod,
    p_received_by: params.receivedBy,
    p_clinic_location_id: params.clinicLocationId,
    p_appointment_id: params.appointmentId || null,
    p_receptionist_data: removeUndefined(
      params.receptionistData || { symptoms: '', chronicDiseases: [], notes: '' }
    ),
  });

  if (error || !data) {
    throw toArabicError(error, 'تعذر تسجيل زيارة المريض في قاعدة البيانات');
  }

  notifyTableMutated(['patients', 'visits', 'invoices', 'payments', 'appointments'], false);
  return data as Visit;
}

export async function startVisitTransaction(_db: Firestore, visitId: string, doctorId: string): Promise<void> {
  const client = requireDb();
  const timestamp = now();

  const { data: row, error: fetchError } = await client
    .from('visits')
    .select('data')
    .eq('clinic_id', clinicId)
    .eq('id', visitId)
    .maybeSingle();

  if (fetchError) {
    throw toArabicError(fetchError, 'تعذر قراءة بيانات الزيارة لبدء الكشف');
  }
  if (!row || !row.data) {
    throw new Error('لم يتم العثور على الزيارة في قاعدة البيانات لبدء الكشف.');
  }

  const existing = row.data as Record<string, any>;
  const updatedData =
    existing.status === 'IN_PROGRESS'
      ? {
          ...existing,
          doctorId: doctorId || existing.doctorId || '',
          updatedAt: timestamp,
        }
      : {
          ...existing,
          status: 'IN_PROGRESS',
          startedAt: timestamp,
          doctorId,
          updatedAt: timestamp,
        };

  const { error: updateError } = await client
    .from('visits')
    .update({ data: updatedData, updated_at: timestamp })
    .eq('clinic_id', clinicId)
    .eq('id', visitId);

  if (updateError) {
    throw toArabicError(updateError, 'تعذر تحديث حالة الزيارة لبدء الكشف');
  }
  notifyTableMutated(['visits'], false);
}

export async function completeVisitTransaction(params: {
  db: Firestore;
  visitId: string;
  doctorId: string;
  clinicalData: Visit['clinicalData'];
  vitalSigns: Visit['vitalSigns'];
  prescriptionItems?: PrescriptionItemSnapshot[];
  prescriptionNotes?: string;
  labOrders?: Array<{
    testId?: string | null;
    testName: string;
    notes?: string;
    status?: OrderStatus;
    result?: string;
  }>;
  radiologyOrders?: Array<{
    radiologyTypeId?: string | null;
    radiologyName: string;
    notes?: string;
    status?: OrderStatus;
    result?: string;
    report?: string;
  }>;
  followUp?: { scheduledDate: string; fee: number; isFree: boolean; notes: string } | null;
}) {
  const client = requireDb();
  const timestamp = now();
  const day = todayKey();

  const { data: visitRow, error: visitFetchError } = await client
    .from('visits')
    .select('data')
    .eq('clinic_id', clinicId)
    .eq('id', params.visitId)
    .maybeSingle();

  if (visitFetchError) {
    throw toArabicError(visitFetchError, 'تعذر قراءة بيانات الزيارة لإتمام الكشف');
  }
  if (!visitRow || !visitRow.data) {
    throw new Error('لم يتم العثور على الزيارة في قاعدة البيانات لإتمام الكشف.');
  }

  const visitData = visitRow.data as Visit;
  const clinicLocationId = visitData.clinicLocationId || null;
  const resolvedVisitId = visitData.visitId || params.visitId;

  const prescriptionPayload =
    params.prescriptionItems && params.prescriptionItems.length > 0
      ? (() => {
          const rxId = `rx-${resolvedVisitId}`;
          return removeUndefined({
            prescriptionId: rxId,
            patientId: visitData.patientId,
            visitId: resolvedVisitId,
            doctorId: params.doctorId,
            clinicLocationId,
            items: params.prescriptionItems,
            notes: params.prescriptionNotes || '',
            createdAt: timestamp,
            updatedAt: timestamp,
            dayKey: day,
          });
        })()
      : null;

  const labOrdersPayload =
    params.labOrders && params.labOrders.length > 0
      ? params.labOrders.map((lab, idx) => {
          const labOrderId = `lab-ord-${resolvedVisitId}-${idx + 1}`;
          const resolvedStatus = lab.status || (lab.result ? 'RESULT' : 'ORDERED');
          return removeUndefined({
            labOrderId,
            patientId: visitData.patientId,
            visitId: resolvedVisitId,
            testId: lab.testId || null,
            testName: lab.testName,
            status: resolvedStatus,
            result: lab.result || '',
            notes: lab.notes || '',
            orderedAt: timestamp,
            updatedAt: timestamp,
            dayKey: day,
          });
        })
      : [];

  const radiologyOrdersPayload =
    params.radiologyOrders && params.radiologyOrders.length > 0
      ? params.radiologyOrders.map((rad, idx) => {
          const radOrderId = `rad-ord-${resolvedVisitId}-${idx + 1}`;
          const resolvedStatus = rad.status || (rad.report ? 'REPORT' : rad.result ? 'RESULT' : 'ORDERED');
          return removeUndefined({
            radiologyOrderId: radOrderId,
            patientId: visitData.patientId,
            visitId: resolvedVisitId,
            radiologyTypeId: rad.radiologyTypeId || null,
            radiologyName: rad.radiologyName,
            status: resolvedStatus,
            result: rad.result || '',
            report: rad.report || '',
            notes: rad.notes || '',
            orderedAt: timestamp,
            updatedAt: timestamp,
            dayKey: day,
          });
        })
      : [];

  const followUpPayload = params.followUp
    ? (() => {
        const followUpId = `fol-${resolvedVisitId}`;
        return removeUndefined({
          followUpId,
          patientId: visitData.patientId,
          sourceVisitId: resolvedVisitId,
          clinicLocationId,
          scheduledDate: params.followUp.scheduledDate,
          scheduledTime: null,
          status: 'UPCOMING' as const,
          fee: params.followUp.fee,
          isFree: params.followUp.isFree,
          notes: params.followUp.notes || '',
          createdAt: timestamp,
          updatedAt: timestamp,
          dayKey: day,
        });
      })()
    : null;

  // Note: complete_visit RPC (SECURITY DEFINER) atomically cleans up previous visit clinical records
  try {
    await Promise.all([
      client.from('prescriptions').delete().eq('clinic_id', clinicId).eq('data->>visitId', resolvedVisitId),
      client.from('lab_orders').delete().eq('clinic_id', clinicId).eq('data->>visitId', resolvedVisitId),
      client.from('radiology_orders').delete().eq('clinic_id', clinicId).eq('data->>visitId', resolvedVisitId),
      client.from('follow_ups').delete().eq('clinic_id', clinicId).eq('data->>sourceVisitId', resolvedVisitId),
    ]);
  } catch {
    // Handled inside complete_visit RPC
  }

  const { error } = await client.rpc('complete_visit', {
    p_clinic_id: clinicId,
    p_visit_id: params.visitId,
    p_doctor_id: params.doctorId,
    p_timestamp: timestamp,
    p_clinical_data: removeUndefined(params.clinicalData || emptyClinicalData),
    p_vital_signs: removeUndefined(params.vitalSigns || emptyVitals),
    p_prescription: prescriptionPayload,
    p_lab_orders: labOrdersPayload,
    p_radiology_orders: radiologyOrdersPayload,
    p_follow_up: followUpPayload,
  });

  if (error) {
    throw toArabicError(error, 'تعذر حفظ بيانات الكشف والروشتة في قاعدة البيانات');
  }

  notifyTableMutated(['visits', 'patients', 'prescriptions', 'lab_orders', 'radiology_orders', 'follow_ups'], false);

  return {
    visitId: resolvedVisitId,
    timestamp,
    prescriptionPayload,
    labOrdersPayload,
    radiologyOrdersPayload,
    followUpPayload,
  };
}

export async function createAppointmentTransaction(params: {
  db: Firestore;
  patient?: Patient | null;
  appointment: Appointment;
}): Promise<void> {
  const client = requireDb();
  const timestamp = now();

  const sanitizedPatient =
    params.patient && params.patient.patientId
      ? removeUndefined({
          ...params.patient,
          createdAt: params.patient.createdAt || timestamp,
          updatedAt: timestamp,
        })
      : null;

  const sanitizedAppointment = removeUndefined({
    ...params.appointment,
    patientId: params.appointment.patientId || params.patient?.patientId || '',
    dayKey: (params.appointment as any).dayKey || toDayKey(params.appointment.scheduledDate || new Date()),
    createdAt: params.appointment.createdAt || timestamp,
    updatedAt: timestamp,
  });

  const { error } = await client.rpc('create_appointment', {
    p_clinic_id: clinicId,
    p_timestamp: timestamp,
    p_appointment_id: params.appointment.appointmentId,
    p_appointment_data: sanitizedAppointment,
    p_patient_id: params.patient?.patientId || null,
    p_patient_data: sanitizedPatient,
  });

  if (error) {
    throw toArabicError(error, 'تعذر حفظ الموعد في قاعدة البيانات');
  }
  notifyTableMutated(['appointments', 'patients'], false);
}

export async function deleteAppointmentTransaction(_db: Firestore, appointmentId: string): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from('appointments')
    .delete()
    .eq('clinic_id', clinicId)
    .eq('id', appointmentId);

  if (error) {
    throw toArabicError(error, 'تعذر حذف الموعد من قاعدة البيانات');
  }
  await markTombstone('appointments', appointmentId, clinicId);
  notifyTableMutated(['appointments'], true);
}

export async function deletePatientTransaction(_db: Firestore, patientId: string): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from('patients')
    .delete()
    .eq('clinic_id', clinicId)
    .eq('id', patientId);

  if (error) {
    throw toArabicError(error, 'تعذر حذف ملف المريض من قاعدة البيانات');
  }
  await markTombstone('patients', patientId, clinicId);
  notifyTableMutated(['patients'], true);
}

