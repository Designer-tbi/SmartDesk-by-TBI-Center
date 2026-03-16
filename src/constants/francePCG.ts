export const FRANCE_PCG = [
  // Classe 1: Comptes de capitaux
  { code: '101', name: 'Capital', type: 'Equity' },
  { code: '106', name: 'Réserves', type: 'Equity' },
  { code: '110', name: 'Report à nouveau (solde créditeur)', type: 'Equity' },
  { code: '120', name: 'Résultat de l\'exercice (bénéfice)', type: 'Equity' },
  { code: '164', name: 'Emprunts auprès des établissements de crédit', type: 'Liability' },
  
  // Classe 2: Comptes d'immobilisations
  { code: '211', name: 'Terrains', type: 'Asset' },
  { code: '213', name: 'Constructions', type: 'Asset' },
  { code: '215', name: 'Installations techniques, matériel et outillage', type: 'Asset' },
  { code: '218', name: 'Autres immobilisations corporelles', type: 'Asset' },
  
  // Classe 3: Comptes de stocks
  { code: '31', name: 'Matières premières', type: 'Asset' },
  { code: '35', name: 'Stocks de produits', type: 'Asset' },
  { code: '37', name: 'Stocks de marchandises', type: 'Asset' },
  
  // Classe 4: Comptes de tiers
  { code: '401', name: 'Fournisseurs', type: 'Liability' },
  { code: '411', name: 'Clients', type: 'Asset' },
  { code: '421', name: 'Personnel - Rémunérations dues', type: 'Liability' },
  { code: '431', name: 'Sécurité sociale', type: 'Liability' },
  { code: '44566', name: 'TVA sur autres biens et services', type: 'Asset' },
  { code: '44571', name: 'TVA collectée', type: 'Liability' },
  
  // Classe 5: Comptes de trésorerie
  { code: '512', name: 'Banque', type: 'Asset' },
  { code: '53', name: 'Caisse', type: 'Asset' },
  
  // Classe 6: Comptes de charges
  { code: '601', name: 'Achats de matières premières', type: 'Expense' },
  { code: '607', name: 'Achats de marchandises', type: 'Expense' },
  { code: '61', name: 'Services extérieurs', type: 'Expense' },
  { code: '62', name: 'Autres services extérieurs', type: 'Expense' },
  { code: '63', name: 'Impôts, taxes et versements assimilés', type: 'Expense' },
  { code: '641', name: 'Rémunérations du personnel', type: 'Expense' },
  { code: '66', name: 'Charges financières', type: 'Expense' },
  
  // Classe 7: Comptes de produits
  { code: '701', name: 'Ventes de produits finis', type: 'Revenue' },
  { code: '706', name: 'Prestations de services', type: 'Revenue' },
  { code: '707', name: 'Ventes de marchandises', type: 'Revenue' },
  { code: '76', name: 'Produits financiers', type: 'Revenue' },
];
