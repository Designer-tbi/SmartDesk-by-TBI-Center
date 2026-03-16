import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  Users, 
  X, 
  Check,
  CalendarDays,
  CalendarRange,
  CalendarDays as CalendarMonthIcon,
  LayoutGrid
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addDays, startOfYear, endOfYear, eachMonthOfInterval, addWeeks, subWeeks, addYears, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';

type ViewType = 'day' | 'week' | 'month' | 'year';

interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  category: string;
  isPrivate: boolean;
  userName?: string;
  assignedTo?: string;
  assignedToName?: string;
}

export const Agenda = () => {
  const { t, language } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endDate: format(addDays(new Date(), 0), "yyyy-MM-dd'T'HH:mm"),
    category: 'Réunion',
    isPrivate: false,
    assignedTo: ''
  });

  useEffect(() => {
    fetchEvents();
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

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch('/api/events');
      if (res.ok) {
        setEvents(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else if (view === 'day') setCurrentDate(addDays(currentDate, -1));
    else if (view === 'year') setCurrentDate(subYears(currentDate, 1));
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else if (view === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (view === 'year') setCurrentDate(addYears(currentDate, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = selectedEvent ? 'PUT' : 'POST';
      const url = selectedEvent ? `/api/events/${selectedEvent.id}` : '/api/events';
      
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setSelectedEvent(null);
        fetchEvents();
      }
    } catch (err) {
      console.error('Failed to save event:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('agenda.confirmDelete'))) return;
    try {
      const res = await apiFetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIsModalOpen(false);
        setSelectedEvent(null);
        fetchEvents();
      }
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const openAddModal = (date?: Date) => {
    const start = date ? format(date, "yyyy-MM-dd'T'09:00") : format(new Date(), "yyyy-MM-dd'T'HH:mm");
    const end = date ? format(date, "yyyy-MM-dd'T'10:00") : format(addDays(new Date(), 0), "yyyy-MM-dd'T'HH:mm");
    
    setFormData({
      title: '',
      description: '',
      startDate: start,
      endDate: end,
      category: 'Réunion',
      isPrivate: false,
      assignedTo: ''
    });
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const openEditModal = (event: Event) => {
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      startDate: format(new Date(event.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(event.endDate), "yyyy-MM-dd'T'HH:mm"),
      category: event.category,
      isPrivate: event.isPrivate,
      assignedTo: (event as any).assignedTo || ''
    });
    setIsModalOpen(true);
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 border-t border-l border-slate-200">
        {[
          t('common.days.mon'),
          t('common.days.tue'),
          t('common.days.wed'),
          t('common.days.thu'),
          t('common.days.fri'),
          t('common.days.sat'),
          t('common.days.sun')
        ].map(day => (
          <div key={day} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-b border-slate-200 bg-slate-50">
            {day}
          </div>
        ))}
        {calendarDays.map((day, i) => {
          const dayEvents = events.filter(e => isSameDay(new Date(e.startDate), day));
          return (
            <div 
              key={i} 
              onClick={() => openAddModal(day)}
              className={`min-h-[120px] p-2 border-r border-b border-slate-200 transition-colors cursor-pointer hover:bg-slate-50/50 ${
                !isSameMonth(day, monthStart) ? 'bg-slate-50/30 text-slate-300' : 'bg-white text-slate-700'
              } ${isSameDay(day, new Date()) ? 'bg-indigo-50/30' : ''}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-semibold ${isSameDay(day, new Date()) ? 'w-7 h-7 flex items-center justify-center bg-indigo-600 text-white rounded-full' : ''}`}>
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div 
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); openEditModal(event); }}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-100 text-indigo-700 truncate border border-indigo-200"
                  >
                    {format(new Date(event.startDate), 'HH:mm')} {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-slate-400 font-medium pl-1">
                    + {dayEvents.length - 3} {t('agenda.more')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: startDate, end: addDays(startDate, 6) });
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
          <div className="p-2 border-r border-slate-200"></div>
          {weekDays.map(day => (
            <div key={day.toString()} className="p-2 text-center border-r border-slate-200 last:border-r-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase">{format(day, 'EEE', { locale: language === 'fr' ? fr : undefined })}</div>
              <div className={`text-sm font-bold ${isSameDay(day, new Date()) ? 'text-indigo-600' : 'text-slate-700'}`}>{format(day, 'd')}</div>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto max-h-[600px]">
          <div className="grid grid-cols-8 relative">
            <div className="col-span-1">
              {hours.map(hour => (
                <div key={hour} className="h-20 border-r border-b border-slate-100 text-[10px] text-slate-400 p-1 text-right">
                  {hour}:00
                </div>
              ))}
            </div>
            {weekDays.map(day => (
              <div key={day.toString()} className="col-span-1 relative border-r border-slate-100 last:border-r-0">
                {hours.map(hour => (
                  <div key={hour} className="h-20 border-b border-slate-100" onClick={() => {
                    const d = new Date(day);
                    d.setHours(hour);
                    openAddModal(d);
                  }}></div>
                ))}
                {events.filter(e => isSameDay(new Date(e.startDate), day)).map(event => {
                  const start = new Date(event.startDate);
                  const end = new Date(event.endDate);
                  const top = (start.getHours() * 80) + (start.getMinutes() * 80 / 60);
                  const height = Math.max(40, ((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 80);
                  
                  return (
                    <div 
                      key={event.id}
                      onClick={() => openEditModal(event)}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      className="absolute left-1 right-1 p-1.5 rounded bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-medium overflow-hidden cursor-pointer z-10 hover:shadow-md transition-shadow"
                    >
                      <div className="font-bold">{event.title}</div>
                      <div>{format(start, 'HH:mm')} - {format(end, 'HH:mm')}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = events.filter(e => isSameDay(new Date(e.startDate), currentDate));

    return (
      <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="w-20 bg-slate-50 border-r border-slate-200">
          {hours.map(hour => (
            <div key={hour} className="h-20 border-b border-slate-100 text-[10px] text-slate-400 p-2 text-right">
              {hour}:00
            </div>
          ))}
        </div>
        <div className="flex-1 relative overflow-y-auto max-h-[600px]">
          {hours.map(hour => (
            <div key={hour} className="h-20 border-b border-slate-100" onClick={() => {
              const d = new Date(currentDate);
              d.setHours(hour);
              openAddModal(d);
            }}></div>
          ))}
          {dayEvents.map(event => {
            const start = new Date(event.startDate);
            const end = new Date(event.endDate);
            const top = (start.getHours() * 80) + (start.getMinutes() * 80 / 60);
            const height = Math.max(40, ((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 80);
            
            return (
              <div 
                key={event.id}
                onClick={() => openEditModal(event)}
                style={{ top: `${top}px`, height: `${height}px` }}
                className="absolute left-4 right-4 p-3 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-medium overflow-hidden cursor-pointer z-10 hover:shadow-md transition-shadow"
              >
                <div className="font-bold text-sm">{event.title}</div>
                <div className="flex items-center gap-2 mt-1 opacity-70">
                  <Clock className="w-3 h-3" />
                  {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                </div>
                {event.description && <p className="mt-2 line-clamp-2 opacity-80">{event.description}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const months = eachMonthOfInterval({
      start: startOfYear(currentDate),
      end: endOfYear(currentDate)
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {months.map(month => (
          <div key={month.toString()} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3 capitalize">{format(month, 'MMMM', { locale: language === 'fr' ? fr : undefined })}</h3>
            <div className="grid grid-cols-7 gap-1">
              {[
                t('common.days.mon').charAt(0),
                t('common.days.tue').charAt(0),
                t('common.days.wed').charAt(0),
                t('common.days.thu').charAt(0),
                t('common.days.fri').charAt(0),
                t('common.days.sat').charAt(0),
                t('common.days.sun').charAt(0)
              ].map((d, i) => (
                <div key={i} className="text-[8px] font-bold text-slate-400 text-center">{d}</div>
              ))}
              {eachDayOfInterval({
                start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
                end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
              }).map((day, i) => {
                const hasEvents = events.some(e => isSameDay(new Date(e.startDate), day));
                return (
                  <div 
                    key={i}
                    onClick={() => { setCurrentDate(day); setView('day'); }}
                    className={`aspect-square flex items-center justify-center text-[10px] rounded-full cursor-pointer transition-colors ${
                      !isSameMonth(day, month) ? 'text-slate-200' : 
                      isSameDay(day, new Date()) ? 'bg-indigo-600 text-white font-bold' :
                      hasEvents ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm self-start">
            <button onClick={handlePrev} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">{t('common.today')}</button>
            <button onClick={handleNext} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          </div>
          <h2 className="text-xl font-black text-slate-900 capitalize">
            {view === 'day' ? format(currentDate, 'd MMMM yyyy', { locale: language === 'fr' ? fr : undefined }) :
             view === 'week' ? t('agenda.weekOf', { date: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMMM', { locale: language === 'fr' ? fr : undefined }) }) :
             view === 'month' ? format(currentDate, 'MMMM yyyy', { locale: language === 'fr' ? fr : undefined }) :
             format(currentDate, 'yyyy')}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setView('day')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${view === 'day' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <CalendarIcon className="w-4 h-4" /> {t('common.day')}
          </button>
          <button 
            onClick={() => setView('week')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${view === 'week' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <CalendarRange className="w-4 h-4" /> {t('common.week')}
          </button>
          <button 
            onClick={() => setView('month')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${view === 'month' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <CalendarMonthIcon className="w-4 h-4" /> {t('common.month')}
          </button>
          <button 
            onClick={() => setView('year')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${view === 'year' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutGrid className="w-4 h-4" /> {t('common.year')}
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
          <button 
            onClick={() => openAddModal()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-md active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> {t('agenda.newEvent')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto scrollbar-hide">
        <div className="min-w-[800px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {view === 'month' && renderMonthView()}
              {view === 'week' && renderWeekView()}
              {view === 'day' && renderDayView()}
              {view === 'year' && renderYearView()}
            </>
          )}
        </div>
      </div>

      {/* Event Modal */}
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
                  <CalendarIcon className="w-5 h-5 text-indigo-600" />
                  {selectedEvent ? t('agenda.editEvent') : t('agenda.modal.title')}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('common.title')}</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t('agenda.titlePlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('common.start')}</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('common.end')}</label>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('common.category')}</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="Réunion">{t('agenda.categories.meeting')}</option>
                    <option value="Client">{t('agenda.categories.client')}</option>
                    <option value="Interne">{t('agenda.categories.internal')}</option>
                    <option value="Privé">{t('agenda.categories.private')}</option>
                    <option value="Autre">{t('agenda.categories.other')}</option>
                  </select>
                </div>

                {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('agenda.assignTo')}</label>
                    <select
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    >
                      <option value="">{t('agenda.myself')}</option>
                      {users.filter(u => u.id !== currentUser.id).map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('common.description')}</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('agenda.descriptionPlaceholder')}
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    checked={formData.isPrivate}
                    onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                  />
                  <label htmlFor="isPrivate" className="text-sm font-medium text-slate-700 cursor-pointer">
                    {t('agenda.privateEventHint')}
                  </label>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  {selectedEvent ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedEvent.id)}
                      className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      {t('common.delete')}
                    </button>
                  ) : <div />}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      {selectedEvent ? t('common.update') : t('common.create')}
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
