import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserPlus } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function AdminDashboard() {
  const { user, signup } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  
  // New Coach Form State
  const [coachName, setCoachName] = useState('');
  const [coachUsername, setCoachUsername] = useState('');
  const [coachPassword, setCoachPassword] = useState('');
  const [creating, setCreating] = useState(false);

  if (user?.role !== 'admin') {
     return <Navigate to="/dashboard" replace />;
  }

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
       console.error(err);
    } finally {
       setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleCreateCoach = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMsg('');
    try {
       const res = await signup(coachUsername, coachPassword, coachName, 'coach', null);
       if (res.success) {
           setMsg('Treinador criado com sucesso!');
           setCoachName('');
           setCoachUsername('');
           setCoachPassword('');
           fetchProfiles();
       } else {
           setMsg(res.error || 'Erro ao criar treinador.');
       }
    } finally {
       setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-8 border-b border-kinetic-gray pb-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-kinetic-white uppercase tracking-wide flex items-center gap-3">
            <ShieldAlert className="text-kinetic-neon w-8 h-8" />
            Admin Dashboard
          </h1>
          <p className="text-kinetic-white/60 mt-1">Gerenciamento global e criação de treinadores.</p>
        </div>
      </header>

      {msg && (
        <div className="p-4 bg-kinetic-neon/10 border border-kinetic-neon text-kinetic-neon rounded-lg font-medium text-sm">
          {msg}
        </div>
      )}

      {/* Seção Criar Treinador */}
      <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6 mb-8">
        <h2 className="text-xl font-display font-bold text-kinetic-white mb-4 flex items-center gap-2">
           <UserPlus className="w-5 h-5 text-kinetic-neon" /> Novo Treinador
        </h2>
        <form onSubmit={handleCreateCoach} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
           <div>
             <label className="block text-sm text-kinetic-white mb-1">Nome Completo</label>
             <input required type="text" value={coachName} onChange={e => setCoachName(e.target.value)} className="w-full bg-kinetic-dark border border-kinetic-gray rounded px-3 py-2 text-kinetic-white focus:outline-none focus:border-kinetic-neon" />
           </div>
           <div>
             <label className="block text-sm text-kinetic-white mb-1">Usuário (Nick)</label>
             <input required type="text" value={coachUsername} onChange={e => setCoachUsername(e.target.value)} className="w-full bg-kinetic-dark border border-kinetic-gray rounded px-3 py-2 text-kinetic-white focus:outline-none focus:border-kinetic-neon" />
           </div>
           <div>
             <label className="block text-sm text-kinetic-white mb-1">Senha (Temporária)</label>
             <input required type="password" value={coachPassword} onChange={e => setCoachPassword(e.target.value)} className="w-full bg-kinetic-dark border border-kinetic-gray rounded px-3 py-2 text-kinetic-white focus:outline-none focus:border-kinetic-neon" />
           </div>
           <button disabled={creating} type="submit" className="bg-kinetic-neon text-kinetic-black font-bold h-[42px] rounded hover:bg-kinetic-white transition-colors disabled:opacity-50">
             {creating ? 'Criando...' : 'CRIAR CONTA'}
           </button>
        </form>
      </div>

      {loading ? (
        <div className="text-center text-kinetic-white">Carregando usuários...</div>
      ) : (
        <div className="bg-kinetic-black border border-kinetic-gray rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-kinetic-dark border-b border-kinetic-gray">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-kinetic-white/70 uppercase">Nome</th>
                  <th className="px-6 py-4 text-sm font-medium text-kinetic-white/70 uppercase">Usuário</th>
                  <th className="px-6 py-4 text-sm font-medium text-kinetic-white/70 uppercase">Role</th>
                  <th className="px-6 py-4 text-sm font-medium text-kinetic-white/70 uppercase">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kinetic-gray/50">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-kinetic-dark/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-kinetic-gray flex items-center justify-center text-kinetic-white font-bold uppercase">
                          {(p.name || p.email || 'U').charAt(0)}
                        </div>
                        <span className="font-bold text-kinetic-white">{p.name || 'Sem Nome'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-kinetic-white/70 text-sm">{p.username || p.email.split('@')[0]}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                        p.role === 'admin' 
                          ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                          : p.role === 'coach'
                            ? 'bg-kinetic-neon/10 text-kinetic-neon border-kinetic-neon/20'
                            : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                        {p.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-kinetic-white/50 text-sm">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
