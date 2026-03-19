export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  companyId?: string;
  role?: string;
  notes?: string;
  status: 'Lead' | 'Client' | 'Partner';
  lastContact: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  description?: string;
  type: 'product' | 'service';
  tvaRate: number;
}

export interface Invoice {
  id: string;
  type: 'Invoice' | 'Quote';
  contactId: string;
  date: string;
  dueDate: string;
  description?: string;
  items: { 
    productId: string; 
    quantity: number; 
    price: number; 
    name?: string; 
    description?: string;
    tvaRate?: number;
    tvaAmount?: number;
  }[];
  totalHT: number;
  tvaTotal: number;
  total: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Accepted' | 'Rejected' | 'Signed';
  notes?: string;
  signatureLink?: string;
  signedAt?: string;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  items: { 
    productId: string; 
    quantity: number; 
    price: number; 
    name?: string; 
    description?: string;
    tvaRate?: number;
    tvaAmount?: number;
  }[];
  notes?: string;
  lastModified: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  contactId?: string;
  status: 'Planning' | 'In Progress' | 'Completed' | 'On Hold';
  deadline: string;
  startDate?: string;
  progress: number;
  description?: string;
  details?: string;
  priority?: 'Low' | 'Medium' | 'High';
  budget?: number;
  teamIds?: string[];
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  address: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  contractType: 'CDI' | 'CDD' | 'Freelance';
  joinDate: string;
  salary: number;
  profilePicture?: string;
  documents?: { name: string; url: string }[];
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: 'Annual' | 'Sick' | 'Maternity' | 'Other';
  startDate: string;
  endDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason?: string;
}

export interface Payslip {
  id: string;
  employeeId: string;
  month: string;
  year: number;
  baseSalary: number;
  bonuses: number;
  deductions: number;
  netSalary: number;
  status: 'Draft' | 'Paid';
}

export interface Contract {
  id: string;
  employeeId: string;
  type: 'CDI' | 'CDD' | 'Freelance' | 'Stage';
  startDate: string;
  endDate?: string;
  salary: number;
  status: 'Draft' | 'Active' | 'Terminated' | 'Sent' | 'Signed';
  content: string;
  createdAt: string;
  signatureLink?: string;
  signedAt?: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  type: 'CDI' | 'CDD' | 'Freelance' | 'Stage';
  content: string;
  lastModified: string;
}

export interface EmployeeTask {
  id: string;
  employeeId: string;
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  status: 'Todo' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High';
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: 'Income' | 'Expense';
}

export interface Account {
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
}

export interface JournalEntryItem {
  accountId: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  items: JournalEntryItem[];
}

export interface Company {
  id: string;
  name: string;
  type: 'demo' | 'real';
  logo?: string;
  industry?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface CompanyInfo {
  name: string;
  type?: string;
  status?: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  taxId: string; // NIF
  rccm: string;
  idNat: string;
  siren?: string;
  siret?: string;
  country?: string;
  logo?: string;
  language?: string;
  currency?: string;
  accountingStandard?: 'OHADA' | 'US_GAAP' | 'FRANCE';
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  status: 'Active' | 'Inactive';
  lastLogin?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
}
