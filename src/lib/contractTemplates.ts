/**
 * Built-in contract templates — OHADA / République du Congo.
 *
 * Each template is a declarative structure that drives:
 *   1. The form (fields are derived from each article's `variables`).
 *   2. The generated markdown (uses {{key}} placeholders).
 *   3. Optional per-article overrides ("Modifier l'article") so the legal
 *      services can rewrite a clause without leaving the app.
 *
 * Variables with an `autofill` hint are pre-filled from the current
 * company / selected employee.
 *
 * Sources : Code du travail congolais (loi n° 45-75 modifiée), AUDCG
 * OHADA, Convention collective nationale interprofessionnelle.
 */

export type ContractVariableType = 'text' | 'textarea' | 'date' | 'number';

export type AutofillKey =
  // Company
  | 'companyName' | 'companyAddress' | 'companyRepresentative'
  | 'companyNiu' | 'companyRccm' | 'companyIdNat' | 'companyTaxId'
  | 'companyPhone' | 'companyEmail' | 'companyCity' | 'companyCountry'
  | 'companyCurrency'
  // Employee
  | 'employeeName' | 'employeeAddress' | 'employeeRole'
  | 'employeeSalary' | 'employeeEmail' | 'employeePhone'
  | 'employeeCni' | 'employeeNiu' | 'employeeMatricule'
  | 'employeeDepartment' | 'employeeJoinDate'
  // Misc
  | 'contractStartDate' | 'city' | 'today';

export type ContractVariable = {
  key: string;
  label: string;
  placeholder?: string;
  type?: ContractVariableType;
  autofill?: AutofillKey;
};

export type ContractArticle = {
  id: string;
  /** e.g. "Article 1 – Objet" */
  title: string;
  /** Markdown body using {{variableKey}} placeholders. */
  body: string;
  /** Variables referenced in the body — rendered as form inputs. */
  variables?: ContractVariable[];
  /**
   * When true, a free-text field is shown under the article so the user
   * can append clauses or custom wording.
   */
  extensible?: boolean;
};

export type ContractTemplateDef = {
  id: 'CDD' | 'CDI' | 'MISSION' | 'PRESTATION';
  /** Short label shown in the template picker. */
  label: string;
  /** Full legal title printed at the top of the generated contract. */
  title: string;
  /** Short tagline shown in the picker. */
  tagline: string;
  /** Variables required for the party identification (header). */
  partiesVariables: ContractVariable[];
  /** Rendered header (before Article 1). */
  header: string;
  articles: ContractArticle[];
  /** Rendered footer (after last article). */
  footer: string;
  /** Mapped to `contract.type` when saved. */
  contractType: 'CDD' | 'CDI' | 'Freelance' | 'Stage';
};

// ------------------------------------------------------------------
// Common parties block (Congo OHADA — full identification)
// ------------------------------------------------------------------
const PARTIES_EMPLOYER: ContractVariable[] = [
  { key: 'companyName', label: 'Raison sociale', autofill: 'companyName' },
  { key: 'companyAddress', label: 'Siège social', type: 'textarea', autofill: 'companyAddress' },
  { key: 'companyCity', label: 'Ville', autofill: 'companyCity' },
  { key: 'companyRccm', label: 'RCCM', autofill: 'companyRccm', placeholder: 'RCCM/CG-BZV/22-B-XXX' },
  { key: 'companyNiu', label: 'NIU (Identifiant fiscal)', autofill: 'companyNiu' },
  { key: 'companyIdNat', label: 'ID NAT', autofill: 'companyIdNat' },
  { key: 'companyPhone', label: 'Téléphone', autofill: 'companyPhone' },
  { key: 'companyEmail', label: 'Email', autofill: 'companyEmail' },
  { key: 'companyRepresentative', label: 'Représenté(e) par', autofill: 'companyRepresentative' },
  { key: 'companyRepresentativeRole', label: 'Qualité du représentant', placeholder: 'Directeur Général' },
];

const PARTIES_EMPLOYEE: ContractVariable[] = [
  { key: 'employeeName', label: 'Nom et prénoms', autofill: 'employeeName' },
  { key: 'employeeBirthDate', label: 'Date de naissance', type: 'date' },
  { key: 'employeeBirthPlace', label: 'Lieu de naissance' },
  { key: 'employeeNationality', label: 'Nationalité', placeholder: 'Congolaise' },
  { key: 'employeeAddress', label: 'Domicile', type: 'textarea', autofill: 'employeeAddress' },
  { key: 'employeeCni', label: 'N° CNI / Passeport', autofill: 'employeeCni' },
  { key: 'employeeNiu', label: 'NIU (Identifiant fiscal)', autofill: 'employeeNiu' },
  { key: 'employeeMatricule', label: 'Matricule CNSS', autofill: 'employeeMatricule' },
  { key: 'employeeFamilyStatus', label: 'Situation de famille', placeholder: 'Célibataire / Marié(e)' },
  { key: 'employeeChildren', label: 'Nombre d’enfants à charge', type: 'number', placeholder: '0' },
];

