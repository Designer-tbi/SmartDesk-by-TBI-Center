/**
 * CNSS / TUS monthly declaration formulas — Congo-Brazzaville.
 *
 * Rates and ceilings are transcribed verbatim from the official
 * "Déclaration Globale de Cotisation" form (Caisse Nationale de Sécurité
 * Sociale). They are employer-side law values, not per-company settings —
 * same precedent as the hardcoded IRPP brackets in automations.ts.
 */

export const TUS_RATE = 0.03;
export const CNSS_PENSION_RATE = 0.12;
export const CNSS_PENSION_CEILING = 1_200_000;
export const CNSS_ATMP_PF_RATE = 0.1228;
export const CNSS_ATMP_PF_CEILING = 600_000;

export interface CnssLineInput {
  employeeId: string;
  matriculeSolde: string;
  cnssNumber: string;
  nom: string;
  postNom: string;
  prenom: string;
  workerType: 'Travailleur' | 'Stagiaire';
  department: string;
  joursTravailles: number;
  heuresTravaillees: number;
  salaireBase: number;
  indemniteVieChere: number;
  primes: number;
  gratifications: number;
  allocationsConges: number;
  avantagesNature: number;
  autresPrimes: number;
  autresIndemnites: number;
}

export interface CnssLineComputed extends CnssLineInput {
  salaireBrutGlobal: number;
  salaireSoumisCnss: number;
  montantCotisationCnss: number;
  montantTus: number;
}

const round = (n: number) => Math.round(n || 0);

export function computeLine(line: CnssLineInput): CnssLineComputed {
  const salaireBrutGlobal = round(
    Number(line.salaireBase || 0) +
    Number(line.indemniteVieChere || 0) +
    Number(line.primes || 0) +
    Number(line.gratifications || 0) +
    Number(line.allocationsConges || 0) +
    Number(line.avantagesNature || 0) +
    Number(line.autresPrimes || 0) +
    Number(line.autresIndemnites || 0),
  );
  const pensionBase = Math.min(salaireBrutGlobal, CNSS_PENSION_CEILING);
  const atmpPfBase = Math.min(salaireBrutGlobal, CNSS_ATMP_PF_CEILING);
  const montantCotisationCnss = round(pensionBase * CNSS_PENSION_RATE + atmpPfBase * CNSS_ATMP_PF_RATE);
  const montantTus = round(salaireBrutGlobal * TUS_RATE);

  return {
    ...line,
    salaireBrutGlobal,
    salaireSoumisCnss: pensionBase,
    montantCotisationCnss,
    montantTus,
  };
}

export interface CnssAdjustments {
  majorationTus: number;
  majorationCnss: number;
  penalite: number;
  deductionAvisCredit: number;
  acompte: number;
}

export interface CnssTotals {
  effectif: number;
  salaireBrutDeplafonne: number;
  tus: number;
  majorationTus: number;
  sousTotal1: number;
  cnssPension: number;
  cnssAtmpPf: number;
  majorationCnss: number;
  penalite: number;
  deductionAvisCredit: number;
  sousTotal2: number;
  totalAPayer: number;
  acompte: number;
}

export function computeTotals(lines: CnssLineComputed[], adjustments: Partial<CnssAdjustments> = {}): CnssTotals {
  const majorationTus = Number(adjustments.majorationTus || 0);
  const majorationCnss = Number(adjustments.majorationCnss || 0);
  const penalite = Number(adjustments.penalite || 0);
  const deductionAvisCredit = Number(adjustments.deductionAvisCredit || 0);
  const acompte = Number(adjustments.acompte || 0);

  const salaireBrutDeplafonne = round(lines.reduce((acc, l) => acc + l.salaireBrutGlobal, 0));
  const tus = round(lines.reduce((acc, l) => acc + l.montantTus, 0));
  const cnssPension = round(lines.reduce((acc, l) => acc + Math.min(l.salaireBrutGlobal, CNSS_PENSION_CEILING) * CNSS_PENSION_RATE, 0));
  const cnssAtmpPf = round(lines.reduce((acc, l) => acc + Math.min(l.salaireBrutGlobal, CNSS_ATMP_PF_CEILING) * CNSS_ATMP_PF_RATE, 0));

  const sousTotal1 = round(tus + majorationTus);
  const sousTotal2 = round(cnssPension + cnssAtmpPf + majorationCnss + penalite - deductionAvisCredit);
  const totalAPayer = round(sousTotal1 + sousTotal2);

  return {
    effectif: lines.length,
    salaireBrutDeplafonne,
    tus,
    majorationTus,
    sousTotal1,
    cnssPension,
    cnssAtmpPf,
    majorationCnss,
    penalite,
    deductionAvisCredit,
    sousTotal2,
    totalAPayer,
    acompte,
  };
}
