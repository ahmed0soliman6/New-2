import { db } from '../services/firebase';
import { safeStorage, StorageKeys } from '../services/storage';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

export interface MedicalServiceItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  active?: boolean;
}

export interface ExpenseCategoryItem {
  id: string;
  name: string;
}

export interface ClinicExpenseRecord {
  id: string;
  category: string;
  amount: number;
  date: string;
  time?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export const DEFAULT_MEDICAL_SERVICES: MedicalServiceItem[] = [
  { id: 'srv-1', name: 'كشف واستشارة طبية', price: 300, category: 'كشوفات' },
  { id: 'srv-2', name: 'عمل رسم قلب', price: 150, category: 'فحوصات' },
  { id: 'srv-3', name: 'خياطة جرح', price: 200, category: 'إجراءات جراحية' },
  { id: 'srv-4', name: 'عمل جبيرة', price: 250, category: 'عظام وإصابات' },
  { id: 'srv-5', name: 'غيار جروح وتعقيم', price: 100, category: 'تمريض وعناية' },
  { id: 'srv-6', name: 'سونار وفحص موجات صوتية', price: 250, category: 'تصوير طبي' },
  { id: 'srv-7', name: 'جلسة علاج طبيعي', price: 180, category: 'علاج طبيعي' },
  { id: 'srv-8', name: 'قياس ضغط وسكر وتخطيط سريع', price: 50, category: 'فحوصات أولية' },
];

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryItem[] = [
  { id: 'exp-cat-1', name: 'فاتورة كهرباء' },
  { id: 'exp-cat-2', name: 'فاتورة إنترنت' },
  { id: 'exp-cat-3', name: 'إيجار العيادة' },
  { id: 'exp-cat-4', name: 'رواتب الموظفين' },
  { id: 'exp-cat-5', name: 'صيانة ومستلزمات' },
  { id: 'exp-cat-6', name: 'صيانة أجهزة' },
  { id: 'exp-cat-7', name: 'شراء شاش ومستهلكات طبية' },
];

export const DEFAULT_CLINIC_EXPENSES: ClinicExpenseRecord[] = [
  {
    id: 'exp-101',
    category: 'فاتورة كهرباء',
    amount: 450,
    date: '2026-09-07',
    time: '02:30 م',
    notes: 'سداد فاتورة كهرباء شهر سبتمبر',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'exp-102',
    category: 'صيانة ومستلزمات',
    amount: 250,
    date: '2026-09-08',
    time: '11:15 ص',
    notes: 'شراء أدوات نظافة ومطهرات للعيادة',
    createdAt: new Date().toISOString(),
  },
];

let cachedServices: MedicalServiceItem[] = DEFAULT_MEDICAL_SERVICES;
let cachedExpenseCategories: ExpenseCategoryItem[] = DEFAULT_EXPENSE_CATEGORIES;
let cachedClinicExpenses: ClinicExpenseRecord[] = DEFAULT_CLINIC_EXPENSES;

// ==========================================
// 1. Medical Services (الوارد والخدمات الطبية والتسعير)
// ==========================================
export function loadMedicalServices(): MedicalServiceItem[] {
  const saved = safeStorage.getJSON<MedicalServiceItem[] | null>(StorageKeys.SERVICES, null);
  if (Array.isArray(saved) && saved.length > 0) {
    cachedServices = saved;
    return saved;
  }
  return cachedServices;
}

export function getActiveVisitTypes(): { id: string; name: string; fee: number; price: number }[] {
  const services = loadMedicalServices();
  const list = services
    .filter((s) => s.active !== false)
    .map((s) => ({
      id: s.id,
      name: s.name,
      fee: s.price,
      price: s.price,
    }));

  const uniqueMap = new Map<string, { id: string; name: string; fee: number; price: number }>();
  list.forEach((item) => {
    if (item && (item.id || item.name)) {
      uniqueMap.set(item.id || item.name, item);
    }
  });
  return Array.from(uniqueMap.values());
}

export function setCachedMedicalServices(services: MedicalServiceItem[]) {
  if (Array.isArray(services)) {
    cachedServices = services;
    safeStorage.setJSON(StorageKeys.SERVICES, services);
    window.dispatchEvent(new CustomEvent('soli_services_updated', { detail: services }));
  }
}

export function saveMedicalServices(services: MedicalServiceItem[]) {
  cachedServices = services;
  safeStorage.setJSON(StorageKeys.SERVICES, services);
  window.dispatchEvent(new CustomEvent('soli_services_updated', { detail: services }));
}

export function addMedicalService(service: MedicalServiceItem): MedicalServiceItem[] {
  cachedServices = [service, ...cachedServices.filter((s) => s.id !== service.id)];
  saveMedicalServices(cachedServices);
  if (db) {
    setDoc(doc(db, 'services', service.id), service).catch((err) =>
      console.warn('Firestore service sync error:', err)
    );
  }
  return cachedServices;
}

export function removeMedicalService(id: string): MedicalServiceItem[] {
  cachedServices = cachedServices.filter((s) => s.id !== id);
  saveMedicalServices(cachedServices);
  if (db) {
    deleteDoc(doc(db, 'services', id)).catch((err) =>
      console.warn('Firestore service delete error:', err)
    );
  }
  return cachedServices;
}

export function updateMedicalService(id: string, updates: Partial<MedicalServiceItem>): MedicalServiceItem[] {
  cachedServices = cachedServices.map((s) => (s.id === id ? { ...s, ...updates } : s));
  saveMedicalServices(cachedServices);
  if (db) {
    const target = cachedServices.find((s) => s.id === id);
    if (target) {
      setDoc(doc(db, 'services', id), target, { merge: true }).catch((err) =>
        console.warn('Firestore service update error:', err)
      );
    }
  }
  return cachedServices;
}

// ==========================================
// 2. Expense Categories (بنود المنصرف)
// ==========================================
export function loadExpenseCategories(): ExpenseCategoryItem[] {
  const saved = safeStorage.getJSON<ExpenseCategoryItem[] | null>(StorageKeys.EXPENSE_CATEGORIES, null);
  if (Array.isArray(saved) && saved.length > 0) {
    cachedExpenseCategories = saved;
    return saved;
  }
  return cachedExpenseCategories;
}

export function setCachedExpenseCategories(categories: ExpenseCategoryItem[]) {
  if (Array.isArray(categories)) {
    cachedExpenseCategories = categories;
    safeStorage.setJSON(StorageKeys.EXPENSE_CATEGORIES, categories);
    window.dispatchEvent(new CustomEvent('soli_expense_categories_updated', { detail: categories }));
  }
}

export function saveExpenseCategories(categories: ExpenseCategoryItem[]) {
  cachedExpenseCategories = categories;
  safeStorage.setJSON(StorageKeys.EXPENSE_CATEGORIES, categories);
  window.dispatchEvent(new CustomEvent('soli_expense_categories_updated', { detail: categories }));
}

export function addExpenseCategory(name: string): ExpenseCategoryItem[] {
  const cleanName = name.trim();
  if (!cleanName) return cachedExpenseCategories;
  if (cachedExpenseCategories.some((c) => c.name === cleanName)) return cachedExpenseCategories;
  const newItem: ExpenseCategoryItem = {
    id: `exp-cat-${Date.now()}`,
    name: cleanName,
  };
  cachedExpenseCategories = [...cachedExpenseCategories, newItem];
  saveExpenseCategories(cachedExpenseCategories);
  if (db) {
    setDoc(doc(db, 'expenseCategories', newItem.id), newItem).catch((err) =>
      console.warn('Firestore expense category sync error:', err)
    );
  }
  return cachedExpenseCategories;
}

export function removeExpenseCategory(id: string): ExpenseCategoryItem[] {
  cachedExpenseCategories = cachedExpenseCategories.filter((c) => c.id !== id && c.name !== id);
  saveExpenseCategories(cachedExpenseCategories);
  if (db) {
    deleteDoc(doc(db, 'expenseCategories', id)).catch((err) =>
      console.warn('Firestore expense category delete error:', err)
    );
  }
  return cachedExpenseCategories;
}

// ==========================================
// 3. Clinic Expenses (المنصرف والمصروفات المسجلة)
// ==========================================
export function loadClinicExpenses(): ClinicExpenseRecord[] {
  const saved = safeStorage.getJSON<ClinicExpenseRecord[] | null>(StorageKeys.EXPENSES, null);
  if (Array.isArray(saved) && saved.length > 0) {
    cachedClinicExpenses = saved;
    return saved;
  }
  return cachedClinicExpenses;
}

export function setCachedClinicExpenses(expenses: ClinicExpenseRecord[]) {
  if (Array.isArray(expenses)) {
    cachedClinicExpenses = expenses;
    safeStorage.setJSON(StorageKeys.EXPENSES, expenses);
    window.dispatchEvent(new CustomEvent('soli_clinic_expenses_updated', { detail: expenses }));
  }
}

export function saveClinicExpenses(expenses: ClinicExpenseRecord[]) {
  cachedClinicExpenses = expenses;
  safeStorage.setJSON(StorageKeys.EXPENSES, expenses);
  window.dispatchEvent(new CustomEvent('soli_clinic_expenses_updated', { detail: expenses }));
}

export function addClinicExpense(expense: ClinicExpenseRecord): ClinicExpenseRecord[] {
  cachedClinicExpenses = [expense, ...cachedClinicExpenses.filter((e) => e.id !== expense.id)];
  saveClinicExpenses(cachedClinicExpenses);
  if (db) {
    const cleanedExpense = Object.fromEntries(
      Object.entries(expense).filter(([_, v]) => v !== undefined)
    );
    setDoc(doc(db, 'expenses', expense.id), cleanedExpense).catch((err) =>
      console.warn('Firestore expense sync error:', err)
    );
  }
  return cachedClinicExpenses;
}

export function removeClinicExpense(id: string): ClinicExpenseRecord[] {
  cachedClinicExpenses = cachedClinicExpenses.filter((e) => e.id !== id);
  saveClinicExpenses(cachedClinicExpenses);
  if (db) {
    deleteDoc(doc(db, 'expenses', id)).catch((err) =>
      console.warn('Firestore expense delete error:', err)
    );
  }
  return cachedClinicExpenses;
}