const PARTIES_PRESTATAIRE: ContractVariable[] = [
  { key: 'employeeName', label: 'Prestataire — Nom complet', autofill: 'employeeName' },
  { key: 'prestataireStatus', label: 'Statut juridique', placeholder: 'Auto-entrepreneur / SARL' },
  { key: 'prestataireRccm', label: 'RCCM (si applicable)', placeholder: 'RCCM/CG-BZV/...' },
  { key: 'prestataireNiu', label: 'NIU', autofill: 'employeeNiu' },
  { key: 'employeeAddress', label: 'Adresse', type: 'textarea', autofill: 'employeeAddress' },
  { key: 'employeePhone', label: 'Téléphone', autofill: 'employeePhone' },
  { key: 'employeeEmail', label: 'Email', autofill: 'employeeEmail' },
];

const COMMON_HEADER_EMPLOYMENT = `**ENTRE LES SOUSSIGNÉS :**

**L’EMPLOYEUR :**
{{companyName}}, société immatriculée au Registre du Commerce et du Crédit Mobilier sous le n° {{companyRccm}}, identifiant fiscal NIU {{companyNiu}}, ID NAT {{companyIdNat}},
dont le siège social est situé : {{companyAddress}}, {{companyCity}},
Téléphone : {{companyPhone}} – Email : {{companyEmail}},
représentée par {{companyRepresentative}}, en qualité de {{companyRepresentativeRole}},
ci-après dénommée « **l’Employeur** »,

**D’UNE PART,**

**ET**

**LE SALARIÉ :**
{{employeeName}}, né(e) le {{employeeBirthDate}} à {{employeeBirthPlace}},
de nationalité {{employeeNationality}},
demeurant : {{employeeAddress}},
titulaire de la pièce d’identité n° {{employeeCni}},
NIU : {{employeeNiu}}, matricule CNSS : {{employeeMatricule}},
situation de famille : {{employeeFamilyStatus}}, {{employeeChildren}} enfant(s) à charge,
ci-après dénommé(e) « **le Salarié** »,

**D’AUTRE PART,**

**IL A ÉTÉ CONVENU CE QUI SUIT :**`;

const COMMON_HEADER_PRESTATION = `**ENTRE LES SOUSSIGNÉS :**

**LE CLIENT :**
{{companyName}}, société immatriculée au RCCM sous le n° {{companyRccm}}, NIU {{companyNiu}},
dont le siège social est situé : {{companyAddress}}, {{companyCity}},
représentée par {{companyRepresentative}}, en qualité de {{companyRepresentativeRole}},
ci-après dénommée « **le Client** »,

**D’UNE PART,**

**ET**

**LE PRESTATAIRE :**
{{employeeName}}, exerçant sous le statut de {{prestataireStatus}},
{{prestataireRccm}} – NIU : {{prestataireNiu}},
demeurant : {{employeeAddress}},
Téléphone : {{employeePhone}} – Email : {{employeeEmail}},
ci-après dénommé « **le Prestataire** »,

**D’AUTRE PART,**

**IL A ÉTÉ CONVENU CE QUI SUIT :**`;

