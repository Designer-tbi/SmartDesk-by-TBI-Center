import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Eraser, Loader2, FileSignature, ShieldCheck } from 'lucide-react';

/**
 * Public signature page.
 *
 * Reached via the link emailed to the recipient: `/sign-quote/:id`.
 * No authentication is required; the URL itself acts as the access token.
 *
 * The recipient draws their signature on a canvas, types their name and
 * confirms — we POST `{ signerName, signatureDataUrl }` to the public
 * `/api/public/quotes/:id/sign` endpoint which marks the quote `Signed`.
 */
export default function SignQuotePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  // The same page handles three URL shapes:
  //   /sign-quote/:id     → quote (devis)
  //   /sign-contract/:id  → contract (HR)
  //   /sign/:id           → contract (legacy HR link)
  const isContract =
    location.pathname.startsWith('/sign-contract/') ||
    (location.pathname.startsWith('/sign/') && !location.pathname.startsWith('/sign-quote/'));
  const apiBase = isContract ? '/api/public/contracts' : '/api/public/quotes';
  const docLabel = isContract ? 'Contrat' : 'Devis';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signedConfirmation, setSignedConfirmation] = useState<{ signedAt: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const isEmpty = useRef(true);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Map the pointer event into the canvas's internal coordinate space.
  // Without this, a stretched canvas (CSS width vs. internal width) draws
  // the stroke offset from the cursor, which feels imprecise.
  const eventToCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiBase}/${id}`, { credentials: 'omit' });
        if (!r.ok) {
          const e = await r.json().catch(() => null);
          throw new Error(e?.error || `HTTP ${r.status}`);
        }
        const json = await r.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur inconnue');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, apiBase]);

  /* ---- Canvas helpers ---- */
  const getCtx = () => canvasRef.current?.getContext('2d') || null;

  // Resize the canvas to its displayed size × devicePixelRatio so the stroke
  // is crisp on retina displays AND the cursor stays aligned with the line.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        // Capture existing strokes (if any) before resize to avoid wiping
        // user input on viewport resize.
        const snapshot = canvas.width && canvas.height ? canvas.toDataURL() : null;
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx && snapshot && !isEmpty.current) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, targetW, targetH);
          img.src = snapshot;
        }
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [loading, signedConfirmation]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const pt = eventToCanvasPoint(e);
    lastPoint.current = pt;
    const dpr = window.devicePixelRatio || 1;
    ctx.lineWidth = 2.2 * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    // Draw a tiny dot for single-tap so a click without movement still
    // registers as visible ink.
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    isEmpty.current = false;
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const pt = eventToCanvasPoint(e);
    const last = lastPoint.current ?? pt;
    // Continuous line between successive points — no gaps. lineCap='round'
    // and lineJoin='round' (set on pointerDown) keep corners smooth.
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPoint.current = pt;
    isEmpty.current = false;
  };
  const stopDrawing = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = false;
    lastPoint.current = null;
    if (e && canvasRef.current) {
      try { canvasRef.current.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isEmpty.current = true;
  };

  const handleSubmit = async () => {
    setError(null);
    if (signerName.trim().length < 2) {
      setError('Veuillez entrer votre nom complet.');
      return;
    }
    if (isEmpty.current) {
      setError('Merci de tracer votre signature dans le cadre.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSubmitting(true);
    try {
      const r = await fetch(`${apiBase}/${id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ signerName: signerName.trim(), signatureDataUrl: dataUrl }),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
      setSignedConfirmation({ signedAt: json.signedAt });
    } catch (e: any) {
      setError(e?.message || 'Échec de la signature');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-soft-red/30">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-accent-red" />
          Chargement du {docLabel.toLowerCase()}…
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-soft-red/30 p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-accent-red mx-auto mb-3" />
          <h1 className="text-xl font-black text-slate-900">Lien invalide</h1>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const inv = data?.invoice;
  const contract = data?.contract;
  const company = data?.company;
  const contact = data?.contact;
  const employee = data?.employee;
  const currency = company?.currency || '';
  const fmt = (n: number) => `${Number(n || 0).toLocaleString()} ${currency}`;

  // Already signed (either from the API on load, or after our own POST).
  const showSuccess = signedConfirmation || data?.alreadySigned;
  const docId = isContract ? contract?.id : inv?.id;
  const recipient = isContract ? employee : contact;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-soft-red/30 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-br from-[#7a0e1c] via-accent-red to-[#c1232a] text-white">
          <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.25em] uppercase opacity-80">
            <FileSignature className="w-3.5 h-3.5" />
            Signature électronique
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
            {docLabel} n° {docId}
          </h1>
          <p className="text-sm text-white/85 mt-1">
            Émis par <strong>{company?.name}</strong>
          </p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-7">
          {/* Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Émetteur</div>
              <div className="text-sm font-black text-slate-900">{company?.name}</div>
              <div className="text-xs text-slate-500 whitespace-pre-line">
                {company?.address || '—'}
              </div>
              {company?.niu && <div className="text-xs text-slate-500 mt-1">NIU : {company.niu}</div>}
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                {isContract ? 'Salarié(e)' : 'Destinataire'}
              </div>
              <div className="text-sm font-black text-slate-900">{recipient?.name || '—'}</div>
              <div className="text-xs text-slate-500">{recipient?.email || ''}</div>
              {isContract && employee?.position && (
                <div className="text-xs text-slate-500 mt-0.5">{employee.position}</div>
              )}
            </div>
          </div>

          {/* Body — items table for quotes, contract content for HR */}
          {isContract ? (
            <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                {contract?.type} — {contract?.startDate}
                {contract?.endDate ? ` → ${contract.endDate}` : ''}
              </div>
              <div
                className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap"
                data-testid="sign-contract-content"
              >
                {contract?.content}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 text-sm">
                <span className="text-slate-500">Rémunération : </span>
                <span className="font-black text-slate-900">{fmt(contract?.salary)}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Désignation</th>
                      <th className="px-4 py-3 text-right">Qté</th>
                      <th className="px-4 py-3 text-right">PU</th>
                      <th className="px-4 py-3 text-right">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inv?.items || []).map((it: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 align-top">
                          <div className="font-medium text-slate-900">{it.name}</div>
                          {it.description && (
                            <div className="text-xs text-slate-500 whitespace-pre-wrap break-words mt-0.5">
                              {it.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{it.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{fmt(it.price)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{fmt(it.quantity * it.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-full md:w-72 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Total HT</span><span>{fmt(inv?.totalHT)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>TVA</span><span>{fmt(inv?.tvaTotal)}</span></div>
                  <div className="flex justify-between text-base font-black text-accent-red border-t border-slate-200 pt-1.5">
                    <span>Total TTC</span><span>{fmt(inv?.total)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Signature zone OR confirmation */}
          {showSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex items-start gap-4" data-testid="sign-quote-success">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-black text-emerald-900 uppercase tracking-widest">{docLabel} signé</h3>
                <p className="text-sm text-slate-700 mt-1">
                  {signedConfirmation
                    ? `Merci, votre signature a bien été enregistrée le ${new Date(signedConfirmation.signedAt).toLocaleString('fr-FR')}.`
                    : 'Ce devis a déjà été signé.'}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Vous pouvez fermer cette page. {company?.name} a été notifié automatiquement.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent-red" />
                  Votre signature
                </h3>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nom complet *</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="ex. Jean Dupont"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                    data-testid="sign-quote-name-input"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signature manuscrite *</label>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-accent-red uppercase tracking-widest"
                  >
                    <Eraser className="w-3 h-3" /> Effacer
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  onPointerCancel={stopDrawing}
                  className="w-full h-44 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl touch-none cursor-crosshair"
                  data-testid="sign-quote-canvas"
                />
                <p className="text-[10px] text-slate-400">
                  Tracez votre signature avec la souris ou le doigt sur mobile.
                </p>
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                data-testid="sign-quote-submit-btn"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-accent-red text-white rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-primary-red shadow-lg shadow-accent-red/20 transition-all disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {submitting ? 'Enregistrement…' : 'Confirmer ma signature'}
              </button>
            </div>
          )}
        </div>

        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center">
          Document propulsé par <strong className="text-slate-700">SmartDesk</strong> · La signature électronique a la même valeur juridique qu'une signature manuscrite (eIDAS / OHADA).
        </div>
      </div>
    </div>
  );
}
