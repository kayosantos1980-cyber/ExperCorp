import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, writeBatch, doc, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  Download, Users, TrendingUp, AlertCircle, Calendar, 
  Search, Filter, LogOut, ChevronRight, FileSpreadsheet, Trash2, Info, Trophy, Medal
} from 'lucide-react';
import { format, isLastDayOfMonth, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Feedback {
  id: string;
  employeeName: string;
  matricula: string;
  date: string;
  checkOutAt: any;
  responses: Record<string, number>;
  comment?: string;
}

const QUESTION_MAP: Record<string, string> = {
  relationships: 'Relacionamento',
  respect: 'Respeito',
  collaboration: 'Colaboração',
  communication: 'Comunicação',
  expression: 'Expressão',
  environment: 'Ambiente',
  interpersonalRespect: 'Respeito Geral',
  generalClimate: 'Clima Geral',
  belonging: 'Pertencimento'
};

export default function ManagerDashboard() {
  const { logout, loading } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loadingState, setLoadingState] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'history' | 'ranking'>('overview');
  const [showWarning, setShowWarning] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    const checkPurgeAndWarning = async () => {
      const now = new Date();
      const currentMonthYear = format(now, 'MM-yyyy');
      
      // 1. Check if we need to show warning (Last day of month)
      if (isLastDayOfMonth(now)) {
        setShowWarning(true);
      }

      // 2. Check if we need to auto-purge (New month detected)
      const systemStateRef = doc(db, 'system_state', 'auto_purge');
      const systemStateSnap = await getDoc(systemStateRef);
      const lastPurgeMonth = systemStateSnap.exists() ? systemStateSnap.data().lastPurgeMonth : null;

      if (lastPurgeMonth && lastPurgeMonth !== currentMonthYear) {
        console.log("Novo mês detectado. Iniciando limpeza automática...");
        await performAutoPurge(currentMonthYear);
      } else if (!lastPurgeMonth) {
        await setDoc(systemStateRef, { lastPurgeMonth: currentMonthYear });
      }
    };

    if (!loading) {
      checkPurgeAndWarning();
    }
  }, [loading]);

  const performAutoPurge = async (newMonthYear: string) => {
    setIsPurging(true);
    try {
      const now = new Date();
      const feedbacksRef = collection(db, 'feedbacks');
      const snapshot = await getDocs(feedbacksRef);
      
      const batch = writeBatch(db);
      let count = 0;
      
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const dateStr = data.date; 
        if (dateStr) {
          const feedbackDate = new Date(dateStr);
          if (!isSameMonth(feedbackDate, now)) {
            batch.delete(docSnap.ref);
            count++;
          }
        }
      });

      if (count > 0) {
        await batch.commit();
      }
      
      await setDoc(doc(db, 'system_state', 'auto_purge'), { lastPurgeMonth: newMonthYear });
    } catch (error) {
      console.error("Erro na limpeza automática:", error);
    } finally {
      setIsPurging(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      const q = query(collection(db, 'feedbacks'), orderBy('checkOutAt', 'desc'), limit(100));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Feedback[];
        setFeedbacks(data);
        setLoadingState(false);
      }, (error) => {
        console.error("Dashboard Listener Error:", error);
      });
      return () => unsubscribe();
    }
  }, [loading]);

  const getRankingData = () => {
    const employeeMap: Record<string, { name: string, scores: number[] }> = {};
    
    feedbacks.forEach(f => {
      if (!employeeMap[f.matricula]) {
        employeeMap[f.matricula] = { name: f.employeeName, scores: [] };
      }
      const responses = Object.values(f.responses) as number[];
      const avg = responses.reduce((a, b) => a + b, 0) / responses.length;
      employeeMap[f.matricula].scores.push(avg);
    });

    return Object.entries(employeeMap)
      .map(([matricula, data]) => ({
        matricula,
        name: data.name,
        average: data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      }))
      .sort((a, b) => b.average - a.average);
  };
  const calculateAverage = (key: string, data = feedbacks): string => {
    if (data.length === 0) return '0';
    const sum = data.reduce((acc, curr) => acc + (curr.responses[key] || 0), 0);
    return (sum / data.length).toFixed(1);
  };

  const getChartData = () => {
    return Object.keys(QUESTION_MAP).map(key => ({
      name: QUESTION_MAP[key],
      average: parseFloat(calculateAverage(key))
    }));
  };

  const getTrendData = () => {
    // Group by date
    const groups: Record<string, number[]> = {};
    feedbacks.forEach(f => {
      if (!groups[f.date]) groups[f.date] = [];
      const responses = Object.values(f.responses) as number[];
      const avg = responses.reduce((a, b) => a + b, 0) / responses.length;
      groups[f.date].push(avg);
    });

    return Object.keys(groups).sort().map(date => ({
      date: format(new Date(date), 'dd/MM', { locale: ptBR }),
      score: parseFloat((groups[date].reduce((a, b) => a + b, 0) / groups[date].length).toFixed(2))
    }));
  };

  const exportToExcel = () => {
    const exportData = feedbacks.map(f => ({
      Data: f.date,
      Matricula: f.matricula,
      Colaborador: f.employeeName,
      ...Object.keys(f.responses).reduce((acc, key) => ({ ...acc, [QUESTION_MAP[key]]: f.responses[key] }), {}),
      Comentario: f.comment || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clima Diário");
    XLSX.writeFile(wb, `Feedback_Clima_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const criticalIssues = feedbacks.filter(f => (Object.values(f.responses) as number[]).some(val => val <= 1)).length;

  if (loadingState) return <div className="p-10 text-center font-bold">Carregando dados do dashboard...</div>;

  const filteredFeedbacks = feedbacks.filter(f => 
    f.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.matricula.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-[#f4f7fa] flex font-sans">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[280px] flex-col bg-white border-r border-[#e2e8f0]">
        <div className="p-8 border-b border-[#f1f5f9] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-[#2563eb] rounded-[6px]"></div>
            <span className="font-extrabold text-lg text-[#2563eb] tracking-tighter">ExperCorp</span>
          </div>
          <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-[2px] mt-2">DASHBOARD GESTOR</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm transition-all",
              activeTab === 'overview' ? "bg-[#eff6ff] text-[#2563eb]" : "text-[#64748b] hover:bg-[#f8fafc]"
            )}
          >
            <TrendingUp size={18} />
            Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab('team')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm transition-all",
              activeTab === 'team' ? "bg-[#eff6ff] text-[#2563eb]" : "text-[#64748b] hover:bg-[#f8fafc]"
            )}
          >
            <Users size={18} />
            Equipe
          </button>
          <button 
            onClick={() => setActiveTab('ranking')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm transition-all",
              activeTab === 'ranking' ? "bg-[#eff6ff] text-[#2563eb]" : "text-[#64748b] hover:bg-[#f8fafc]"
            )}
          >
            <Trophy size={18} />
            Ranking do Mês
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm transition-all",
              activeTab === 'history' ? "bg-[#eff6ff] text-[#2563eb]" : "text-[#64748b] hover:bg-[#f8fafc]"
            )}
          >
            <Calendar size={18} />
            Histórico
          </button>
        </nav>

        <div className="p-6 border-t border-[#f1f5f9]">
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[#ef4444] bg-[#fee2e2] hover:bg-[#fecaca] rounded-lg font-bold text-sm transition-all"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0f172a]">Análise de Clima</h1>
            <p className="text-[#64748b] text-[14px]">Gestão baseada em dados reais da sua equipe.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e2e8f0] text-[#475569] rounded-lg font-bold hover:bg-[#f8fafc] shadow-sm transition-all text-xs uppercase tracking-wider"
            >
              <FileSpreadsheet size={16} className="text-emerald-600" />
              Exportar XLS
            </button>
          </div>
        </header>

        {/* Warning Banner */}
        <AnimatePresence>
          {showWarning && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8"
            >
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="text-amber-900 font-bold text-sm uppercase tracking-wider">Aviso de Limpeza Mensal</h4>
                  <p className="text-amber-800 text-[13px] mt-0.5 leading-relaxed">
                    Hoje é o último dia do mês. Para manter a privacidade e o desempenho, 
                    <strong> todos os feedbacks do mês atual serão arquivados/removidos automaticamente à meia-noite</strong>. 
                    Recomendamos exportar o relatório XLS agora se desejar manter uma cópia permanente.
                  </p>
                </div>
                <button 
                  onClick={() => setShowWarning(false)}
                  className="px-4 py-2 text-amber-600 font-bold text-[11px] uppercase tracking-widest hover:bg-amber-100 rounded-lg transition-all"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Purging Overlay */}
        <AnimatePresence>
          {isPurging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-md flex items-center justify-center"
            >
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <h3 className="text-xl font-bold text-slate-900">Configurando Novo Mês...</h3>
                <p className="text-slate-500 mt-2 font-medium">Limpando registros antigos para manter sua privacidade.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e2e8f0]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-[#eff6ff] text-[#2563eb] rounded-lg flex items-center justify-center">
                      <Users size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">Ativo</span>
                  </div>
                  <h3 className="text-[#64748b] text-xs font-bold uppercase tracking-wider mb-1">Total de Respostas</h3>
                  <p className="text-3xl font-bold text-[#0f172a]">{feedbacks.length}</p>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e2e8f0]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                      <TrendingUp size={20} />
                    </div>
                  </div>
                  <h3 className="text-[#64748b] text-xs font-bold uppercase tracking-wider mb-1">Pulso da Equipe</h3>
                  <p className="text-3xl font-bold text-[#0f172a]">{calculateAverage('generalClimate')}/4.0</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e2e8f0]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-rose-50 text-[#ef4444] rounded-lg flex items-center justify-center">
                      <AlertCircle size={20} />
                    </div>
                    {criticalIssues > 0 && <div className="w-2 h-2 bg-[#ef4444] rounded-full animate-ping"></div>}
                  </div>
                  <h3 className="text-[#64748b] text-xs font-bold uppercase tracking-wider mb-1">Pontos Críticos</h3>
                  <p className="text-3xl font-bold text-[#0f172a]">{criticalIssues}</p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#e2e8f0]">
                  <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-widest mb-8">Performance por Categoria</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getChartData()} layout="vertical" margin={{ left: 40 }}>
                        <XAxis type="number" domain={[0, 4]} hide />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} fontSize={10} width={100} tick={{ fill: '#64748b', fontWeight: 600 }} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }} 
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        />
                        <Bar dataKey="average" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#e2e8f0]">
                  <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-widest mb-8">Evolução do Índice de Clima</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getTrendData()}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={11} tickMargin={10} tick={{ fill: '#64748b' }} />
                        <YAxis domain={[0, 4]} axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        />
                        <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'team' && (
            <motion.div
              key="team"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] overflow-hidden"
            >
              <div className="p-8 border-b border-[#f1f5f9]">
                <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-widest">Colaboradores Monitorados</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#f8fafc] text-[#64748b] text-[10px] font-bold uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4 text-left">Nome</th>
                      <th className="px-8 py-4 text-center">Clima Médio</th>
                      <th className="px-8 py-4 text-center">Último Feedback</th>
                      <th className="px-8 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {Array.from(new Set(feedbacks.map(f => f.matricula))).map(mat => {
                      const employeeFeedbacks = feedbacks.filter(f => f.matricula === mat);
                      const latest = employeeFeedbacks[0];
                      const avg = parseFloat(calculateAverage('generalClimate', employeeFeedbacks));
                      
                      return (
                        <tr key={mat} className="hover:bg-[#fcfdfe] transition-all">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                                {latest.employeeName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-[#1e293b] text-sm">{latest.employeeName}</p>
                                <p className="text-[11px] text-[#94a3b8]">Matrícula: {mat}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-center">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[11px] font-bold",
                              avg >= 3 ? "bg-emerald-50 text-emerald-600" : avg >= 2 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                            )}>
                              {avg.toFixed(1)} / 4.0
                            </span>
                          </td>
                          <td className="px-8 py-5 text-center text-xs font-bold text-[#475569]">
                            {latest.date}
                          </td>
                          <td className="px-8 py-5 text-center">
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase rounded tracking-wider">
                              <div className="w-1 h-1 bg-emerald-600 rounded-full"></div>
                              Participante
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'ranking' && (
            <motion.div
              key="ranking"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shadow-inner">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0f172a]">Ranking de Experiência</h3>
                    <p className="text-[#64748b] text-sm">Top colaboradores com as melhores médias de clima no mês.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {getRankingData().map((item, index) => (
                    <motion.div 
                      key={item.matricula}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 bg-[#f8fafc] rounded-xl border border-[#f1f5f9] hover:border-blue-200 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                          index === 0 ? "bg-amber-100 text-amber-600 border-2 border-amber-200" :
                          index === 1 ? "bg-slate-100 text-slate-600 border-2 border-slate-200" :
                          index === 2 ? "bg-orange-100 text-orange-600 border-2 border-orange-200" :
                          "bg-white text-slate-400 border border-slate-100"
                        )}>
                          {index === 0 ? <Medal size={20} /> : index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-[#1e293b]">{item.name}</p>
                          <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-bold">Matrícula {item.matricula}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-[#2563eb] leading-tight">
                          {item.average.toFixed(1)}
                        </div>
                        <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Média Geral</div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {getRankingData().length === 0 && (
                    <div className="text-center py-20 bg-[#f8fafc] rounded-2xl border-2 border-dashed border-[#e2e8f0]">
                      <Users size={48} className="mx-auto text-[#cbd5e1] mb-4" />
                      <p className="text-[#64748b] font-bold">Nenhum feedback registrado ainda para este mês.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] overflow-hidden"
            >
              <div className="p-8 border-b border-[#f1f5f9] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-widest">Histórico Completo de Feedbacks</h3>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                  <input 
                    type="text" 
                    placeholder="PROCURAR NO HISTÓRICO..."
                    className="pl-9 pr-4 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-[11px] font-bold tracking-wider outline-none focus:border-[#2563eb] w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <table className="w-full">
                <thead className="bg-[#f8fafc] text-[#64748b] text-[10px] font-bold uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-4 text-left">Colaborador</th>
                    <th className="px-8 py-4 text-center">Clima</th>
                    <th className="px-8 py-4 text-left">Registro</th>
                    <th className="px-8 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filteredFeedbacks.map((f) => {
                    const responses = Object.values(f.responses) as number[];
                    const score = responses.reduce((a, b) => a + b, 0) / responses.length;
                    return (
                      <tr key={f.id} className="hover:bg-[#fcfdfe] transition-all">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#f1f5f9] text-[#64748b] rounded-lg flex items-center justify-center font-bold text-xs">
                              {f.employeeName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-[#1e293b] text-sm">{f.employeeName}</p>
                              <p className="text-[11px] text-[#94a3b8]">Matrícula: {f.matricula}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="flex items-center gap-1">
                              {[1,2,3,4].map(v => (
                                <div key={v} className={cn(
                                  "w-3 h-1.5 rounded-sm",
                                  v <= score ? (score >= 3 ? "bg-emerald-500" : score >= 2 ? "bg-amber-500" : "bg-rose-500") : "bg-[#e2e8f0]"
                                )} />
                              ))}
                            </div>
                            <span className="text-[10px] font-extrabold text-[#64748b]">{score.toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-xs font-bold text-[#475569]">{f.date}</p>
                          <p className="text-[10px] text-[#94a3b8] uppercase">Checkout às {f.checkOutAt?.seconds ? new Date(f.checkOutAt.seconds * 1000).toLocaleTimeString() : '--:--'}</p>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button 
                            onClick={() => setSelectedFeedback(f)}
                            className="text-[#cbd5e1] hover:text-[#2563eb] transition-colors"
                          >
                            <ChevronRight size={18}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0f172a]/40 backdrop-blur-sm"
              onClick={() => setSelectedFeedback(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-[#f1f5f9] flex items-center justify-between bg-[#f8fafc]">
                 <div>
                   <h2 className="text-xl font-bold text-[#0f172a]">{selectedFeedback.employeeName}</h2>
                   <p className="text-[11px] text-[#64748b] font-bold uppercase tracking-widest mt-1">
                     Feedback de {selectedFeedback.date} • Matrícula {selectedFeedback.matricula}
                   </p>
                   {(selectedFeedback as any).checkInTime && (
                     <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">
                       Check-in: {(selectedFeedback as any).checkInTime}
                     </p>
                   )}
                 </div>
                 <button 
                   onClick={() => setSelectedFeedback(null)}
                   className="p-2 hover:bg-[#e2e8f0] rounded-lg text-[#64748b] transition-all"
                 >
                   <LogOut size={20} className="rotate-180" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(selectedFeedback.responses).map(([key, value]) => (
                    <div key={key} className="p-4 rounded-xl border border-[#f1f5f9] bg-[#fcfdfe]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">
                        {QUESTION_MAP[key] || key}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <span className="text-xl">
                             {value === 4 ? '😄' : value === 3 ? '🙂' : value === 2 ? '😐' : '🙁'}
                           </span>
                           <span className={cn(
                             "text-[13px] font-bold",
                             (value as number) >= 3 ? "text-emerald-600" : (value as number) >= 2 ? "text-amber-600" : "text-rose-600"
                           )}>
                             {['respect', 'expression', 'environment', 'interpersonalRespect', 'belonging'].includes(key) 
                               ? (value === 4 ? 'Sim' : value === 3 ? 'Talvez' : value === 2 ? 'Não muito' : 'Nem um pouco')
                               : (value === 4 ? 'Muito bom' : value === 3 ? 'Bom' : value === 2 ? 'Regular' : 'Ruim')}
                           </span>
                        </div>
                        <span className="text-xs font-extrabold text-[#cbd5e1]">Nota {value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedFeedback.comment && (
                  <div className="mt-6">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#64748b] mb-3">Comentários do Colaborador</div>
                    <div className="p-5 bg-blue-50 border border-blue-100 rounded-xl text-[#1e293b] text-[14px] leading-relaxed italic">
                      "{selectedFeedback.comment}"
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-[#f1f5f9] bg-[#f8fafc] text-center">
                <button 
                  onClick={() => setSelectedFeedback(null)}
                  className="px-8 py-3 bg-[#1e293b] text-white rounded-lg font-bold text-sm uppercase tracking-widest hover:bg-[#0f172a] transition-all"
                >
                  Fechar Detalhes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