// ------------------------------------------------------------------
// CDI — Contrat à Durée Indéterminée (Congo OHADA)
// ------------------------------------------------------------------
const CDI: ContractTemplateDef = {
  id: 'CDI',
  label: 'CDI',
  title: 'CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE',
  tagline: 'Engagement permanent — conforme Code du travail congolais & OHADA',
  contractType: 'CDI',
  partiesVariables: [...PARTIES_EMPLOYER, ...PARTIES_EMPLOYEE],
  header: COMMON_HEADER_EMPLOYMENT,
  articles: [
    {
      id: 'engagement',
      title: 'Article 1 – Engagement',
      body: `L’Employeur engage le Salarié, qui accepte, en qualité de **{{poste}}**, classification professionnelle « {{categorie}} ».

Le Salarié déclare ne pas être lié par un précédent contrat de travail susceptible d’entraver le présent engagement.`,
      variables: [
        { key: 'poste', label: 'Fonction / poste', autofill: 'employeeRole' },
        { key: 'categorie', label: 'Catégorie professionnelle', placeholder: 'Cat. 6 — Cadre supérieur' },
      ],
      extensible: true,
    },
    {
      id: 'prise-fonction',
      title: 'Article 2 – Prise de fonction',
      body: `Le présent contrat prend effet le **{{dateDebut}}**.

Le Salarié sera affecté(e) au service **{{serviceAffectation}}**, sous l’autorité hiérarchique de **{{superieurHierarchique}}**.`,
      variables: [
        { key: 'dateDebut', label: 'Date d’entrée en fonction', type: 'date', autofill: 'contractStartDate' },
        { key: 'serviceAffectation', label: 'Service / département', autofill: 'employeeDepartment' },
        { key: 'superieurHierarchique', label: 'Supérieur hiérarchique' },
      ],
      extensible: true,
    },
    {
      id: 'essai',
      title: 'Article 3 – Période d’essai',
      body: `Conformément à l’article 24 du Code du travail congolais, le contrat est conclu sous réserve de la période d’essai d’une durée de **{{dureeEssai}}**, renouvelable une fois par accord écrit entre les parties.

Pendant cette période, chacune des parties peut rompre le contrat sans indemnité, sous réserve d’un préavis de huit (8) jours.`,
      variables: [
        { key: 'dureeEssai', label: 'Durée de la période d’essai', placeholder: '3 mois' },
      ],
      extensible: true,
    },
    {
      id: 'lieu-travail',
      title: 'Article 4 – Lieu de travail',
      body: `Le lieu habituel d’exécution du travail est : **{{lieuTravail}}**.

Toutefois, l’Employeur se réserve le droit, en cas de nécessité, d’affecter temporairement le Salarié à un autre lieu sur le territoire de la République du Congo, dans les conditions prévues par la convention collective applicable.`,
      variables: [
        { key: 'lieuTravail', label: 'Lieu de travail', autofill: 'companyAddress' },
      ],
      extensible: true,
    },
    {
      id: 'duree-travail',
      title: 'Article 5 – Durée du travail',
      body: `La durée hebdomadaire de travail est fixée à **{{heuresSemaine}} heures**, conformément à l’article 99 du Code du travail.

Les heures supplémentaires éventuelles seront rémunérées selon les majorations légales : 10 % de la 41ᵉ à la 48ᵉ heure, 25 % au-delà, 50 % les jours de repos hebdomadaire et 100 % les jours fériés.`,
      variables: [
        { key: 'heuresSemaine', label: 'Heures hebdomadaires', type: 'number', placeholder: '40' },
      ],
      extensible: true,
    },
    {
      id: 'remuneration',
      title: 'Article 6 – Rémunération',
      body: `En contrepartie de son travail, le Salarié percevra une rémunération mensuelle brute de **{{salaire}} {{devise}}**, payable mensuellement par virement bancaire au plus tard le {{jourPaiement}} du mois suivant.

Cette rémunération comprend :
* Salaire de base : {{salaire}} {{devise}}
* Prime de transport : {{primeTransport}} {{devise}}
* Prime de logement : {{primeLogement}} {{devise}}
* Autres avantages : {{autresAvantages}}

L’Employeur s’engage à effectuer les retenues fiscales et sociales légales (IRPP, CNSS) sur la rémunération brute.`,
      variables: [
        { key: 'salaire', label: 'Salaire de base mensuel', type: 'number', autofill: 'employeeSalary' },
        { key: 'devise', label: 'Devise', autofill: 'companyCurrency', placeholder: 'XAF' },
        { key: 'jourPaiement', label: 'Jour de paiement', placeholder: '5' },
        { key: 'primeTransport', label: 'Prime de transport', type: 'number', placeholder: '0' },
        { key: 'primeLogement', label: 'Prime de logement', type: 'number', placeholder: '0' },
        { key: 'autresAvantages', label: 'Autres avantages', type: 'textarea', placeholder: 'Néant' },
      ],
      extensible: true,
    },
    {
      id: 'conges',
      title: 'Article 7 – Congés payés',
      body: `Le Salarié bénéficie d’un congé annuel payé de **{{joursConges}} jours ouvrables** par an, conformément à l’article 121 du Code du travail (deux jours ouvrables et deux tiers par mois de service effectif).

Les dates de congés sont fixées d’un commun accord entre les parties, en tenant compte des nécessités de service.`,
      variables: [
        { key: 'joursConges', label: 'Jours de congés annuels', type: 'number', placeholder: '26' },
      ],
      extensible: true,
    },
    {
      id: 'protection-sociale',
      title: 'Article 8 – Protection sociale',
      body: `Le Salarié est immatriculé à la Caisse Nationale de Sécurité Sociale (CNSS) sous le matricule {{employeeMatricule}}.

L’Employeur cotise pour les risques suivants : assurance maladie, prestations familiales, vieillesse, invalidité, décès, accidents du travail et maladies professionnelles, selon les taux légaux en vigueur.`,
      extensible: true,
    },
    {
      id: 'confidentialite',
      title: 'Article 9 – Confidentialité',
      body: `Le Salarié s’engage, pendant l’exécution du contrat et pendant une durée de **{{dureeConfidentialite}} ans** après sa cessation, à ne divulguer à quiconque, directement ou indirectement, aucune information confidentielle dont il aurait eu connaissance dans l’exercice de ses fonctions.

Constituent notamment des informations confidentielles : les données financières, les listes de clients, les procédés techniques, les stratégies commerciales et tout document marqué « confidentiel ».`,
      variables: [
        { key: 'dureeConfidentialite', label: 'Durée post-contrat (années)', type: 'number', placeholder: '2' },
      ],
      extensible: true,
    },
    {
      id: 'propriete-intellectuelle',
      title: 'Article 10 – Propriété intellectuelle',
      body: `Toutes les créations, inventions, œuvres et logiciels réalisés par le Salarié dans l’exercice de ses fonctions sont la propriété exclusive de l’Employeur, conformément à l’Acte uniforme OHADA et aux dispositions du droit d’auteur.

Le Salarié cède à l’Employeur, à titre exclusif et pour la durée légale de protection, l’ensemble des droits patrimoniaux afférents à ses créations professionnelles.`,
      extensible: true,
    },
    {
      id: 'rupture',
      title: 'Article 11 – Rupture du contrat',
      body: `Le présent contrat peut être rompu :

1. **Par démission du Salarié**, moyennant un préavis écrit de **{{preavisDemission}}**.
2. **Par licenciement de l’Employeur**, dans les cas et selon les formes prévus par les articles 39 et suivants du Code du travail, moyennant le préavis légal et le paiement, le cas échéant, des indemnités de licenciement.
3. **D’un commun accord** par convention écrite entre les parties.
4. **Pour faute lourde**, sans préavis ni indemnité.`,
      variables: [
        { key: 'preavisDemission', label: 'Préavis de démission', placeholder: '1 mois' },
      ],
      extensible: true,
    },
    {
      id: 'discipline',
      title: 'Article 12 – Discipline & règlement intérieur',
      body: `Le Salarié déclare avoir pris connaissance du règlement intérieur de l’entreprise et s’engage à le respecter scrupuleusement.

Tout manquement aux obligations contractuelles ou au règlement intérieur pourra être sanctionné selon la gradation suivante : avertissement écrit, mise à pied, licenciement.`,
      extensible: true,
    },
    {
      id: 'litiges',
      title: 'Article 13 – Litiges & juridiction compétente',
      body: `Tout différend né de l’exécution ou de l’interprétation du présent contrat sera soumis, à défaut de règlement amiable, à l’Inspection du travail compétente puis, le cas échéant, au Tribunal du travail de **{{tribunalCompetent}}**.

Le présent contrat est régi par le **droit congolais** et, pour les aspects commerciaux, par les **Actes uniformes OHADA**.`,
      variables: [
        { key: 'tribunalCompetent', label: 'Tribunal du travail compétent', placeholder: 'Brazzaville' },
      ],
      extensible: true,
    },
    {
      id: 'dispositions-finales',
      title: 'Article 14 – Dispositions finales',
      body: `Le présent contrat est établi en **deux exemplaires originaux**, un pour chacune des parties.

Il annule et remplace toute convention antérieure, écrite ou verbale, ayant le même objet.

Toute modification ne pourra résulter que d’un avenant signé par les deux parties.`,
      extensible: true,
    },
  ],
  footer: `Fait à **{{ville}}**, le **{{dateSignature}}**, en deux (2) exemplaires originaux.


Pour l’Employeur                                  Pour le Salarié
{{companyRepresentative}}                        {{employeeName}}
({{companyRepresentativeRole}})

(« Lu et approuvé » + signature)                 (« Lu et approuvé » + signature)`,
};

