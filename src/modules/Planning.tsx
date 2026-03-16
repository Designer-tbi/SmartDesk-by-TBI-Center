import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  Users, 
  X, 
  Check,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  User
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addDays, startOfYear, endOfYear, eachMonthOfInterval, addWeeks, subWeeks, addYears, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';

type ViewType = 'day' | 'week' | 'month';

interface Schedule {
  id: string;
  userId: string;
  userName: string;
  creatorName: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
}

export const Planning = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('week');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    userId: '',
    title: '',
    description: '',
    startDate: format(new Date(), "yyyy-MM-dd'T'09:00"),
    endDate: format(new Date(), "yyyy-MM-dd'T'17:00"),
    type: 'Travail',
    status: 'published'
  });

  useEffect(() => {
    fetchSchedules();
    fetchUsers();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) setCurrentUser(await res.json());
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/company/users');
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch('/api/schedules');
      if (res.ok) {
        setSchedules(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else if (view === 'day') setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else if (view === 'day') setCurrentDate(addDays(currentDate, 1));
  };

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'rh';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      const method = selectedSchedule ? 'PUT' : 'POST';
      const url = selectedSchedule ? `/api/schedules/${selectedSchedule.id}` : '/api/schedules';
      
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setSelectedSchedule(null);
        fetchSchedules();
      }
    } catch (err) {
      console.error('Failed to save schedule:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) return;
    if (!window.confirm('Supprimer ce planning ?')) return;
    try {
      const res = await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIsModalOpen(false);
        setSelectedSchedule(null);
        fetchSchedules();
      }
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  const openAddModal = (date?: Date, userId?: string) => {
    if (!canManage) return;
    const start = date ? format(date, "yyyy-MM-dd'T'09:00") : format(new Date(), "yyyy-MM-dd'T'09:00");
    const end = date ? format(date, "yyyy-MM-dd'T'17:00") : format(new Date(), "yyyy-MM-dd'T'17:00");
    
    setFormData({
      userId: userId || '',
      title: 'Poste de travail',
      description: '',
      startDate: start,
      endDate: end,
      type: 'Travail',
      status: 'published'
    });
    setSelectedSchedule(null);
    setIsModalOpen(true);
  };

  const openEditModal = (schedule: Schedule) => {
    if (!canManage) return;
    setSelectedSchedule(schedule);
    setFormData({
      userId: schedule.userId,
      title: schedule.title,
      description: schedule.description,
      startDate: format(new Date(schedule.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(schedule.endDate), "yyyy-MM-dd'T'HH:mm"),
      type: schedule.type,
      status: schedule.status
    });
    setIsModalOpen(true);
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: startDate, end: addDays(startDate, 6) });
    
    // In planning view, we might want to see all users if admin, or just self
    const displayUsers = canManage ? users : users.filter(u => u.id === currentUser?.id);

    return (
      <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50">
          <div className="p-4 border-r border-slate-200 font-bold text-slate-500 text-xs uppercase tracking-wider">Employé</div>
          {weekDays.map(day => (
            <div key={day.toString()} className="p-2 text-center border-r border-slate-200 last:border-r-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase">{format(day, 'EEE', { locale: fr })}</div>
              <div className={`text-sm font-bold ${isSameDay(day, new Date()) ? 'text-indigo-600' : 'text-slate-700'}`}>{format(day, 'd')}</div>
            </div>
          ))}
        </div>
        <div className="flex-1">
          {displayUsers.map(user => (
            <div key={user.id} className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-slate-100 last:border-b-0 hover:bg-slate-50/30 transition-colors">
              <div className="p-4 border-r border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-bold text-slate-900 truncate">{user.name}</span>
                  <span className="text-[10px] text-slate-500 uppercase font-medium">{user.role}</span>
                </div>
              </div>
              {weekDays.map(day => {
                const daySchedules = schedules.filter(s => s.userId === user.id && isSameDay(new Date(s.startDate), day));
                return (
                  <div 
                    key={day.toString()} 
                    className="p-2 border-r border-slate-100 last:border-r-0 min-h-[80px] relative group"
                    onClick={() => canManage && openAddModal(day, user.id)}
                  >
                    {daySchedules.map(sch => (
                      <div 
                        key={sch.id}
                        onClick={(e) => { e.stopPropagation(); openEditModal(sch); }}
                        className={`p-1.5 mb-1 rounded text-[10px] font-bold border cursor-pointer transition-all hover:shadow-sm ${
                          sch.type === 'Congé' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          sch.type === 'Maladie' ? 'bg-red-50 border-red-200 text-red-700' :
                          'bg-indigo-50 border-indigo-200 text-indigo-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{format(new Date(sch.startDate), 'HH:mm')} - {format(new Date(sch.endDate), 'HH:mm')}</span>
                        </div>
                        <div className="truncate">{sch.title}</div>
                      </div>
                    ))}
                    {canManage && (
                      <button className="absolute bottom-1 right-1 p-1 bg-white border border-slate-200 rounded text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-600 hover:border-indigo-200">
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={handlePrev} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">Aujourd'hui</button>
            <button onClick={handleNext} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          </div>
          <h2 className="text-xl font-black text-slate-900 capitalize">
            {format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMMM', { locale: fr })} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMMM yyyy', { locale: fr })}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <button 
              onClick={() => openAddModal()}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Nouveau Planning
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {view === 'week' && renderWeekView()}
          </>
        )}
      </div>

      {/* Schedule Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  {selectedSchedule ? 'Modifier le planning' : 'Nouveau planning'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Employé</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  >
                    <option value="">Sélectionner un employé</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Titre / Poste</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Poste Matin, Caisse, etc."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Début</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Fin</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Type</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="Travail">Travail</option>
                    <option value="Congé">Congé</option>
                    <option value="Maladie">Maladie</option>
                    <option value="Formation">Formation</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                  <textarea
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Instructions particulières..."
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  {selectedSchedule ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedSchedule.id)}
                      className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      Supprimer
                    </button>
                  ) : <div />}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      {selectedSchedule ? 'Mettre à jour' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
