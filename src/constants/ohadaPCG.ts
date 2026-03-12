export const OHADA_PCG = [
  // Classe 1: Comptes de capitaux
  { code: '101', name: 'Capital social', type: 'Equity' },
  { code: '106', name: 'Réserves', type: 'Equity' },
  { code: '11', name: 'Report à nouveau', type: 'Equity' },
  { code: '12', name: 'Résultat net de l\'exercice', type: 'Equity' },
  { code: '161', name: 'Emprunts obligataires', type: 'Liability' },
  { code: '164', name: 'Emprunts auprès des établissements de crédit', type: 'Liability' },
  
  // Classe 2: Comptes d'immobilisations
  { code: '201', name: 'Frais de recherche et développement', type: 'Asset' },
  { code: '211', name: 'Terrains', type: 'Asset' },
  { code: '213', name: 'Bâtiments', type: 'Asset' },
  { code: '215', name: 'Installations techniques, matériel et outillage', type: 'Asset' },
  { code: '218', name: 'Autres immobilisations corporelles', type: 'Asset' },
  
  // Classe 3: Comptes de stocks
  { code: '311', name: 'Marchandises', type: 'Asset' },
  { code: '321', name: 'Matières premières', type: 'Asset' },
  { code: '331', name: 'Fournitures consommables', type: 'Asset' },
  { code: '341', name: 'Produits en cours', type: 'Asset' },
  { code: '351', name: 'Produits finis', type: 'Asset' },
  
  // Classe 4: Comptes de tiers
  { code: '401', name: 'Fournisseurs', type: 'Liability' },
  { code: '408', name: 'Fournisseurs - Factures non parvenues', type: 'Liability' },
  { code: '411', name: 'Clients', type: 'Asset' },
  { code: '418', name: 'Clients - Factures à établir', type: 'Asset' },
  { code: '421', name: 'Personnel - Rémunérations dues', type: 'Liability' },
  { code: '431', name: 'Sécurité sociale', type: 'Liability' },
  { code: '445', name: 'État - TVA facturée', type: 'Liability' },
  { code: '447', name: 'État - TVA récupérable', type: 'Asset' },
  
  // Classe 5: Comptes de trésorerie
  { code: '501', name: 'Titres de participation', type: 'Asset' },
  { code: '521', name: 'Banques', type: 'Asset' },
  { code: '531', name: 'Caisse', type: 'Asset' },
  
  // Classe 6: Comptes de charges
  { code: '601', name: 'Achats de matières premières', type: 'Expense' },
  { code: '607', name: 'Achats de marchandises', type: 'Expense' },
  { code: '611', name: 'Transports de biens', type: 'Expense' },
  { code: '621', name: 'Personnel extérieur', type: 'Expense' },
  { code: '622', name: 'Rémunérations d\'intermédiaires et honoraires', type: 'Expense' },
  { code: '631', name: 'Impôts et taxes directs', type: 'Expense' },
  { code: '641', name: 'Rémunérations du personnel', type: 'Expense' },
  { code: '661', name: 'Charges d\'intérêts', type: 'Expense' },
  
  // Classe 7: Comptes de produits
  { code: '701', name: 'Ventes de produits finis', type: 'Revenue' },
  { code: '707', name: 'Ventes de marchandises', type: 'Revenue' },
  { code: '713', name: 'Variation des stocks de produits', type: 'Revenue' },
  { code: '751', name: 'Redevances pour concessions', type: 'Revenue' },
  { code: '771', name: 'Produits des cessions de titres', type: 'Revenue' },
];