// ------------------------------------------------------------------
// CDD — Contrat à Durée Déterminée (Congo OHADA)
// ------------------------------------------------------------------
const CDD: ContractTemplateDef = {
  id: 'CDD',
  label: 'CDD',
  title: 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE',
  tagline: 'Emploi à terme défini — Code du travail congolais',
  contractType: 'CDD',
  partiesVariables: [...PARTIES_EMPLOYER, ...PARTIES_EMPLOYEE],
  header: COMMON_HEADER_EMPLOYMENT,
  articles: [
    {
      id: 'objet-motif',
      title: 'Article 1 – Objet et motif',
      body: `Le présent contrat est un contrat à durée déterminée conclu en application des articles 25 et suivants du Code du travail congolais.

Il est conclu pour le motif précis suivant : **{{motif}}**.`,
      variables: [
        { key: 'motif', label: 'Motif du recours au CDD', type: 'textarea', placeholder: 'Remplacement de Mme X en congé maternité du JJ/MM au JJ/MM' },
      ],
      extensible: true,
    },
    {
      id: 'duree',
      title: 'Article 2 – Durée du contrat',
      body: `Le présent contrat est conclu pour une durée déterminée de **{{dureeMois}} mois**, soit du **{{dateDebut}}** au **{{dateFin}}** inclus.

La durée totale d’un CDD ne peut excéder deux (2) ans, renouvellement compris, conformément à l’article 27 du Code du travail.`,
      variables: [
        { key: 'dureeMois', label: 'Durée (mois)', type: 'number', placeholder: '6' },
        { key: 'dateDebut', label: 'Date de début', type: 'date', autofill: 'contractStartDate' },
        { key: 'dateFin', label: 'Date de fin', type: 'date' },
      ],
      extensible: true,
    },
    {
      id: 'fonction',
      title: 'Article 3 – Fonctions et tâches',
      body: `Le Salarié est engagé en qualité de **{{poste}}**, classification **{{categorie}}**.

Le Salarié exécute les missions décrites ci-après :
{{descriptionTaches}}`,
      variables: [
        { key: 'poste', label: 'Poste', autofill: 'employeeRole' },
        { key: 'categorie', label: 'Catégorie', placeholder: 'Cat. 4' },
        { key: 'descriptionTaches', label: 'Description des tâches', type: 'textarea' },
      ],
      extensible: true,
    },
    {
      id: 'essai',
      title: 'Article 4 – Période d’essai',
      body: `Conformément à l’article 24 du Code du travail, le contrat comporte une période d’essai de **{{dureeEssai}}**, durant laquelle chacune des parties peut le rompre sans indemnité moyennant un préavis de huit (8) jours.`,
      variables: [
        { key: 'dureeEssai', label: 'Durée d’essai', placeholder: '15 jours / 1 mois' },
      ],
      extensible: true,
    },
    {
      id: 'lieu-travail',
      title: 'Article 5 – Lieu de travail',
      body: `Le travail s’exécute à : **{{lieuTravail}}**.`,
      variables: [
        { key: 'lieuTravail', label: 'Lieu de travail', autofill: 'companyAddress' },
      ],
      extensible: true,
    },
    {
      id: 'duree-travail',
      title: 'Article 6 – Durée du travail',
      body: `La durée hebdomadaire de travail est fixée à **{{heuresSemaine}} heures**, réparties selon le planning de l’entreprise.

Les heures supplémentaires sont rémunérées conformément à la législation en vigueur.`,
      variables: [
        { key: 'heuresSemaine', label: 'Heures / semaine', type: 'number', placeholder: '40' },
      ],
      extensible: true,
    },
    {
      id: 'remuneration',
      title: 'Article 7 – Rémunération',
      body: `Le Salarié perçoit une rémunération mensuelle brute de **{{salaire}} {{devise}}**, payable au plus tard le {{jourPaiement}} du mois suivant.

Indemnités complémentaires :
* Prime de transport : {{primeTransport}} {{devise}}
* Autres : {{autresPrimes}}`,
      variables: [
        { key: 'salaire', label: 'Salaire mensuel brut', type: 'number', autofill: 'employeeSalary' },
        { key: 'devise', label: 'Devise', autofill: 'companyCurrency', placeholder: 'XAF' },
        { key: 'jourPaiement', label: 'Jour de paiement', placeholder: '5' },
        { key: 'primeTransport', label: 'Prime transport', type: 'number', placeholder: '0' },
        { key: 'autresPrimes', label: 'Autres primes', placeholder: 'Néant' },
      ],
      extensible: true,
    },
    {
      id: 'conges',
      title: 'Article 8 – Congés payés',
      body: `Le Salarié acquiert des droits à congés payés au prorata de son temps de présence, soit 2,17 jours ouvrables par mois de service effectif (article 121 du Code du travail).

À défaut de prise effective avant la fin du contrat, les congés non pris sont indemnisés.`,
      extensible: true,
    },
    {
      id: 'protection-sociale',
      title: 'Article 9 – Protection sociale',
      body: `Le Salarié est immatriculé à la CNSS sous le matricule {{employeeMatricule}}. L’Employeur acquitte les cotisations légales (vieillesse, prestations familiales, accidents du travail).`,
      extensible: true,
    },
    {
      id: 'rupture-anticipee',
      title: 'Article 10 – Rupture anticipée',
      body: `Conformément à l’article 26 du Code du travail, le présent contrat ne peut être rompu avant son terme, sauf :
* accord écrit des deux parties,
* faute lourde de l’une ou l’autre partie,
* force majeure.

La rupture anticipée fautive ouvre droit à des dommages-intérêts au profit de la partie non fautive, équivalents au minimum aux salaires restant à courir jusqu’au terme du contrat.`,
      extensible: true,
    },
    {
      id: 'fin-contrat',
      title: 'Article 11 – Fin de contrat & indemnité',
      body: `À l’expiration du contrat, sauf reconduction écrite, les parties se libèrent réciproquement de leurs obligations.

Conformément à l’article 31 du Code du travail, le Salarié perçoit une **indemnité de fin de contrat équivalente à {{tauxIndemnite}} % de la rémunération totale brute** versée durant l’exécution du contrat, sauf si le contrat se poursuit en CDI.`,
      variables: [
        { key: 'tauxIndemnite', label: 'Taux indemnité (%)', type: 'number', placeholder: '5' },
      ],
      extensible: true,
    },
    {
      id: 'litiges',
      title: 'Article 12 – Litiges',
      body: `Tout différend sera porté devant l’Inspection du travail puis, à défaut de conciliation, devant le Tribunal du travail de **{{tribunalCompetent}}**. Le contrat est régi par le droit congolais et les Actes uniformes OHADA.`,
      variables: [
        { key: 'tribunalCompetent', label: 'Tribunal du travail compétent', placeholder: 'Brazzaville' },
      ],
      extensible: true,
    },
  ],
  footer: `Fait à **{{ville}}**, le **{{dateSignature}}**, en deux (2) exemplaires originaux.


Pour l’Employeur                                  Pour le Salarié
{{companyRepresentative}}                        {{employeeName}}
({{companyRepresentativeRole}})

(« Lu et approuvé » + signature)                 (« Lu et approuvé » + signature)`,
};

