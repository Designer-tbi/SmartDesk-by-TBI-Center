import { Role, Permission } from './types.js';

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
