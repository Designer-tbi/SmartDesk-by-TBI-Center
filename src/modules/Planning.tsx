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
  User,
  Trash2,
  FileText,
  Download
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addDays, startOfYear, endOfYear, eachMonthOfInterval, addWeeks, subWeeks, addYears, subYears, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export const Planning = ({ user }: { user?: any }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('week');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      if (diffHours > 24 && !selectedSchedule) {
        // Create a separate schedule for each day
        const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) });
        const isNightShift = end.getHours() < start.getHours() || (end.getHours() === start.getHours() && end.getMinutes() < start.getMinutes());
        const effectiveDays = isNightShift ? days.slice(0, -1) : days;

        const promises = effectiveDays.map(day => {
          const dayStart = new Date(day);
          dayStart.setHours(start.getHours(), start.getMinutes());
          
          const dayEnd = new Date(day);
          dayEnd.setHours(end.getHours(), end.getMinutes());
          if (isNightShift) {
            dayEnd.setDate(dayEnd.getDate() + 1);
          }
          
          return apiFetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formData,
              startDate: format(dayStart, "yyyy-MM-dd'T'HH:mm"),
              endDate: format(dayEnd, "yyyy-MM-dd'T'HH:mm")
            })
          });
        });
        
        await Promise.all(promises);
      } else {
        const method = selectedSchedule ? 'PUT' : 'POST';
        const url = selectedSchedule ? `/api/schedules/${selectedSchedule.id}` : '/api/schedules';
        
        await apiFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      setIsModalOpen(false);
      setSelectedSchedule(null);
      fetchSchedules();
    } catch (err) {
      console.error('Failed to save schedule:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) return;
    try {
      const res = await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIsModalOpen(false);
        setSelectedSchedule(null);
        setShowDeleteConfirm(false);
        fetchSchedules();
      }
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  const openAddModal = (date?: Date, userId?: string) => {
    if (!canManage) return;
    setShowDeleteConfirm(false);
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
    setShowDeleteConfirm(false);
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

  const calculateTotalHours = (userId: string, start: Date, end: Date) => {
    const s = startOfDay(start);
    const e = endOfDay(end);
    const periodSchedules = schedules.filter(sch => {
      const schStart = new Date(sch.startDate);
      return sch.userId === userId && schStart >= s && schStart <= e;
    });
    
    const totalMinutes = periodSchedules.reduce((acc, sch) => {
      return acc + differenceInMinutes(new Date(sch.endDate), new Date(sch.startDate));
    }, 0);

    return (totalMinutes / 60).toFixed(2);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const title = `Rapport d'heures - ${format(currentDate, 'MMMM yyyy', { locale: fr })}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

    const tableData = users.map(user => {
      const dayTotal = calculateTotalHours(user.id, currentDate, currentDate);
      const weekTotal = calculateTotalHours(user.id, startOfWeek(currentDate, { weekStartsOn: 1 }), endOfWeek(currentDate, { weekStartsOn: 1 }));
      const monthTotal = calculateTotalHours(user.id, startOfMonth(currentDate), endOfMonth(currentDate));

      return [
        user.name,
        user.role,
        `${dayTotal}h`,
        `${weekTotal}h`,
        `${monthTotal}h`
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Employé', 'Rôle', 'Aujourd\'hui', 'Cette Semaine', 'Ce Mois']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`rapport-heures-${format(currentDate, 'yyyy-MM')}.pdf`);
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
                const daySchedules = schedules.filter(s => {
                  if (s.userId !== user.id) return false;
                  const start = startOfDay(new Date(s.startDate));
                  const end = endOfDay(new Date(s.endDate));
                  return day >= start && day <= end;
                });
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

  const renderDayView = () => {
    const displayUsers = canManage ? users : users.filter(u => u.id === currentUser?.id);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-[100px_1fr] border-b border-slate-200 bg-slate-50">
          <div className="p-4 border-r border-slate-200 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">Heure</div>
          <div className="p-4 font-bold text-slate-700 text-sm text-center">
            {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
          </div>
        </div>
        <div className="relative overflow-y-auto max-h-[600px]">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-[100px_1fr] border-b border-slate-100 last:border-b-0 min-h-[60px]">
              <div className="p-2 border-r border-slate-100 text-[10px] font-bold text-slate-400 text-center">
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div className="relative p-1">
                {schedules
                  .filter(s => {
                    const start = new Date(s.startDate);
                    const end = new Date(s.endDate);
                    const isStartDay = isSameDay(start, currentDate);
                    const isBetween = currentDate >= startOfDay(start) && currentDate <= endOfDay(end);
                    
                    if (!isBetween) return false;
                    
                    // If it's the start day, show it at the start hour
                    if (isStartDay) {
                      return start.getHours() === hour;
                    }
                    
                    // If it's a subsequent day, show it at 00:00 (or the start of the day)
                    return hour === 0;
                  })
                  .map(sch => (
                    <div 
                      key={sch.id}
                      onClick={() => openEditModal(sch)}
                      className={`p-2 mb-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-all hover:shadow-md ${
                        sch.type === 'Congé' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        sch.type === 'Maladie' ? 'bg-red-50 border-red-200 text-red-700' :
                        'bg-indigo-50 border-indigo-200 text-indigo-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        <span>{sch.userName}</span>
                        <span className="ml-auto opacity-60">{format(new Date(sch.startDate), 'HH:mm')} - {format(new Date(sch.endDate), 'HH:mm')}</span>
                      </div>
                      <div className="mt-1 font-black text-xs">{sch.title}</div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
            <div key={day} className="p-3 text-center font-bold text-slate-500 text-xs uppercase tracking-wider border-r border-slate-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const daySchedules = schedules.filter(s => {
              const start = startOfDay(new Date(s.startDate));
              const end = endOfDay(new Date(s.endDate));
              return day >= start && day <= end;
            });
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={day.toString()} 
                className={`min-h-[120px] p-2 border-r border-b border-slate-100 last:border-r-0 hover:bg-slate-50/50 transition-colors cursor-pointer group ${
                  !isCurrentMonth ? 'bg-slate-50/30' : ''
                }`}
                onClick={() => canManage && openAddModal(day)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-black ${
                    isToday ? 'w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center' : 
                    isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {daySchedules.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {daySchedules.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {daySchedules.slice(0, 3).map(sch => (
                    <div 
                      key={sch.id}
                      onClick={(e) => { e.stopPropagation(); openEditModal(sch); }}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold truncate border ${
                        sch.type === 'Congé' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                        sch.type === 'Maladie' ? 'bg-red-50 border-red-100 text-red-700' :
                        'bg-indigo-50 border-indigo-100 text-indigo-700'
                      }`}
                    >
                      {sch.userName.split(' ')[0]}: {sch.title}
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <div className="text-[9px] font-bold text-slate-400 text-center">
                      + {daySchedules.length - 3} de plus
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={handlePrev} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">Aujourd'hui</button>
            <button onClick={handleNext} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setView('day')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${view === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Jour
            </button>
            <button 
              onClick={() => setView('week')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${view === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Semaine
            </button>
            <button 
              onClick={() => setView('month')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${view === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Mois
            </button>
          </div>

          <h2 className="text-xl font-black text-slate-900 capitalize">
            {view === 'month' ? format(currentDate, 'MMMM yyyy', { locale: fr }) :
             view === 'week' ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMMM', { locale: fr })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMMM yyyy', { locale: fr })}` :
             format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={generatePDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
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

      {/* Statistics Summary Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { 
            label: 'Aujourd\'hui', 
            hours: calculateTotalHours(currentUser?.id || '', currentDate, currentDate),
            icon: Clock,
            color: 'indigo'
          },
          { 
            label: 'Cette Semaine', 
            hours: calculateTotalHours(currentUser?.id || '', startOfWeek(currentDate, { weekStartsOn: 1 }), endOfWeek(currentDate, { weekStartsOn: 1 })),
            icon: CalendarRange,
            color: 'emerald'
          },
          { 
            label: 'Ce Mois', 
            hours: calculateTotalHours(currentUser?.id || '', startOfMonth(currentDate), endOfMonth(currentDate)),
            icon: CalendarDays,
            color: 'amber'
          }
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-${stat.color}-50 flex items-center justify-center text-${stat.color}-600`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-xl font-black text-slate-900">{stat.hours}h <span className="text-xs font-bold text-slate-400">travaillées</span></p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {view === 'day' && renderDayView()}
            {view === 'week' && renderWeekView()}
            {view === 'month' && renderMonthView()}
          </>
        )}
      </div>

      {/* Schedule Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full md:w-[90vw] lg:max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header - Fixé */}
              <div className="px-6 sm:px-10 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 rounded-2xl">
                    <CalendarIcon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900">
                      {selectedSchedule ? 'Modifier le planning' : 'Nouveau planning'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {selectedSchedule ? 'Mise à jour des horaires' : 'Planification d\'une session'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                {/* Zone de contenu scrollable */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-12 custom-scrollbar">
                  {/* Section 1: Qui et Quoi */}
                  <section className="space-y-8">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">Attribution & Activité</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Définir l'employé et sa mission</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Employé</label>
                        <div className="relative group">
                          <select
                            required
                            className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none cursor-pointer"
                            value={formData.userId || ''}
                            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                          >
                            <option value="">Sélectionner un membre</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Statut de publication</label>
                        <div className="flex bg-slate-100 p-1 rounded-2xl">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, status: 'draft' })}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                              formData.status === 'draft' ? 'bg-white text-slate-600 shadow-sm' : 'text-slate-400 hover:text-slate-500'
                            }`}
                          >
                            Brouillon
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, status: 'published' })}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                              formData.status === 'published' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:text-slate-500'
                            }`}
                          >
                            Publié
                          </button>
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-4">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Type de session</label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                          {[
                            { id: 'Travail', label: 'Travail', icon: '💼', color: 'indigo' },
                            { id: 'Congé', label: 'Congé', icon: '🏖️', color: 'amber' },
                            { id: 'Maladie', label: 'Maladie', icon: '🤒', color: 'red' },
                            { id: 'Formation', label: 'Formation', icon: '🎓', color: 'emerald' },
                            { id: 'Autre', label: 'Autre', icon: '✨', color: 'slate' }
                          ].map((type) => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, type: type.id })}
                              className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all gap-2 ${
                                formData.type === type.id 
                                  ? `bg-${type.color}-50 border-${type.color}-500 shadow-sm scale-[1.02]` 
                                  : 'bg-white border-slate-100 hover:border-slate-200'
                              }`}
                            >
                              <span className="text-2xl">{type.icon}</span>
                              <span className={`text-[10px] font-black uppercase tracking-tighter ${
                                formData.type === type.id ? `text-${type.color}-700` : 'text-slate-500'
                              }`}>
                                {type.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Intitulé du poste / Mission</label>
                        <div className="relative group">
                          <input
                            type="text"
                            required
                            className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                            value={formData.title || ''}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Ex: Responsable Accueil, Inventaire..."
                          />
                          <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Section 2: Temporalité */}
                  <section className="space-y-8">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">Horaires & Durée</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Définir la plage de présence</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Début de service</label>
                        <input
                          type="datetime-local"
                          required
                          className="w-full bg-transparent text-lg font-black text-slate-900 focus:outline-none cursor-pointer"
                          value={formData.startDate || ''}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        />
                      </div>
                      <div className="p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Fin de service</label>
                        <input
                          type="datetime-local"
                          required
                          className="w-full bg-transparent text-lg font-black text-slate-900 focus:outline-none cursor-pointer"
                          value={formData.endDate || ''}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {formData.startDate && formData.endDate && (
                        <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50 rounded-2xl w-fit border border-emerald-100">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">
                            Durée totale : {(() => {
                              const start = new Date(formData.startDate);
                              const end = new Date(formData.endDate);
                              const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                              
                              let diff = end.getTime() - start.getTime();
                              let daysCount = 1;
                              
                              if (diffHours > 24 && !selectedSchedule) {
                                const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) });
                                const isNightShift = end.getHours() < start.getHours() || (end.getHours() === start.getHours() && end.getMinutes() < start.getMinutes());
                                daysCount = isNightShift ? days.length - 1 : days.length;
                                
                                const dailyStart = new Date(start);
                                const dailyEnd = new Date(start);
                                dailyEnd.setHours(end.getHours(), end.getMinutes(), 0, 0);
                                if (isNightShift) {
                                  dailyEnd.setDate(dailyEnd.getDate() + 1);
                                }
                                
                                diff = (dailyEnd.getTime() - dailyStart.getTime()) * daysCount;
                              }
                              
                              if (diff <= 0) return 'Invalide';
                              const hours = Math.floor(diff / (1000 * 60 * 60));
                              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                              return `${hours}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''} ${daysCount > 1 ? `(${daysCount} jours)` : ''}`;
                            })()}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Matin (8h-12h)', start: '08:00', end: '12:00' },
                          { label: 'Après-midi (14h-18h)', start: '14:00', end: '18:00' },
                          { label: 'Journée (9h-17h)', start: '09:00', end: '17:00' }
                        ].map((slot) => (
                          <button
                            key={slot.label}
                            type="button"
                            onClick={() => {
                              const date = formData.startDate.split('T')[0];
                              setFormData({
                                ...formData,
                                startDate: `${date}T${slot.start}`,
                                endDate: `${date}T${slot.end}`
                              });
                            }}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all uppercase tracking-wider"
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Section 3: Notes */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">Notes & Instructions</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Informations additionnelles</p>
                      </div>
                    </div>
                    <textarea
                      rows={4}
                      className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-500/5 transition-all resize-none"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Ex: Prévoir les clés du dépôt, briefing équipe à 9h15..."
                    />
                  </section>
                </div>

                {/* Footer Fixé */}
                <div className="px-6 sm:px-10 py-8 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                  {selectedSchedule ? (
                    showDeleteConfirm ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleDelete(selectedSchedule.id)}
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
                        className="group flex items-center gap-2 px-6 py-4 text-sm font-bold text-red-500 hover:bg-red-50 rounded-2xl transition-all w-full sm:w-auto justify-center"
                      >
                        <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Supprimer
                      </button>
                    )
                  ) : <div className="hidden sm:block" />}
                  
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-8 py-4 text-sm font-bold text-slate-500 hover:bg-slate-200/50 rounded-2xl transition-all w-full sm:w-auto"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-3 px-12 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 w-full sm:w-auto justify-center"
                    >
                      <Check className="w-5 h-5" />
                      {selectedSchedule ? 'Mettre à jour' : 'Confirmer le planning'}
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