// ------------------------------------------------------------------
// MISSION — Contrat de Mission (Intérim)
// ------------------------------------------------------------------
const MISSION: ContractTemplateDef = {
  id: 'MISSION',
  label: 'Mission / Intérim',
  title: 'CONTRAT DE MISSION (INTÉRIM)',
  tagline: 'Mission temporaire — détachement / intérim',
  contractType: 'CDD',
  partiesVariables: [...PARTIES_EMPLOYER, ...PARTIES_EMPLOYEE],
  header: COMMON_HEADER_EMPLOYMENT,
  articles: [
    {
      id: 'objet',
      title: 'Article 1 – Objet de la mission',
      body: `Le Salarié est engagé pour exécuter une mission temporaire en qualité de **{{poste}}**, au profit de l’entreprise utilisatrice **{{entrepriseUtilisatrice}}**, située : {{lieuMission}}.

Description précise de la mission : {{descriptionMission}}.`,
      variables: [
        { key: 'poste', label: 'Poste', autofill: 'employeeRole' },
        { key: 'entrepriseUtilisatrice', label: 'Entreprise utilisatrice', autofill: 'companyName' },
        { key: 'lieuMission', label: 'Lieu de la mission', autofill: 'companyAddress' },
        { key: 'descriptionMission', label: 'Description de la mission', type: 'textarea' },
      ],
      extensible: true,
    },
    {
      id: 'duree',
      title: 'Article 2 – Durée',
      body: `La mission s’exécute du **{{dateDebut}}** au **{{dateFin}}** inclus.

Une éventuelle prolongation fera l’objet d’un avenant écrit.`,
      variables: [
        { key: 'dateDebut', label: 'Date de début', type: 'date', autofill: 'contractStartDate' },
        { key: 'dateFin', label: 'Date de fin prévisionnelle', type: 'date' },
      ],
      extensible: true,
    },
    {
      id: 'remuneration',
      title: 'Article 3 – Rémunération',
      body: `La rémunération de la mission est de **{{salaire}} {{devise}}**, payable {{frequencePaiement}}.

Les frais professionnels engagés dans le cadre de la mission seront remboursés sur justificatifs.`,
      variables: [
        { key: 'salaire', label: 'Rémunération', type: 'number', autofill: 'employeeSalary' },
        { key: 'devise', label: 'Devise', autofill: 'companyCurrency', placeholder: 'XAF' },
        { key: 'frequencePaiement', label: 'Fréquence', placeholder: 'mensuellement' },
      ],
      extensible: true,
    },
    {
      id: 'conditions',
      title: 'Article 4 – Conditions d’exécution',
      body: `Le Salarié exécute la mission sous l’autorité fonctionnelle de l’entreprise utilisatrice.

Il s’engage à respecter le règlement intérieur, les consignes de sécurité et les horaires en vigueur sur le site de mission.`,
      extensible: true,
    },
    {
      id: 'protection-sociale',
      title: 'Article 5 – Protection sociale',
      body: `Le Salarié bénéficie de la couverture CNSS pendant toute la durée de la mission. Les cotisations sont à la charge de l’employeur signataire.`,
      extensible: true,
    },
    {
      id: 'fin-mission',
      title: 'Article 6 – Fin de mission',
      body: `À l’échéance, la mission prend fin de plein droit sans préavis ni indemnité, sauf indemnité de précarité légale équivalente à **{{tauxIndemnite}} %** de la rémunération brute totale.`,
      variables: [
        { key: 'tauxIndemnite', label: 'Indemnité fin de mission (%)', type: 'number', placeholder: '5' },
      ],
      extensible: true,
    },
    {
      id: 'litiges',
      title: 'Article 7 – Litiges',
      body: `Tout différend sera tranché par le Tribunal du travail de **{{tribunalCompetent}}**, sous l’empire du droit congolais.`,
      variables: [
        { key: 'tribunalCompetent', label: 'Tribunal compétent', placeholder: 'Brazzaville' },
      ],
      extensible: true,
    },
  ],
  footer: `Fait à **{{ville}}**, le **{{dateSignature}}**, en deux (2) exemplaires originaux.


Pour l’Employeur                                  Pour le Salarié
{{companyRepresentative}}                        {{employeeName}}`,
};

