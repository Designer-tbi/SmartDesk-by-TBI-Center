import React, { useState, useEffect } from 'react';
import { Plus, Filter, MoreVertical, Mail, Phone, ExternalLink, X, User, Building2, Globe, Tag, Briefcase, Check, Pencil, Trash2, Eye, Calendar, Loader2 } from 'lucide-react';
import { Contact } from '../types';

export const CRM = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'Tous' | 'Client' | 'Lead'>('Tous');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'alpha'>('recent');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    name: '',
    email: '',
    phone: '',
    company: '',
    role: '',
    notes: '',
    status: 'Lead',
    lastContact: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/contacts');
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContacts = contacts
    .filter(contact => filter === 'Tous' ? true : contact.status === filter)
    .sort((a, b) => {
      if (sortBy === 'alpha') {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime();
    });

  const resetForm = () => {
    setNewContact({
      name: '', email: '', phone: '', company: '', role: '', notes: '', status: 'Lead', lastContact: new Date().toISOString().split('T')[0]
    });
    setEditingContactId(null);
    setIsModalOpen(false);
  };

  const handleAddOrUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingContactId) {
        const response = await fetch(`/api/contacts/${editingContactId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newContact),
        });
        if (response.ok) {
          fetchContacts();
        }
      } else {
        const id = Math.random().toString(36).substr(2, 9);
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newContact, id }),
        });
        if (response.ok) {
          fetchContacts();
        }
      }
      resetForm();
    } catch (error) {
      console.error('Failed to save contact:', error);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) {
      try {
        const response = await fetch(`/api/contacts/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          fetchContacts();
        }
      } catch (error) {
        console.error('Failed to delete contact:', error);
      }
    }
  };

  const openEdit = (contact: Contact) => {
    setNewContact(contact);
    setEditingContactId(contact.id);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {(['Tous', 'Client', 'Lead'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                  filter === f 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {f === 'Tous' ? 'Tous' : f + 's'}
              </button>
            ))}
          </div>
          <div className="relative">
            <button 
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Filter className="w-4 h-4" />
              Filtres
            </button>
            
            {isFilterMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3 border-b border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">Trier par</h4>
                  <div className="space-y-1">
                    <button 
                      onClick={() => { setSortBy('recent'); setIsFilterMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'recent' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Plus récent
                      {sortBy === 'recent' && <Check className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => { setSortBy('alpha'); setIsFilterMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'alpha' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Ordre alphabétique
                      {sortBy === 'alpha' && <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Nouveau Contact
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-slate-500">Chargement des contacts...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nom / Entreprise</th>
                  <th className="hidden sm:table-cell px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coordonnées</th>
                  <th className="hidden md:table-cell px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dernier Contact</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContacts.length > 0 ? filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-100">
                          {contact.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{contact.name}</div>
                          <div className="text-xs font-medium text-slate-500">{contact.company}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        contact.status === 'Client' ? 'bg-emerald-100 text-emerald-700' : 
                        contact.status === 'Lead' ? 'bg-amber-100 text-amber-700' : 
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {contact.email}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {contact.phone}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-5 text-sm font-medium text-slate-600">
                      {contact.lastContact}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <button onClick={() => setViewContact(contact)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md" title="Prévisualiser">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(contact)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md" title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteContact(contact.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500 text-sm">
                      Aucun contact trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Slide-over Nouveau Contact */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="absolute inset-0" onClick={resetForm}></div>
          
          <div className="relative w-full max-w-md sm:max-w-lg md:max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{editingContactId ? 'Modifier le Contact' : 'Nouveau Contact'}</h3>
                <p className="text-sm text-slate-500">{editingContactId ? 'Mettez à jour les informations du contact.' : 'Ajoutez un nouveau client ou prospect.'}</p>
              </div>
              <button 
                onClick={resetForm}
                className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="new-contact-form" onSubmit={handleAddOrUpdateContact} className="space-y-6">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-indigo-300">
                    <User className="w-8 h-8" />
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nom Complet *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: Jean Dupont"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={newContact.name}
                        onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Fonction</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Ex: Directeur Marketing"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={newContact.role || ''}
                        onChange={(e) => setNewContact({...newContact, role: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email *</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          required
                          type="email" 
                          placeholder="jean@exemple.com"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          value={newContact.email}
                          onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Téléphone *</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          required
                          type="tel" 
                          placeholder="01 23 45 67 89"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          value={newContact.phone}
                          onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Entreprise *</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: Tech Solutions SARL"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={newContact.company}
                        onChange={(e) => setNewContact({...newContact, company: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Statut du Contact *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Lead', 'Client'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewContact({...newContact, status: s as any})}
                          className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border transition-all ${
                            newContact.status === s 
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-500/10" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Tag className="w-4 h-4" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                    <div className="relative">
                      <textarea 
                        rows={3} 
                        placeholder="Informations additionnelles..."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        value={newContact.notes || ''}
                        onChange={(e) => setNewContact({...newContact, notes: e.target.value})}
                      ></textarea>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button 
                type="button"
                onClick={resetForm}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all active:scale-95"
              >
                Annuler
              </button>
              <button 
                type="submit"
                form="new-contact-form"
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
              >
                {editingContactId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {viewContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Détails du Contact</h3>
              <button 
                onClick={() => setViewContact(null)}
                className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-indigo-100">
                  {viewContact.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{viewContact.name}</h4>
                  <p className="text-sm font-medium text-slate-500">
                    {viewContact.role ? `${viewContact.role} chez ` : ''}{viewContact.company}
                  </p>
                  <span className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    viewContact.status === 'Client' ? 'bg-emerald-100 text-emerald-700' : 
                    viewContact.status === 'Lead' ? 'bg-amber-100 text-amber-700' : 
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {viewContact.status}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {viewContact.email}
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {viewContact.phone}
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Dernier contact : {new Date(viewContact.lastContact).toLocaleDateString('fr-FR')}
                </div>
              </div>
              
              {viewContact.notes && (
                <div>
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Notes</h5>
                  <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100 leading-relaxed">
                    {viewContact.notes}
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button 
                onClick={() => { setViewContact(null); openEdit(viewContact); }}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
              >
                Modifier le Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
