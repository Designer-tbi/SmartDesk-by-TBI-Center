/**
 * Shared OHADA-style invoice computation.
 *
 *   Brut HT
 *   – Rabais        (defect / non-conformité)
 *   – Remise        (commercial)
 *   – Ristourne     (volume / fidélité)
 *   = Net commercial
 *   – Escompte      (paiement comptant)
 *   = Net financier
 *   + TVA           (sur Net financier)
 *   + Centimes additionnels  (= TVA × 5%, RC seulement)
 *   = Total TTC
 *
 * Each reduction can be expressed as an absolute amount OR a percentage
 * via the matching `*Type` field (`'amount' | 'percent'`).
 */

export interface InvoiceItemInput {
  quantity?: number;
  price?: number;
  tvaRate?: number;
  tvaAmount?: number;
}

export interface InvoiceReductionInput {
  remise?: number;
  remiseType?: 'amount' | 'percent';
  rabais?: number;
  rabaisType?: 'amount' | 'percent';
  ristourne?: number;
  ristourneType?: 'amount' | 'percent';
  escompte?: number;
  escompteType?: 'amount' | 'percent';
}

export interface InvoiceTotals {
  brutHT: number;
  rabaisAmount: number;
  remiseAmount: number;
  ristourneAmount: number;
  netCommercial: number;
  escompteAmount: number;
  netFinancier: number;
  tvaTotal: number;
  centimesAdditionnels: number;
  total: number;
}

const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;

const reduce = (base: number, value: number, type?: 'amount' | 'percent') =>
  Math.max(0, type === 'percent' ? base * (num(value) / 100) : num(value));

export function computeInvoiceTotals(
  items: InvoiceItemInput[],
  reductions: InvoiceReductionInput,
  opts: { applyCentimesAdditionnels?: boolean } = {},
): InvoiceTotals {
  const brutHT = (items || []).reduce(
    (acc, it) => acc + num(it.quantity) * num(it.price),
    0,
  );

  const rabaisAmount = reduce(brutHT, num(reductions.rabais), reductions.rabaisType);
  const afterRabais = Math.max(0, brutHT - rabaisAmount);

  const remiseAmount = reduce(afterRabais, num(reductions.remise), reductions.remiseType);
  const afterRemise = Math.max(0, afterRabais - remiseAmount);

  const ristourneAmount = reduce(afterRemise, num(reductions.ristourne), reductions.ristourneType);
  const netCommercial = Math.max(0, afterRemise - ristourneAmount);

  const escompteAmount = reduce(netCommercial, num(reductions.escompte), reductions.escompteType);
  const netFinancier = Math.max(0, netCommercial - escompteAmount);

  // TVA proportionally on net financier — the per-line `tvaRate` weights
  // the total VAT so a heterogeneous basket keeps its blended rate even
  // after global reductions.
  const tvaPerLineRaw = (items || []).reduce(
    (acc, it) => acc + num(it.quantity) * num(it.price) * num(it.tvaRate),
    0,
  );
  const tvaTotal = brutHT > 0
    ? Number((tvaPerLineRaw * (netFinancier / brutHT)).toFixed(2))
    : 0;

  const centimesAdditionnels = opts.applyCentimesAdditionnels
    ? Number((tvaTotal * 0.05).toFixed(2))
    : 0;

  const total = Number((netFinancier + tvaTotal + centimesAdditionnels).toFixed(2));

  return {
    brutHT: Number(brutHT.toFixed(2)),
    rabaisAmount: Number(rabaisAmount.toFixed(2)),
    remiseAmount: Number(remiseAmount.toFixed(2)),
    ristourneAmount: Number(ristourneAmount.toFixed(2)),
    netCommercial: Number(netCommercial.toFixed(2)),
    escompteAmount: Number(escompteAmount.toFixed(2)),
    netFinancier: Number(netFinancier.toFixed(2)),
    tvaTotal,
    centimesAdditionnels,
    total,
  };
}
