import React, { useState } from 'react';
import { MOCK_COMPANY } from '../constants';
import { Building2, Mail, Phone, Globe, MapPin, FileText, Save, CheckCircle } from 'lucide-react';
import { CompanyInfo } from '../types';

export const Settings = () => {
  const [company, setCompany] = useState<CompanyInfo>(MOCK_COMPANY);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, we would save to a backend here
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Informations de l'Entreprise
          </h3>
          <p className="text-sm text-slate-500 mt-1">Ces informations apparaîtront sur vos factures et devis.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nom de l'entreprise</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">NIF (Numéro d'Identification Fiscale)</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.taxId}
                  onChange={(e) => setCompany({ ...company, taxId: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">RCCM</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.rccm}
                  onChange={(e) => setCompany({ ...company, rccm: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ID NAT</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.idNat}
                  onChange={(e) => setCompany({ ...company, idNat: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email de contact</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Téléphone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Site Web</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="url"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Adresse complète</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  rows={3}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  value={company.address}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              {isSaved && (
                <div className="flex items-center gap-1.5 text-emerald-600 animate-in fade-in slide-in-from-left-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Paramètres enregistrés avec succès !</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              <Save className="w-4 h-4" />
              Enregistrer les modifications
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Prévisualisation de l'en-tête</h3>
        <div className="p-6 border border-slate-100 rounded-xl bg-slate-50/30">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xl font-black text-slate-900 tracking-tight uppercase">{company.name}</div>
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{company.address}</p>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-700">{company.email}</p>
              <p>{company.phone}</p>
              <p>{company.website}</p>
              <div className="pt-2 font-bold text-slate-900 space-y-0.5">
                <p>{company.taxId}</p>
                <p>{company.rccm}</p>
                <p>{company.idNat}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
