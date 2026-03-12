import { Contact, Product, Invoice, Project, Employee, User, Role, Permission, LeaveRequest, Payslip, Contract, ContractTemplate, QuoteTemplate } from './types';

export const MOCK_CONTACTS: Contact[] = [
  { id: '1', name: 'Jean Dupont', email: 'jean@dupont.fr', phone: '0123456789', company: 'Dupont SA', status: 'Client', lastContact: '2024-03-10' },
  { id: '2', name: 'Marie Curie', email: 'marie@science.org', phone: '0987654321', company: 'Labo X', status: 'Lead', lastContact: '2024-03-05' },
  { id: '3', name: 'Paul Martin', email: 'paul@martin.com', phone: '0612345678', company: 'Martin & Co', status: 'Partner', lastContact: '2024-02-28' },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'Laptop Pro 15"', sku: 'LP15-001', price: 1200, stock: 15, category: 'Hardware', description: 'Powerful laptop for professionals', type: 'product', tvaRate: 0.20 },
  { id: '2', name: 'Écran 27" 4K', sku: 'MON-27-4K', price: 450, stock: 8, category: 'Hardware', description: 'High resolution monitor', type: 'product', tvaRate: 0.18 },
  { id: '3', name: 'Licence Logiciel SaaS', sku: 'SOFT-SAAS-01', price: 99, stock: 999, category: 'Software', description: 'Annual subscription', type: 'service', tvaRate: 0.05 },
];

export const MOCK_INVOICES: Invoice[] = [
  { 
    id: 'INV-2024-001', 
    type: 'Invoice', 
    contactId: '1', 
    date: '2024-03-01', 
    dueDate: '2024-03-15', 
    items: [{ productId: '1', name: 'Laptop Pro 15"', quantity: 1, price: 1200, tvaRate: 0.20, tvaAmount: 240 }], 
    totalHT: 1200,
    tvaTotal: 240,
    total: 1440, 
    status: 'Paid' 
  },
  { 
    id: 'INV-2024-002', 
    type: 'Invoice', 
    contactId: '2', 
    date: '2024-03-05', 
    dueDate: '2024-03-20', 
    items: [{ productId: '2', name: 'Écran 27" 4K', quantity: 2, price: 450, tvaRate: 0.18, tvaAmount: 162 }], 
    totalHT: 900,
    tvaTotal: 162,
    total: 1062, 
    status: 'Sent' 
  },
  { 
    id: 'DEV-2024-001', 
    type: 'Quote', 
    contactId: '3', 
    date: '2024-03-10', 
    dueDate: '2024-04-10', 
    items: [{ productId: '3', name: 'Licence Logiciel SaaS', quantity: 5, price: 99, tvaRate: 0.05, tvaAmount: 24.75 }], 
    totalHT: 495,
    tvaTotal: 24.75,
    total: 519.75, 
    status: 'Sent' 
  },
];

export const MOCK_PROJECTS: Project[] = [
  { id: '1', name: 'Refonte Site Web', client: 'Dupont SA', status: 'In Progress', deadline: '2024-05-01', progress: 45, description: 'Refonte complète du site web', details: 'Utilisation de React et Tailwind CSS' },
  { id: '2', name: 'Migration Cloud', client: 'Labo X', status: 'Planning', deadline: '2024-06-15', progress: 10, description: 'Migration vers AWS', details: 'Déploiement des serveurs sur AWS' },
];

export const MOCK_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Alice Bernard', role: 'Développeur Senior', department: 'IT', email: 'alice@smartdesk.com', phone: '0601020304', address: '1 rue de Paris', status: 'Active', contractType: 'CDI', joinDate: '2022-01-15', salary: 550000 },
  { id: '2', name: 'Bob Leroy', role: 'Commercial', department: 'Sales', email: 'bob@smartdesk.com', phone: '0708091011', address: '2 rue de Lyon', status: 'Active', contractType: 'CDI', joinDate: '2023-03-01', salary: 420000 },
];

export const MOCK_LEAVES: LeaveRequest[] = [
  { id: '1', employeeId: '1', type: 'Annual', startDate: '2024-04-01', endDate: '2024-04-10', status: 'Approved', reason: 'Vacances annuelles' },
  { id: '2', employeeId: '2', type: 'Sick', startDate: '2024-03-15', endDate: '2024-03-17', status: 'Pending', reason: 'Grippe' },
];

export const MOCK_PAYSLIPS: Payslip[] = [
  { id: '1', employeeId: '1', month: 'Mars', year: 2024, baseSalary: 45000, bonuses: 5000, deductions: 2000, netSalary: 48000, status: 'Paid' },
  { id: '2', employeeId: '2', month: 'Mars', year: 2024, baseSalary: 35000, bonuses: 2000, deductions: 1500, netSalary: 35500, status: 'Draft' },
];

