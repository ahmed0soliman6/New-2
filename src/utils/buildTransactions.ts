import type { TransactionRecord } from '../types';
import type { Invoice, Payment, Patient } from '../types/database';
import { formatAppTime } from './numberUtils';

export function buildTransactions(args: {
  payments: Payment[];
  invoices: Invoice[];
  patients: Patient[];
}): TransactionRecord[] {
  const { payments: paymentsCanonical, invoices: invoicesCanonical, patients: patientsCanonical } = args;
  const list: (TransactionRecord & { rawTimestamp: string })[] = [];
  const seenPaymentIds = new Set<string>();

  paymentsCanonical.forEach((p) => {
    seenPaymentIds.add(p.paymentId);
    const pat = patientsCanonical.find((pt) => pt.patientId === p.patientId);
    const inv = invoicesCanonical.find((i) => i.invoiceId === p.invoiceId);
    const serviceName = inv?.items?.[0]?.nameAr || (inv?.items?.[0] as any)?.description || 'كشف واستشارة طبية';
    const totalAmount = inv?.total || p.amount;
    const discountAmount = inv?.discount || 0;
    const paidAmount = p.amount;
    const rawIso = p.paidAt || (p as any).createdAt || new Date().toISOString();

    list.push({
      id: p.paymentId,
      receiptNo: p.receiptNumber || `REC-${p.paymentId.slice(-5)}`,
      receiptNumber: p.receiptNumber || `REC-${p.paymentId.slice(-5)}`,
      patientName: pat?.fullName || 'مريض مسجل',
      serviceName,
      description: serviceName,
      totalAmount,
      discountAmount,
      paidAmount,
      amount: paidAmount,
      type: 'in',
      paymentMethod: p.method === 'CARD' ? 'فيزا / كارت' : p.method === 'TRANSFER' ? 'إنستاباي' : 'نقدي',
      method: p.method === 'CARD' ? 'فيزا / كارت' : p.method === 'TRANSFER' ? 'إنستاباي' : 'نقدي',
      status: inv?.status === 'PAID' || paidAmount >= totalAmount ? 'مدفوعة' : 'غير مدفوعة',
      time: formatAppTime(rawIso),
      date: rawIso.includes('T') ? rawIso.split('T')[0] : rawIso,
      rawTimestamp: rawIso,
      category: 'كشوفات وخدمات طبية',
    });
  });

  // Also include any unpaid invoices that don't have a payment entry yet
  invoicesCanonical.forEach((inv) => {
    const hasPayment = paymentsCanonical.some((p) => p.invoiceId === inv.invoiceId);
    if (!hasPayment) {
      const pat = patientsCanonical.find((pt) => pt.patientId === inv.patientId);
      const serviceName = inv.items?.[0]?.nameAr || (inv.items?.[0] as any)?.description || 'كشف واستشارة طبية';
      const rawIso = inv.createdAt || new Date().toISOString();
      list.push({
        id: inv.invoiceId,
        receiptNo: `INV-${inv.invoiceId.slice(-5)}`,
        receiptNumber: `INV-${inv.invoiceId.slice(-5)}`,
        patientName: pat?.fullName || 'مريض مسجل',
        serviceName,
        description: serviceName,
        totalAmount: inv.total,
        discountAmount: inv.discount || 0,
        paidAmount: inv.paidAmount || 0,
        amount: inv.paidAmount || inv.total,
        type: 'in',
        paymentMethod: 'نقدي',
        method: 'نقدي',
        status: inv.status === 'PAID' ? 'مدفوعة' : 'غير مدفوعة',
        time: formatAppTime(rawIso),
        date: rawIso.includes('T') ? rawIso.split('T')[0] : rawIso,
        rawTimestamp: rawIso,
        category: 'فواتير كشوفات',
      });
    }
  });

  // Exact ISO timestamp descending sort: newest at the top
  return list.sort((a, b) => {
    const timeA = new Date(a.rawTimestamp).getTime();
    const timeB = new Date(b.rawTimestamp).getTime();
    if (!isNaN(timeB) && !isNaN(timeA) && timeB !== timeA) return timeB - timeA;
    return (b.id || '').localeCompare(a.id || '');
  });
}
