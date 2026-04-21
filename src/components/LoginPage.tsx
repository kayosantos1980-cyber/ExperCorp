import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LoginPage() {
  const [matricula, setMatricula] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<'none' | 'restricted' | 'other'>('none');
  const { login, loginWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricula) return;
    setLoading(true);
    setErrorStatus('none');
    try {
      await login(matricula);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/admin-restricted-operation') {
        setErrorStatus('restricted');
      } else {
        setErrorStatus('other');
        alert('Erro ao entrar. Tente novamente mais tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManagerLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-[#e2e8f0] p-8 md:p-12"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#2563eb] rounded-lg"></div>
            <span className="font-extrabold text-2xl tracking-tighter text-[#2563eb]">ExperCorp</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0f172a] uppercase tracking-tight">ACESSO AO EXPERCORP</h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[#64748b] mt-1 text-sm font-bold"
          >
            Digite sua matrícula para começar
          </motion.p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <AnimatePresence>
            {errorStatus === 'restricted' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4"
              >
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-800 font-bold text-sm">Ação Necessária no Firebase</p>
                    <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                      O login por matrícula exige que a <b>Autenticação Anônima</b> esteja ativa no console.
                    </p>
                    <ol className="text-amber-700 text-[10px] mt-2 list-decimal list-inside space-y-1">
                      <li>Vá ao Console do Firebase</li>
                      <li>Authentication {'>'} Sign-in method</li>
                      <li>Ative "Anônimo" (Anonymous)</li>
                    </ol>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-[#64748b] mb-2 focus-within:text-[#2563eb] transition-colors">
              Matrícula do Colaborador
            </label>
            <div className="relative group">
              <UserCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8] group-focus-within:text-[#2563eb] transition-colors" />
              <input
                type="text"
                required
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl focus:ring-4 focus:ring-[#2563eb]/5 focus:border-[#2563eb] outline-none transition-all placeholder:text-[#94a3b8] font-medium"
                placeholder="Ex: 4429"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-[2px]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} />
                Entrar no Sistema
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-[#f1f5f9] flex flex-col items-center gap-4">
          <button 
            onClick={handleManagerLogin}
            className="text-[10px] text-[#2563eb] hover:text-[#1d4ed8] uppercase tracking-[2px] font-bold transition-colors flex items-center gap-2"
          >
            Área do Gestor (Google Login)
          </button>
          <p className="text-[10px] text-[#94a3b8] uppercase tracking-widest font-medium">
            Propriedade de ExperCorp HR Systems
          </p>
        </div>
      </motion.div>
    </div>
  );
}