export const MOCK_CONTRACTS: Contract[] = [
  { 
    id: 'CTR-2024-001', 
    employeeId: '1', 
    type: 'CDI', 
    startDate: '2022-01-15', 
    salary: 550000, 
    status: 'Active', 
    content: 'Contrat de travail à durée indéterminée pour Alice Bernard...',
    createdAt: '2022-01-10'
  },
  { 
    id: 'CTR-2024-002', 
    employeeId: '2', 
    type: 'CDD', 
    startDate: '2023-03-01', 
    endDate: '2024-03-01',
    salary: 420000, 
    status: 'Sent', 
    content: 'Contrat de travail à durée déterminée pour Bob Leroy...',
    createdAt: '2023-02-20'
  },
];

export const MOCK_CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'TMP-001',
    name: 'Modèle CDI Standard',
    type: 'CDI',
    content: 'CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE\n\nEntre les soussignés :\nLa société SMARTDesk Congo...\nEt M/Mme [NOM_EMPLOYE]...\n\nArticle 1 : Fonctions...\nArticle 2 : Rémunération...',
    lastModified: '2024-01-05'
  },
  {
    id: 'TMP-002',
    name: 'Modèle CDD Projet',
    type: 'CDD',
    content: 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE\n\nMotif du recours : Accroissement temporaire d\'activité...\n\nArticle 1 : Durée du contrat...\nArticle 2 : Missions...',
    lastModified: '2024-02-12'
  }
];

export const MOCK_QUOTE_TEMPLATES: QuoteTemplate[] = [
  {
    id: 'QT-001',
    name: 'Devis Prestation Informatique',
    items: [
      { productId: '3', name: 'Licence Logiciel SaaS', quantity: 1, price: 99, tvaRate: 0.05, tvaAmount: 4.95 }
    ],
    notes: 'Merci de votre confiance. Validité du devis : 30 jours.',
    lastModified: '2024-03-01'
  },
  {
    id: 'QT-002',
    name: 'Devis Équipement Bureau',
    items: [
      { productId: '1', name: 'Laptop Pro 15"', quantity: 1, price: 1200, tvaRate: 0.20, tvaAmount: 240 },
      { productId: '2', name: 'Écran 27" 4K', quantity: 1, price: 450, tvaRate: 0.18, tvaAmount: 81 }
    ],
    notes: 'Livraison incluse sous 5 jours ouvrés.',
    lastModified: '2024-03-05'
  }
];

export const MOCK_COMPANY = {
  name: 'SmartDesk Congo SARL',
  address: "Avenue de la Paix, Brazzaville, République du Congo",
  email: 'contact@smartdesk-congo.cg',
  phone: '+242 06 600 00 00',
  website: 'https://smartdesk-congo.cg',
  taxId: 'NIF: 1234567A',
  rccm: 'RCCM: CG-BZV-01-2024-B12-00001',
  idNat: 'ID NAT: 01-123-A4567B',
};

export const MOCK_ROLES: Role[] = [
  { id: '1', name: 'Administrateur', permissions: ['all'] },
  { id: '2', name: 'Manager', permissions: ['crm.view', 'crm.edit', 'sales.view', 'sales.edit', 'inventory.view'] },
  { id: '3', name: 'Commercial', permissions: ['crm.view', 'crm.edit', 'sales.view'] },
];

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@smartdesk.cg', roleId: '1', status: 'Active', lastLogin: '2024-03-12 09:00' },
  { id: '2', name: 'Jean Mvoula', email: 'jean.mvoula@smartdesk.cg', roleId: '2', status: 'Active', lastLogin: '2024-03-11 15:30' },
  { id: '3', name: 'Marie Oko', email: 'marie.oko@smartdesk.cg', roleId: '3', status: 'Active', lastLogin: '2024-03-12 08:45' },
];

export const MOCK_PERMISSIONS: Permission[] = [
  { id: 'crm.view', name: 'Voir CRM', description: 'Accès en lecture au module CRM', module: 'CRM' },
  { id: 'crm.edit', name: 'Modifier CRM', description: 'Accès en écriture au module CRM', module: 'CRM' },
  { id: 'sales.view', name: 'Voir Ventes', description: 'Accès en lecture au module Ventes', module: 'Ventes' },
  { id: 'sales.edit', name: 'Modifier Ventes', description: 'Accès en écriture au module Ventes', module: 'Ventes' },
  { id: 'inventory.view', name: 'Voir Stocks', description: 'Accès en lecture au module Stocks', module: 'Stocks' },
  { id: 'hr.view', name: 'Voir RH', description: 'Accès en lecture au module RH', module: 'RH' },
  { id: 'accounting.view', name: 'Voir Comptabilité', description: 'Accès en lecture au module Comptabilité', module: 'Comptabilité' },
];

export const DEMO_ACCOUNTS = [
  { email: 'admin@smartdesk.cg', password: 'admin', name: 'Admin User', role: 'Administrateur' },
  { email: 'manager@smartdesk.cg', password: 'manager', name: 'Jean Mvoula', role: 'Manager' },
  { email: 'sales@smartdesk.cg', password: 'sales', name: 'Marie Oko', role: 'Commercial' },
];
