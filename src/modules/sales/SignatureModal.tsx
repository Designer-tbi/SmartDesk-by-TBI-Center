import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eraser, FileSignature } from 'lucide-react';
import { Invoice } from '../../types';

interface Props {
  signingQuote: Invoice | null;
  companyInfo: any;
  currencySymbol: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  hasSignature: boolean;
  getContactName: (id: string) => string;
  onClose: () => void;
  onClear: () => void;
  onStartDrawing: (e: React.MouseEvent | React.TouchEvent) => void;
  onDraw: (e: React.MouseEvent | React.TouchEvent) => void;
  onStopDrawing: () => void;
  onSign: (id: string) => void;
  t: (key: string) => string;
}

export const SignatureModal: React.FC<Props> = ({
  signingQuote,
  companyInfo,
  currencySymbol,
  canvasRef,
  hasSignature,
  getContactName,
  onClose,
  onClear,
  onStartDrawing,
  onDraw,
  onStopDrawing,
  onSign,
  t,
}) => {
  return (
    <AnimatePresence>
      {signingQuote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
          >
            <div className="bg-accent-red p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Signature du Devis</h3>
                <p className="text-red-100 text-xs font-bold mt-1">
                  ID: {signingQuote.id} • {getContactName(signingQuote.contactId)}
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 max-h-[400px] overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">DEVIS {signingQuote.id}</h4>
                    <p className="text-xs text-slate-500 font-bold">Date: {signingQuote.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{companyInfo?.name || 'Entreprise'}</p>
                    <p className="text-[10px] text-slate-500">{companyInfo?.address || ''}</p>
                  </div>
                </div>

                <table className="w-full text-left mb-6">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                      <th className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {signingQuote.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-3">
                          <p className="text-sm font-bold text-slate-900">{item.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {item.quantity} x {item.price.toLocaleString()} {currencySymbol}
                          </p>
                        </td>
                        <td className="py-3 text-sm font-bold text-slate-900 text-right">
                          {(item.quantity * item.price).toLocaleString()} {currencySymbol}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <div className="w-48 space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                      <span>Total HT</span>
                      <span>{signingQuote.totalHT.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-black text-accent-red uppercase tracking-tight">
                      <span>Total TTC</span>
                      <span>
                        {signingQuote.total.toLocaleString()} {currencySymbol}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-6 pt-6 border-t border-slate-100">
                <div className="w-full max-w-md space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Signature Client</label>
                    <button
                      onClick={onClear}
                      className="flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-widest"
                    >
                      <Eraser className="w-3 h-3" /> Effacer
                    </button>
                  </div>
                  <div className="relative h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-crosshair">
                    <canvas
                      ref={canvasRef}
                      width={448}
                      height={192}
                      className="w-full h-full"
                      onMouseDown={onStartDrawing}
                      onMouseMove={onDraw}
                      onMouseUp={onStopDrawing}
                      onMouseLeave={onStopDrawing}
                      onTouchStart={onStartDrawing}
                      onTouchMove={onDraw}
                      onTouchEnd={onStopDrawing}
                    />
                    {!hasSignature && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 italic text-sm">
                        Signez ici avec votre souris ou votre doigt
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 w-full">
                  <button
                    onClick={onClose}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => onSign(signingQuote.id)}
                    disabled={!hasSignature}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-2 ${
                      hasSignature
                        ? 'bg-accent-red text-white hover:bg-primary-red shadow-accent-red/20'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <FileSignature className="w-5 h-5" />
                    Valider le Devis
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
