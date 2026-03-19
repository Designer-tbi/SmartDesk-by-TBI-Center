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
  LayoutGrid,
  FileText,
  Trash2
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addDays, startOfYear, endOfYear, eachMonthOfInterval, addWeeks, subWeeks, addYears, subYears, startOfDay, endOfDay } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from '../lib/i18n';

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

export const Agenda = ({ user }: { user?: any }) => {
  const { t, language } = useTranslation();
  const locale = language === 'fr' ? fr : enUS;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      if (diffHours > 24 && !selectedEvent) {
        const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) });
        const isNightShift = end.getHours() < start.getHours() || (end.getHours() === start.getHours() && end.getMinutes() < start.getMinutes());
        const daysCount = isNightShift ? days.length - 1 : days.length;

        const promises = [];
        for (let i = 0; i < daysCount; i++) {
          const currentDay = days[i];
          const dailyStart = new Date(currentDay);
          dailyStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
          
          const dailyEnd = new Date(currentDay);
          dailyEnd.setHours(end.getHours(), end.getMinutes(), 0, 0);
          if (isNightShift) {
            dailyEnd.setDate(dailyEnd.getDate() + 1);
          }

          promises.push(
            apiFetch('/api/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...formData,
                startDate: dailyStart.toISOString(),
                endDate: dailyEnd.toISOString()
              })
            })
          );
        }

        await Promise.all(promises);
      } else {
        const method = selectedEvent ? 'PUT' : 'POST';
        const url = selectedEvent ? `/api/events/${selectedEvent.id}` : '/api/events';
        
        await apiFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      setIsModalOpen(false);
      setSelectedEvent(null);
      fetchEvents();
    } catch (err) {
      console.error('Failed to save event:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIsModalOpen(false);
        setSelectedEvent(null);
        setShowDeleteConfirm(false);
        fetchEvents();
      }
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const openAddModal = (date?: Date) => {
    setShowDeleteConfirm(false);
    const start = date ? format(date, "yyyy-MM-dd'T'09:00") : format(new Date(), "yyyy-MM-dd'T'HH:mm");
    const end = date ? format(date, "yyyy-MM-dd'T'10:00") : format(addDays(new Date(), 0), "yyyy-MM-dd'T'HH:mm");
    
    setFormData({
      title: '',
      description: '',
      startDate: start,
      endDate: end,
      category: t('agenda.category.meeting'),
      isPrivate: false,
      assignedTo: ''
    });
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const openEditModal = (event: Event) => {
    setSelectedEvent(event);
    setShowDeleteConfirm(false);
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
        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
          <div key={day} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-b border-slate-200 bg-slate-50">
            {t(`agenda.day.${day}`)}
          </div>
        ))}
        {calendarDays.map((day, i) => {
          const dayEvents = events.filter(e => {
            const start = startOfDay(new Date(e.startDate));
            const end = endOfDay(new Date(e.endDate));
            return day >= start && day <= end;
          });
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
                    + {dayEvents.length - 3} de plus
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
              <div className="text-[10px] font-bold text-slate-400 uppercase">{format(day, 'EEE', { locale })}</div>
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
                {events.filter(e => {
                  const start = startOfDay(new Date(e.startDate));
                  const end = endOfDay(new Date(e.endDate));
                  return day >= start && day <= end;
                }).map(event => {
                  const start = new Date(event.startDate);
                  const end = new Date(event.endDate);
                  
                  const isStartDay = isSameDay(start, day);
                  const isEndDay = isSameDay(end, day);
                  
                  const startHour = isStartDay ? start.getHours() + (start.getMinutes() / 60) : 0;
                  const endHour = isEndDay ? end.getHours() + (end.getMinutes() / 60) : 24;
                  
                  const top = startHour * 80;
                  const height = Math.max(20, (endHour - startHour) * 80);
                  
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
    const dayEvents = events.filter(e => {
      const start = startOfDay(new Date(e.startDate));
      const end = endOfDay(new Date(e.endDate));
      return currentDate >= start && currentDate <= end;
    });

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
            
            const isStartDay = isSameDay(start, currentDate);
            const isEndDay = isSameDay(end, currentDate);
            
            const startHour = isStartDay ? start.getHours() + (start.getMinutes() / 60) : 0;
            const endHour = isEndDay ? end.getHours() + (end.getMinutes() / 60) : 24;
            
            const top = startHour * 80;
            const height = Math.max(40, (endHour - startHour) * 80);
            
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
            <h3 className="text-sm font-bold text-slate-900 mb-3 capitalize">{format(month, 'MMMM', { locale })}</h3>
            <div className="grid grid-cols-7 gap-1">
              {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d, i) => (
                <div key={i} className="text-[8px] font-bold text-slate-400 text-center">{t(`agenda.day.${d}`).charAt(0)}</div>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={handlePrev} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">{t('agenda.today')}</button>
            <button onClick={handleNext} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          </div>
          <h2 className="text-xl font-black text-slate-900 capitalize">
            {view === 'day' ? format(currentDate, 'd MMMM yyyy', { locale }) :
             view === 'week' ? t('agenda.weekOf').replace('{{date}}', format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMMM', { locale })) :
             view === 'month' ? format(currentDate, 'MMMM yyyy', { locale }) :
             format(currentDate, 'yyyy')}
          </h2>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button 
            onClick={() => setView('day')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${view === 'day' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <CalendarIcon className="w-4 h-4" /> {t('agenda.view.day')}
          </button>
          <button 
            onClick={() => setView('week')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${view === 'week' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <CalendarRange className="w-4 h-4" /> {t('agenda.view.week')}
          </button>
          <button 
            onClick={() => setView('month')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${view === 'month' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <CalendarMonthIcon className="w-4 h-4" /> {t('agenda.view.month')}
          </button>
          <button 
            onClick={() => setView('year')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${view === 'year' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutGrid className="w-4 h-4" /> {t('agenda.view.year')}
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <button 
            onClick={() => openAddModal()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" /> {t('agenda.newEvent')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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

      {/* Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-indigo-100 rounded-[1.5rem] shadow-sm">
                    <CalendarIcon className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                      {selectedEvent ? t('agenda.modal.editTitle') : t('agenda.modal.newTitle')}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                      {selectedEvent ? t('agenda.modal.editSubtitle') : t('agenda.modal.newSubtitle')}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all text-slate-400 hover:text-slate-600 active:scale-95"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-10 space-y-10">
                  {/* Section: Informations Générales */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <LayoutGrid className="w-4 h-4 text-indigo-500" />
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('agenda.form.generalInfo')}</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('agenda.form.title')}</label>
                        <input
                          type="text"
                          required
                          className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder={t('agenda.form.titlePlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('agenda.form.category')}</label>
                        <div className="relative">
                          <select
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none cursor-pointer shadow-sm"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          >
                            <option value="Réunion">{t('agenda.category.meeting')}</option>
                            <option value="Client">{t('agenda.category.client')}</option>
                            <option value="Interne">{t('agenda.category.internal')}</option>
                            <option value="Privé">{t('agenda.category.private')}</option>
                            <option value="Autre">{t('agenda.category.other')}</option>
                          </select>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Temporalité */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('agenda.form.timing')}</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('agenda.form.start')}</label>
                        <div className="relative group">
                          <input
                            type="datetime-local"
                            required
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('agenda.form.end')}</label>
                        <div className="relative group">
                          <input
                            type="datetime-local"
                            required
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
                            value={formData.endDate}
                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Attribution & Confidentialité */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <Users className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('agenda.form.attribution')}</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('agenda.form.assignTo')}</label>
                          <div className="relative">
                            <select
                              className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none cursor-pointer shadow-sm"
                              value={formData.assignedTo}
                              onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                            >
                              <option value="">{t('agenda.form.myself')}</option>
                              {users.filter(u => u.id !== currentUser.id).map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                              ))}
                            </select>
                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-slate-100 transition-all group cursor-pointer shadow-sm" onClick={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}>
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            id="isPrivate"
                            className="peer w-6 h-6 text-indigo-600 rounded-lg border-2 border-slate-300 focus:ring-indigo-500 transition-all cursor-pointer"
                            checked={formData.isPrivate}
                            onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label htmlFor="isPrivate" className="text-sm font-bold text-slate-700 cursor-pointer select-none group-hover:text-indigo-600 transition-colors">
                            {t('agenda.form.private')}
                          </label>
                          <span className="text-[10px] font-medium text-slate-400">{t('agenda.form.privateHint')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Description */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('agenda.form.description')}</h4>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('agenda.form.notes')}</label>
                      <textarea
                        rows={5}
                        className="w-full px-8 py-6 bg-slate-50 border-2 border-transparent rounded-[2.5rem] text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all resize-none shadow-sm"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder={t('agenda.form.notesPlaceholder')}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-10 py-8 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0">
                  {selectedEvent ? (
                    showDeleteConfirm ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleDelete(selectedEvent.id)}
                          className="flex-1 sm:flex-none px-4 py-4 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl transition-all text-center"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 sm:flex-none px-4 py-4 text-sm font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-2xl transition-all text-center"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="group flex items-center gap-2 px-8 py-4 text-sm font-bold text-red-500 hover:bg-red-50 rounded-2xl transition-all w-full sm:w-auto justify-center"
                      >
                        <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Supprimer l'événement
                      </button>
                    )
                  ) : <div className="hidden sm:block" />}
                  
                  <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-10 py-4 text-sm font-bold text-slate-500 hover:bg-slate-200/50 rounded-2xl transition-all w-full sm:w-auto"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-3 px-14 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 w-full sm:w-auto"
                    >
                      <Check className="w-5 h-5" />
                      {selectedEvent ? 'Mettre à jour' : 'Confirmer l\'événement'}
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
