/**
 * Built-in contract templates.
 *
 * Each template is a declarative structure that drives three things:
 *   1. The form the user sees when creating a contract (fields are derived
 *      from each article's `variables`).
 *   2. The generated markdown that populates `contract.content`.
 *   3. Validation (required variables).
 *
 * Variables with an `autofill` hint are pre-filled from the current
 * company / selected employee so the user doesn't retype them.
 */

export type ContractVariableType = 'text' | 'textarea' | 'date' | 'number';

export type ContractVariable = {
  key: string;
  label: string;
  placeholder?: string;
  type?: ContractVariableType;
  /** Pre-fill source when the form opens. */
  autofill?:
    | 'companyName'
    | 'companyAddress'
    | 'companyRepresentative'
    | 'employeeName'
    | 'employeeAddress'
    | 'employeeRole'
    | 'employeeSalary'
    | 'contractStartDate'
    | 'city'
    | 'today';
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
// CDD — Contrat à Durée Déterminée
// ------------------------------------------------------------------
const CDD: ContractTemplateDef = {
  id: 'CDD',
  label: 'CDD',
  title: 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE (CDD)',
  tagline: 'Emploi à durée déterminée (remplacement, projet, surcroît)',
  contractType: 'CDD',
  partiesVariables: [
    { key: 'companyName', label: 'Nom de l’entreprise', autofill: 'companyName' },
    { key: 'companyAddress', label: 'Adresse de l’entreprise', autofill: 'companyAddress', type: 'textarea' },
    { key: 'companyRepresentative', label: 'Représenté par', autofill: 'companyRepresentative' },
    { key: 'employeeName', label: 'Nom et prénom du salarié', autofill: 'employeeName' },
    { key: 'employeeAddress', label: 'Adresse du salarié', autofill: 'employeeAddress', type: 'textarea' },
  ],
  header: `**L'Employeur :**
{{companyName}}
{{companyAddress}}
Représenté par : {{companyRepresentative}}

**Et**

**Le Salarié :**
{{employeeName}}
{{employeeAddress}}`,
  articles: [
    {
      id: 'objet',
      title: 'Article 1 – Objet',
      body: `Le présent contrat est un contrat à durée déterminée conclu pour : {{motif}}.`,
      variables: [
        {
          key: 'motif',
          label: 'Motif du CDD',
          placeholder: 'remplacement / projet / accroissement d’activité',
        },
      ],
      extensible: true,
    },
    {
      id: 'duree',
      title: 'Article 2 – Durée',
      body: `Le contrat est conclu pour une durée de {{dureeMois}} mois, du {{dateDebut}} au {{dateFin}}.`,
      variables: [
        { key: 'dureeMois', label: 'Durée (mois)', type: 'number', placeholder: '6' },
        { key: 'dateDebut', label: 'Date de début', type: 'date', autofill: 'contractStartDate' },
        { key: 'dateFin', label: 'Date de fin', type: 'date' },
      ],
      extensible: true,
    },
    {
      id: 'fonction',
      title: 'Article 3 – Fonction',
      body: `Le salarié est recruté en qualité de : {{poste}}.`,
      variables: [
        { key: 'poste', label: 'Poste / fonction', autofill: 'employeeRole' },
      ],
      extensible: true,
    },
    {
      id: 'remuneration',
      title: 'Article 4 – Rémunération',
      body: `Le salarié percevra un salaire mensuel de : {{salaire}} {{devise}}.`,
      variables: [
        { key: 'salaire', label: 'Salaire mensuel', type: 'number', autofill: 'employeeSalary' },
        { key: 'devise', label: 'Devise', placeholder: 'FCFA' },
      ],
      extensible: true,
    },
    {
      id: 'tempsTravail',
      title: 'Article 5 – Temps de travail',
      body: `Le temps de travail est fixé à : {{heuresSemaine}} heures / semaine.`,
      variables: [
        { key: 'heuresSemaine', label: 'Heures / semaine', type: 'number', placeholder: '40' },
      ],
      extensible: true,
    },
    {
      id: 'obligations',
      title: 'Article 6 – Obligations',
      body: `Le salarié s'engage à respecter :

* les règles de l'entreprise
* la confidentialité`,
      extensible: true,
    },
    {
      id: 'finContrat',
      title: 'Article 7 – Fin du contrat',
      body: `Le contrat prend fin à la date prévue sans indemnité sauf disposition contraire.`,
      extensible: true,
    },
  ],
  footer: `Fait à {{ville}}, le {{dateSignature}}

Signature Employeur
Signature Salarié`,
};

// ------------------------------------------------------------------
// CDI — Contrat à Durée Indéterminée
// ------------------------------------------------------------------
const CDI: ContractTemplateDef = {
  id: 'CDI',
  label: 'CDI',
  title: 'CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE (CDI)',
  tagline: 'Engagement permanent à durée indéterminée',
  contractType: 'CDI',
  partiesVariables: [
    { key: 'companyName', label: 'Nom de l’entreprise', autofill: 'companyName' },
    { key: 'employeeName', label: 'Nom du salarié', autofill: 'employeeName' },
  ],
  header: `Entre :
{{companyName}}

Et
{{employeeName}}`,
  articles: [
    {
      id: 'objet',
      title: 'Article 1 – Objet',
      body: `Le salarié est recruté en CDI en qualité de : {{poste}}.`,
      variables: [
        { key: 'poste', label: 'Poste / fonction', autofill: 'employeeRole' },
      ],
      extensible: true,
    },
    {
      id: 'essai',
      title: 'Article 2 – Période d’essai',
      body: `Une période d'essai de {{dureeEssai}} est prévue.`,
      variables: [
        {
          key: 'dureeEssai',
          label: 'Durée de la période d’essai',
          placeholder: '1 à 3 mois',
        },
      ],
      extensible: true,
    },
    {
      id: 'remuneration',
      title: 'Article 3 – Rémunération',
      body: `Salaire mensuel : {{salaire}} {{devise}}.`,
      variables: [
        { key: 'salaire', label: 'Salaire mensuel', type: 'number', autofill: 'employeeSalary' },
        { key: 'devise', label: 'Devise', placeholder: 'FCFA' },
      ],
      extensible: true,
    },
    {
      id: 'tempsTravail',
      title: 'Article 4 – Temps de travail',
      body: `{{heuresSemaine}} heures / semaine`,
      variables: [
        { key: 'heuresSemaine', label: 'Heures / semaine', type: 'number', placeholder: '40' },
      ],
      extensible: true,
    },
    {
      id: 'obligations',
      title: 'Article 5 – Obligations',
      body: `* Respect du règlement intérieur
* Confidentialité`,
      extensible: true,
    },
    {
      id: 'resiliation',
      title: 'Article 6 – Résiliation',
      body: `Le contrat peut être résilié selon les dispositions du Code du travail {{juridiction}}.`,
      variables: [
        {
          key: 'juridiction',
          label: 'Juridiction applicable',
          placeholder: 'congolais',
        },
      ],
      extensible: true,
    },
  ],
  footer: `Fait à {{ville}}, le {{dateSignature}}

Signature Employeur
Signature Salarié`,
};

// ------------------------------------------------------------------
// MISSION — Contrat de Mission (Intérim)
// ------------------------------------------------------------------
const MISSION: ContractTemplateDef = {
  id: 'MISSION',
  label: 'Mission',
  title: 'CONTRAT DE MISSION (INTÉRIM)',
  tagline: 'Mission temporaire via intérim',
  contractType: 'CDD',
  partiesVariables: [
    { key: 'companyName', label: 'Entreprise utilisatrice', autofill: 'companyName' },
    { key: 'employeeName', label: 'Travailleur intérimaire', autofill: 'employeeName' },
  ],
  header: `Entre :
{{companyName}}

Et
{{employeeName}}`,
  articles: [
    {
      id: 'objet',
      title: 'Article 1 – Objet',
      body: `Mission temporaire en qualité de : {{poste}}.`,
      variables: [
        { key: 'poste', label: 'Poste de mission', autofill: 'employeeRole' },
      ],
      extensible: true,
    },
    {
      id: 'duree',
      title: 'Article 2 – Durée',
      body: `Du {{dateDebut}} au {{dateFin}}.`,
      variables: [
        { key: 'dateDebut', label: 'Date de début', type: 'date', autofill: 'contractStartDate' },
        { key: 'dateFin', label: 'Date de fin', type: 'date' },
      ],
      extensible: true,
    },
    {
      id: 'remuneration',
      title: 'Article 3 – Rémunération',
      body: `{{salaire}} {{devise}}`,
      variables: [
        { key: 'salaire', label: 'Rémunération', type: 'number', autofill: 'employeeSalary' },
        { key: 'devise', label: 'Devise', placeholder: 'FCFA' },
      ],
      extensible: true,
    },
    {
      id: 'conditions',
      title: 'Article 4 – Conditions',
      body: `Le travailleur exécute sa mission sous l'autorité de l'entreprise.`,
      extensible: true,
    },
    {
      id: 'finMission',
      title: 'Article 5 – Fin de mission',
      body: `Fin automatique à la date prévue.`,
      extensible: true,
    },
  ],
  footer: `Fait à {{ville}}, le {{dateSignature}}`,
};

// ------------------------------------------------------------------
// PRESTATION — Prestation de services (Indépendant)
// ------------------------------------------------------------------
const PRESTATION: ContractTemplateDef = {
  id: 'PRESTATION',
  label: 'Prestation',
  title: 'CONTRAT DE PRESTATION DE SERVICES (INDÉPENDANT)',
  tagline: 'Prestation freelance — sans lien de subordination',
  contractType: 'Freelance',
  partiesVariables: [
    { key: 'companyName', label: 'Client — Nom entreprise', autofill: 'companyName' },
    { key: 'employeeName', label: 'Prestataire — Nom', autofill: 'employeeName' },
  ],
  header: `**Le Client :**
{{companyName}}

**Le Prestataire :**
{{employeeName}}`,
  articles: [
    {
      id: 'objet',
      title: 'Article 1 – Objet',
      body: `Le prestataire réalisera : {{mission}}.`,
      variables: [
        {
          key: 'mission',
          label: 'Description de la mission',
          type: 'textarea',
          placeholder: 'Ex. : Développement d’une application web…',
        },
      ],
      extensible: true,
    },
    {
      id: 'independance',
      title: 'Article 2 – Indépendance',
      body: `Le prestataire agit en toute indépendance, sans lien de subordination.`,
      extensible: true,
    },
    {
      id: 'remuneration',
      title: 'Article 3 – Rémunération',
      body: `Montant : {{montant}} {{devise}}
Paiement : {{modalitesPaiement}}`,
      variables: [
        { key: 'montant', label: 'Montant', type: 'number' },
        { key: 'devise', label: 'Devise', placeholder: 'FCFA / USD / EUR' },
        {
          key: 'modalitesPaiement',
          label: 'Modalités de paiement',
          placeholder: 'virement bancaire à 30 jours',
        },
      ],
      extensible: true,
    },
    {
      id: 'duree',
      title: 'Article 4 – Durée',
      body: `Du {{dateDebut}} au {{dateFin}}`,
      variables: [
        { key: 'dateDebut', label: 'Date de début', type: 'date', autofill: 'contractStartDate' },
        { key: 'dateFin', label: 'Date de fin', type: 'date' },
      ],
      extensible: true,
    },
    {
      id: 'confidentialite',
      title: 'Article 5 – Confidentialité',
      body: `Le prestataire s'engage à ne divulguer aucune information.`,
      extensible: true,
    },
    {
      id: 'resiliation',
      title: 'Article 6 – Résiliation',
      body: `Résiliation possible avec préavis de {{preavisJours}} jours.`,
      variables: [
        { key: 'preavisJours', label: 'Préavis (jours)', type: 'number', placeholder: '15' },
      ],
      extensible: true,
    },
  ],
  footer: `Fait à {{ville}}, le {{dateSignature}}

Signature Client
Signature Prestataire`,
};

export const BUILTIN_CONTRACT_TEMPLATES: ContractTemplateDef[] = [
  CDD,
  CDI,
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
 * values, and any extra free-text appended by the user to each article.
 *
 * Returns markdown text suitable for Contract.content (and for later PDF
 * export).
 */
export function renderContract(
  tpl: ContractTemplateDef,
  values: Record<string, string>,
  extraTexts: Record<string, string>,
): string {
  const parts: string[] = [];
  parts.push(`**${tpl.title}**`);
  parts.push('');
  parts.push(interpolate(tpl.header, values));
  parts.push('');
  for (const art of tpl.articles) {
    parts.push('---');
    parts.push('');
    parts.push(`## ${art.title}`);
    parts.push('');
    parts.push(interpolate(art.body, values));
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
