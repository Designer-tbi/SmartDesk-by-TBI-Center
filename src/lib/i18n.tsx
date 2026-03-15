import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'fr' | 'en';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const translations: Record<Language, Record<string, string>> = {
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.crm': 'CRM',
    'nav.sales': 'Ventes',
    'nav.inventory': 'Stocks',
    'nav.projects': 'Projets',
    'nav.hr': 'RH',
    'nav.accounting': 'Comptabilité',
    'nav.settings': 'Paramètres',
    'nav.users': 'Utilisateurs',
    'nav.logout': 'Déconnexion',
    'common.search': 'Rechercher...',
    'common.add': 'Ajouter',
    'common.edit': 'Modifier',
    'common.delete': 'Supprimer',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.status': 'Statut',
    'common.date': 'Date',
    'common.total': 'Total',
    'common.actions': 'Actions',
    'accounting.title': 'Comptabilité',
    'accounting.tva': 'TVA',
    'accounting.salesTax': 'Taxe de vente',
    'accounting.journal': 'Journal',
    'accounting.transactions': 'Transactions',
    'accounting.invoices': 'Factures',
    'accounting.revenue': 'Revenus',
    'accounting.expenses': 'Dépenses',
    'crm.title': 'CRM',
    'crm.contacts': 'Contacts',
    'crm.leads': 'Pistes',
    'crm.customers': 'Clients',
    'crm.addContact': 'Ajouter un contact',
    'sales.title': 'Ventes',
    'sales.invoices': 'Factures',
    'sales.quotes': 'Devis',
    'sales.createInvoice': 'Créer une facture',
    'inventory.title': 'Stocks',
    'inventory.products': 'Produits',
    'inventory.stock': 'Stock',
    'projects.title': 'Projets',
    'projects.active': 'Projets actifs',
    'hr.title': 'Ressources Humaines',
    'hr.employees': 'Employés',
    'settings.title': 'Paramètres',
    'settings.company': 'Entreprise',
    'settings.language': 'Langue',
    'settings.country': 'Pays',
    'settings.state': 'État',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.crm': 'CRM',
    'nav.sales': 'Sales',
    'nav.inventory': 'Inventory',
    'nav.projects': 'Projects',
    'nav.hr': 'HR',
    'nav.accounting': 'Accounting',
    'nav.settings': 'Settings',
    'nav.users': 'Users',
    'nav.logout': 'Logout',
    'common.search': 'Search...',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.total': 'Total',
    'common.actions': 'Actions',
    'accounting.title': 'Accounting',
    'accounting.tva': 'VAT',
    'accounting.salesTax': 'Sales Tax',
    'accounting.journal': 'Journal',
    'accounting.transactions': 'Transactions',
    'accounting.invoices': 'Invoices',
    'accounting.revenue': 'Revenue',
    'accounting.expenses': 'Expenses',
    'crm.title': 'CRM',
    'crm.contacts': 'Contacts',
    'crm.leads': 'Leads',
    'crm.customers': 'Customers',
    'crm.addContact': 'Add Contact',
    'sales.title': 'Sales',
    'sales.invoices': 'Invoices',
    'sales.quotes': 'Quotes',
    'sales.createInvoice': 'Create Invoice',
    'inventory.title': 'Inventory',
    'inventory.products': 'Products',
    'inventory.stock': 'Stock',
    'projects.title': 'Projects',
    'projects.active': 'Active Projects',
    'hr.title': 'Human Resources',
    'hr.employees': 'Employees',
    'settings.title': 'Settings',
    'settings.company': 'Company',
    'settings.language': 'Language',
    'settings.country': 'Country',
    'settings.state': 'State',
  }
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('fr');

  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang && (savedLang === 'fr' || savedLang === 'en')) {
      setLanguage(savedLang);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string, params?: Record<string, string>): string => {
    let text = translations[language][key] || translations['en'][key] || key;
    if (params) {
      Object.keys(params).forEach(param => {
        text = text.replace(`{{${param}}}`, params[param]);
      });
    }
    return text;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
