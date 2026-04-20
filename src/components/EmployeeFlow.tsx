import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, increment, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, CheckCircle2, ChevronRight, ChevronLeft, Send, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const QUESTIONS = [
  { id: 'relationships', text: 'Como foi seu relacionamento com colegas hoje?' },
  { id: 'respect', text: 'Você se sentiu respeitado(a) hoje?' },
  { id: 'collaboration', text: 'Como foi a colaboração da equipe hoje?' },
  { id: 'communication', text: 'A comunicação hoje foi:' },
  { id: 'expression', text: 'Você se sentiu à vontade para se expressar?' },
  { id: 'environment', text: 'O ambiente hoje foi tranquilo?' },
  { id: 'interpersonalRespect', text: 'Houve respeito entre as pessoas hoje?' },
  { id: 'generalClimate', text: 'Como você avalia o clima geral de hoje?' },
  { id: 'belonging', text: 'Você se sentiu parte da equipe hoje?' },
];

const SCALE = [
  { value: 4, label: 'Muito bom', emoji: '😄', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' },
  { value: 3, label: 'Bom', emoji: '🙂', color: 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' },
  { value: 2, label: 'Regular', emoji: '😐', color: 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100' },
  { value: 1, label: 'Ruim', emoji: '🙁', color: 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100' },
];

export default function EmployeeFlow() {
  const { profile, logout } = useAuth();
  const [step, setStep] = useState(0); // 0: Welcome, 1..9: Questions, 10: Finished
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [checkInTime, setCheckInTime] = useState('08:00');
  const [submitting, setSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [dailyFeedbackCount, setDailyFeedbackCount] = useState(0);

  React.useEffect(() => {
    if (!profile) return;
    const today = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, 'daily_stats', today);
    const unsubscribe = onSnapshot(statsRef, (docSnap) => {
      if (docSnap.exists()) {
        setDailyFeedbackCount(docSnap.data().count || 0);
      } else {
        setDailyFeedbackCount(0);
      }
    }, (error) => {
      console.error("Stats Listener Error:", error);
    });
    return () => unsubscribe();
  }, [profile]);

  const totalQuestions = QUESTIONS.length;
  const currentStepProgress = ((step) / totalQuestions) * 100;

  const handleResponse = (questionId: string, value: number) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    setTimeout(() => {
      setStep(prev => prev + 1);
    }, 300);
  };

  const handleFinish = async () => {
    if (!profile) return;
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const batch = writeBatch(db);
      
      // 1. Create Feedback
      const feedbackRef = doc(collection(db, 'feedbacks'));
      batch.set(feedbackRef, {
        employeeId: profile.uid,
        employeeName: profile.name,
        matricula: profile.matricula,
        date: today,
        checkInTime: checkInTime,
        checkOutAt: serverTimestamp(),
        responses,
        comment
      });

      // 2. Increment Daily Counter
      const statsRef = doc(db, 'daily_stats', today);
      batch.set(statsRef, { count: increment(1) }, { merge: true });

      await batch.commit();
      setIsFinished(true);
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar feedback. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isFinished) {
    return (
      <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white rounded-2xl p-10 text-center shadow-xl border border-[#e2e8f0]"
        >
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
            <CheckCircle2 className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[#0f172a] mb-2">Check-out Realizado!</h1>
          <p className="text-[#64748b] mb-8">Seu dia de trabalho foi registrado. Obrigado pelo feedback.</p>
          <button 
            onClick={logout}
            className="w-full bg-[#1e293b] hover:bg-[#0f172a] text-white font-bold py-4 rounded-lg transition-all shadow-md"
          >
            Encerrar Sessão
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f4f7fa] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[280px] bg-white border-r border-[#e2e8f0] p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-6 h-6 bg-[#2563eb] rounded-[6px]"></div>
            <span className="font-extrabold text-lg text-[#2563eb] tracking-tighter">ExperCorp</span>
          </div>

          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-md">
                {profile?.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-[14px] text-[#1e293b] leading-tight">{profile?.name}</div>
                <div className="text-[11px] text-[#64748b] mt-0.5">Matrícula: {profile?.matricula}</div>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fee2e2] text-[#ef4444] text-[10px] font-bold w-full justify-center">
              <div className="w-1.5 h-1.5 bg-[#ef4444] rounded-full animate-pulse"></div>
              Check-out Bloqueado
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#64748b]">Resumo do Dia</div>
            <div className="flex items-center justify-between text-[13px] text-[#475569]">
              <span>Check-in:</span>
              <input 
                type="time" 
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="bg-transparent border-none p-0 font-semibold text-[#1e293b] outline-none text-right cursor-pointer focus:text-[#2563eb]"
              />
            </div>
            <div className="flex justify-between text-[13px] text-[#475569]">
              <span>Status:</span>
              <span className="font-semibold text-amber-500">Aguardando Saída</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-[#eff6ff] rounded-xl border border-[#dbeafe]">
            <div className="flex justify-between text-[11px] font-bold text-[#2563eb] mb-2 uppercase tracking-wide">
              <span>Participação Hoje</span>
              <span>{dailyFeedbackCount} coletados</span>
            </div>
            <div className="h-1.5 bg-[#dbeafe] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#2563eb] rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((dailyFeedbackCount / 20) * 100, 100)}%` }} // Arbitrary goal of 20 for visual effect
              ></div>
            </div>
            <p className="text-[10px] text-[#64748b] mt-2 font-medium">Sua resposta é essencial!</p>
          </div>

          <div className="pt-4 border-t border-[#e2e8f0]">
            <button className="w-full py-3.5 rounded-lg font-bold text-[13px] flex items-center justify-center gap-2 bg-[#cbd5e1] text-[#64748b] cursor-not-allowed">
              Registrar Saída 🔒
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 flex flex-col overflow-y-auto">
        <header className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
            <div className="hidden sm:block w-16 h-16 rounded-xl overflow-hidden border border-[#e2e8f0] shadow-sm flex-shrink-0 bg-white">
              <img 
                src="https://picsum.photos/seed/office-harmony/120/120" 
                alt="Relações Sociais"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0f172a]">Avaliação de Clima Diário</h1>
              <p className="text-[#64748b] text-[14px] mt-1">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>
          {step > 0 && step <= totalQuestions && (
            <div className="text-[#2563eb] font-bold text-[13px] uppercase tracking-wider">
              Passo {step} de {totalQuestions}
            </div>
          )}
          <button onClick={logout} className="md:hidden p-2 text-[#64748b]"><LogOut size={20}/></button>
        </header>

        <section className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-8 md:p-12 flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto"
              >
                <motion.div 
                  className="relative mb-8"
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 2, -2, 0]
                  }}
                  transition={{ 
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
                    <img 
                      src="https://api.dicebear.com/7.x/notionists/svg?seed=Xavier" 
                      alt="Personagem Masculino"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <motion.div 
                    className="absolute -right-2 -bottom-2 bg-white rounded-full p-2 shadow-lg border border-blue-50"
                    animate={{ rotate: [0, 20, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <span className="text-xl">👋</span>
                  </motion.div>
                </motion.div>
                <h2 className="text-3xl font-bold text-[#0f172a] mb-4">Olá, {profile?.name.split(' ')[0]}!</h2>
                <p className="text-[#475569] mb-10 leading-relaxed">
                  Para registrar sua saída, responda rapidamente como foi seu dia de trabalho.
                </p>
                <motion.button 
                  onClick={() => setStep(1)}
                  className="relative w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold py-4 rounded-lg shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 uppercase text-sm tracking-widest overflow-hidden group"
                  animate={{ 
                    scale: [1, 1.02, 1],
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-200%', '200%'] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear", repeatDelay: 2 }}
                  />
                  <span className="relative z-10 flex items-center gap-3">
                    Iniciar Avaliação
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </motion.button>
              </motion.div>
            ) : step <= totalQuestions ? (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <div className="h-1.5 bg-[#e2e8f0] rounded-full mb-10 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${currentStepProgress}%` }}
                    className="h-full bg-[#2563eb] rounded-full"
                  />
                </div>

                <div className="text-[11px] font-bold uppercase tracking-[2px] text-[#64748b] mb-3">
                  Pergunta {step}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-[#0f172a] mb-10 leading-snug">
                  {QUESTIONS[step - 1].text}
                </h2>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {SCALE.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => handleResponse(QUESTIONS[step - 1].id, item.value)}
                      className={cn(
                        "flex flex-col items-center gap-3 p-8 border-2 rounded-xl transition-all h-full group",
                        responses[QUESTIONS[step - 1].id] === item.value 
                          ? "border-[#2563eb] bg-[#eff6ff] ring-4 ring-blue-500/5"
                          : "bg-white border-[#f1f5f9] hover:border-[#2563eb] hover:bg-[#f8fafc]"
                      )}
                    >
                      <span className="text-4xl mb-2">{item.emoji}</span>
                      <span className="font-bold text-[13px] text-[#475569]">{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-auto pt-10 flex justify-between">
                  <button 
                    onClick={() => setStep(prev => prev - 1)}
                    className="px-6 py-2.5 border border-[#e2e8f0] rounded-lg text-[#475569] font-bold text-[14px] hover:bg-[#f8fafc]"
                  >
                    Anterior
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="final"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <div className="text-[11px] font-bold uppercase tracking-[2px] text-[#64748b] mb-10">
                  Resumo Final
                </div>
                
                <div className="mb-10">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[#64748b] mb-3">Comentário Adicional (Opcional)</div>
                  <textarea
                    className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-5 outline-none focus:border-[#2563eb] transition-all resize-none text-[15px] h-[120px]"
                    placeholder="Algo que gostaria de compartilhar sobre o dia de hoje?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>

                <div className="mt-auto flex flex-col md:flex-row justify-between items-center gap-4 pt-10 border-t border-[#f1f5f9]">
                  <button 
                    onClick={() => setStep(totalQuestions)}
                    className="text-[#64748b] font-bold text-[14px] hover:underline"
                  >
                    Revisar respostas
                  </button>
                  <button 
                    onClick={handleFinish}
                    disabled={submitting}
                    className="w-full md:w-auto px-10 py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-lg shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-3 uppercase text-sm tracking-widest disabled:opacity-50"
                  >
                    {submitting ? 'Enviando...' : 'Finalizar e Sair'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        
        <p className="text-center text-[11px] text-[#94a3b8] mt-8 max-w-lg mx-auto leading-relaxed">
          Suas respostas são tratadas com sigilo e utilizadas exclusivamente para a melhoria Contínua da cultura organizacional ExperCorp.
        </p>
      </main>
    </div>
  );
}