// ------------------------------------------------------------------
// PRESTATION — Prestation de services (Indépendant)
// ------------------------------------------------------------------
const PRESTATION: ContractTemplateDef = {
  id: 'PRESTATION',
  label: 'Prestation / Indépendant',
  title: 'CONTRAT DE PRESTATION DE SERVICES',
  tagline: 'Indépendant — sans lien de subordination, OHADA',
  contractType: 'Freelance',
  partiesVariables: [...PARTIES_EMPLOYER, ...PARTIES_PRESTATAIRE],
  header: COMMON_HEADER_PRESTATION,
  articles: [
    {
      id: 'objet',
      title: 'Article 1 – Objet du contrat',
      body: `Le Client confie au Prestataire, qui l’accepte, l’exécution de la prestation suivante :

{{descriptionMission}}

**Livrables attendus :** {{livrables}}`,
      variables: [
        { key: 'descriptionMission', label: 'Description détaillée', type: 'textarea' },
        { key: 'livrables', label: 'Livrables', type: 'textarea', placeholder: 'Code source + documentation + formation' },
      ],
      extensible: true,
    },
    {
      id: 'independance',
      title: 'Article 2 – Indépendance & absence de subordination',
      body: `Le Prestataire exerce sa mission en toute **indépendance professionnelle**, sans lien de subordination juridique avec le Client.

Il organise son temps de travail librement et utilise ses propres outils, sauf disposition contraire écrite. Il assume seul les charges sociales et fiscales liées à son activité (CNSS, IRPP, TVA le cas échéant).`,
      extensible: true,
    },
    {
      id: 'duree',
      title: 'Article 3 – Durée d’exécution',
      body: `La prestation s’exécute du **{{dateDebut}}** au **{{dateFin}}** inclus.

Le calendrier d’exécution détaillé est joint en annexe ou figure ci-après :
{{planningDetail}}`,
      variables: [
        { key: 'dateDebut', label: 'Date de début', type: 'date', autofill: 'contractStartDate' },
        { key: 'dateFin', label: 'Date de fin', type: 'date' },
        { key: 'planningDetail', label: 'Planning / phases', type: 'textarea', placeholder: 'Phase 1 : ... / Phase 2 : ...' },
      ],
      extensible: true,
    },
    {
      id: 'honoraires',
      title: 'Article 4 – Honoraires & modalités de paiement',
      body: `Le montant total des honoraires hors taxes est fixé à **{{montant}} {{devise}}**.

Modalités de facturation : {{modalitesFacturation}}.
Modalités de paiement : {{modalitesPaiement}}.

En cas de retard de paiement, des pénalités égales à **trois (3) fois le taux d’intérêt légal** seront appliquées de plein droit, sans mise en demeure préalable.`,
      variables: [
        { key: 'montant', label: 'Montant HT', type: 'number' },
        { key: 'devise', label: 'Devise', autofill: 'companyCurrency', placeholder: 'XAF' },
        { key: 'modalitesFacturation', label: 'Modalités de facturation', placeholder: '50% à la commande, 50% à la livraison' },
        { key: 'modalitesPaiement', label: 'Modalités de paiement', placeholder: 'Virement bancaire à 30 jours' },
      ],
      extensible: true,
    },
    {
      id: 'propriete-intellectuelle',
      title: 'Article 5 – Propriété intellectuelle',
      body: `Sous réserve du paiement intégral des honoraires, le Prestataire cède au Client, à titre exclusif, l’ensemble des droits patrimoniaux (reproduction, représentation, adaptation, traduction, modification) afférents aux livrables, pour la durée légale de protection et pour le monde entier.

Le Prestataire conserve toutefois le droit moral sur ses créations et la liberté de réutiliser ses méthodologies et savoir-faire généraux.`,
      extensible: true,
    },
    {
      id: 'confidentialite',
      title: 'Article 6 – Confidentialité',
      body: `Chaque partie s’engage à conserver strictement confidentielles toutes les informations échangées dans le cadre du présent contrat, pendant son exécution et pendant **{{dureeConfidentialite}} ans** après son terme.

Cette obligation ne s’applique pas aux informations tombées dans le domaine public ou divulguées sur ordre d’une autorité judiciaire.`,
      variables: [
        { key: 'dureeConfidentialite', label: 'Durée post-contrat (ans)', type: 'number', placeholder: '3' },
      ],
      extensible: true,
    },
    {
      id: 'responsabilite',
      title: 'Article 7 – Responsabilité & garanties',
      body: `Le Prestataire est tenu d’une obligation de **{{typeObligation}}**.

Sa responsabilité contractuelle est expressément limitée au montant total des honoraires perçus au titre du présent contrat. Il ne pourra être tenu responsable des dommages indirects (perte de données, manque à gagner, atteinte à l’image).`,
      variables: [
        { key: 'typeObligation', label: 'Type d’obligation', placeholder: 'moyens / résultat' },
      ],
      extensible: true,
    },
    {
      id: 'resiliation',
      title: 'Article 8 – Résiliation',
      body: `Chaque partie peut résilier le présent contrat à tout moment, moyennant un préavis écrit de **{{preavisJours}} jours**.

En cas de manquement grave de l’une des parties, le contrat pourra être résilié de plein droit, sans préavis ni indemnité, après mise en demeure restée infructueuse pendant quinze (15) jours.

Les sommes correspondant au travail effectivement réalisé restent dues au Prestataire.`,
      variables: [
        { key: 'preavisJours', label: 'Préavis (jours)', type: 'number', placeholder: '15' },
      ],
      extensible: true,
    },
    {
      id: 'force-majeure',
      title: 'Article 9 – Force majeure',
      body: `Aucune partie ne pourra être tenue responsable d’un manquement résultant d’un cas de force majeure tel que défini par les articles 119 et suivants de l’Acte uniforme OHADA portant droit commercial général.

En cas de force majeure d’une durée supérieure à trente (30) jours, chaque partie pourra résilier le contrat sans indemnité.`,
      extensible: true,
    },
    {
      id: 'loi-applicable',
      title: 'Article 10 – Loi applicable & règlement des litiges',
      body: `Le présent contrat est régi par le **droit congolais** et par les **Actes uniformes OHADA**.

Tout différend sera soumis, à défaut de règlement amiable dans un délai de quinze (15) jours, à l’arbitrage de la **Cour Commune de Justice et d’Arbitrage (CCJA) d’Abidjan** conformément au Règlement d’arbitrage OHADA, ou, alternativement et au choix du demandeur, au Tribunal de Commerce de **{{tribunalCompetent}}**.`,
      variables: [
        { key: 'tribunalCompetent', label: 'Tribunal compétent', placeholder: 'Brazzaville' },
      ],
      extensible: true,
    },
  ],
  footer: `Fait à **{{ville}}**, le **{{dateSignature}}**, en deux (2) exemplaires originaux.


Pour le Client                                    Pour le Prestataire
{{companyRepresentative}}                        {{employeeName}}
({{companyRepresentativeRole}})

(« Lu et approuvé » + signature)                 (« Lu et approuvé » + signature)`,
};

