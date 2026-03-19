import { Role, Permission } from './types';

export const MOCK_PERMISSIONS: Permission[] = [
  // CRM
  { id: 'crm.view', name: 'Voir CRM', description: 'Accès en lecture au module CRM', module: 'CRM' },
  { id: 'crm.edit', name: 'Modifier CRM', description: 'Créer et modifier des contacts/projets', module: 'CRM' },
  { id: 'crm.delete', name: 'Supprimer CRM', description: 'Supprimer des contacts/projets', module: 'CRM' },
  
  // Ventes
  { id: 'sales.view', name: 'Voir Ventes', description: 'Accès en lecture au module Ventes', module: 'Ventes' },
  { id: 'sales.edit', name: 'Modifier Ventes', description: 'Créer et modifier des devis/factures', module: 'Ventes' },
  { id: 'sales.delete', name: 'Supprimer Ventes', description: 'Supprimer des devis/factures', module: 'Ventes' },
  
  // Stocks
  { id: 'inventory.view', name: 'Voir Stocks', description: 'Accès en lecture au module Stocks', module: 'Stocks' },
  { id: 'inventory.edit', name: 'Modifier Stocks', description: 'Créer et modifier des produits', module: 'Stocks' },
  { id: 'inventory.delete', name: 'Supprimer Stocks', description: 'Supprimer des produits', module: 'Stocks' },
  
  // RH
  { id: 'hr.view', name: 'Voir RH', description: 'Accès en lecture au module RH', module: 'RH' },
  { id: 'hr.edit', name: 'Modifier RH', description: 'Gérer les employés et congés', module: 'RH' },
  { id: 'hr.payroll', name: 'Gérer Paie', description: 'Accès à la gestion de la paie', module: 'RH' },
  
  // Comptabilité
  { id: 'accounting.view', name: 'Voir Comptabilité', description: 'Accès en lecture à la comptabilité', module: 'Comptabilité' },
  { id: 'accounting.edit', name: 'Saisir Comptabilité', description: 'Saisir des écritures comptables', module: 'Comptabilité' },
  { id: 'accounting.admin', name: 'Admin Comptabilité', description: 'Clôture et gestion avancée', module: 'Comptabilité' },

  // Planning
  { id: 'planning.view', name: 'Voir Planning', description: 'Accès en lecture au planning', module: 'Planning' },
  { id: 'planning.edit', name: 'Modifier Planning', description: 'Gérer les événements et tâches', module: 'Planning' },

  // Paramètres & Utilisateurs
  { id: 'settings.view', name: 'Voir Paramètres', description: 'Accès en lecture aux paramètres', module: 'Paramètres' },
  { id: 'settings.edit', name: 'Modifier Paramètres', description: 'Modifier les paramètres de l\'entreprise', module: 'Paramètres' },
  { id: 'users.manage', name: 'Gérer Utilisateurs', description: 'Gérer les utilisateurs et rôles', module: 'Paramètres' },
];

export const DEMO_ACCOUNTS = [
  { email: 'admin@smartdesk.cg', password: 'admin', name: 'Admin User', role: 'Administrateur' },
  { email: 'manager@smartdesk.cg', password: 'manager', name: 'Jean Mvoula', role: 'Manager' },
  { email: 'sales@smartdesk.cg', password: 'sales', name: 'Marie Oko', role: 'Commercial' },
];