export const BUILTIN_CONTRACT_TEMPLATES: ContractTemplateDef[] = [
  CDI,
  CDD,
  MISSION,
  PRESTATION,
];

export function getTemplateById(id: string): ContractTemplateDef | undefined {
  return BUILTIN_CONTRACT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Substitute {{key}} placeholders in a body string with values from the map.
 * Empty / missing values are preserved as the placeholder so the user sees
 * what's still missing in the preview.
 */
function interpolate(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = values[key];
    if (v === undefined || v === null || String(v).trim() === '') {
      return `[${key}]`;
    }
    return String(v);
  });
}

/**
 * Render a full contract from a template, the parties + article variable
 * values, and any per-article overrides (custom body or appended text).
 *
 * `editedBodies[articleId]` — when set, replaces the article's default body.
 * `extraTexts[articleId]`   — appended after the (possibly edited) body.
 */
export function renderContract(
  tpl: ContractTemplateDef,
  values: Record<string, string>,
  extraTexts: Record<string, string>,
  editedBodies: Record<string, string> = {},
): string {
  const parts: string[] = [];
  parts.push(`# ${tpl.title}`);
  parts.push('');
  parts.push(interpolate(tpl.header, values));
  parts.push('');
  for (const art of tpl.articles) {
    parts.push('---');
    parts.push('');
    parts.push(`## ${art.title}`);
    parts.push('');
    const bodyToUse = editedBodies[art.id] ?? art.body;
    parts.push(interpolate(bodyToUse, values));
    const extra = (extraTexts[art.id] || '').trim();
    if (extra) {
      parts.push('');
      parts.push(extra);
    }
    parts.push('');
  }
  parts.push('---');
  parts.push('');
  parts.push(interpolate(tpl.footer, values));
  return parts.join('\n');
}
