import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Flame, Trophy, Users, CheckCircle } from 'lucide-react';

const mockDataChart = [
  { name: 'Seg', volume: 0 },
  { name: 'Ter', volume: 0 },
  { name: 'Qua', volume: 0 },
  { name: 'Qui', volume: 0 },
  { name: 'Sex', volume: 0 },
  { name: 'Sab', volume: 0 },
  { name: 'Dom', volume: 0 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ athletes: 0, coaches: 0, workouts: 0, sessions: 0 });
  const [recentActivities, setRecentActivities] = useState([]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user?.role) return;

      if (user.role === 'admin') {
        const { count: athletes } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'athlete');
        const { count: coaches } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'coach');
        setStats({ athletes: athletes || 0, coaches: coaches || 0 });
      } else if (user.role === 'coach' || user.role === 'treinador') {
        const { count: athletes } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('coach_id', user.id);
        const { count: workouts } = await supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('coach_id', user.id);
        setStats({ athletes: athletes || 0, workouts: workouts || 0 });
      } else {
        // Atleta stats
        const { count: sessions } = await supabase.from('workout_sessions').select('*', { count: 'exact', head: true }).eq('athlete_id', user.id);
        setStats({ sessions: sessions || 0 });
      }

      // Buscar atividades recentes se for admin ou coach (simplificado)
      if (user.role === 'admin' || user.role === 'coach' || user.role === 'treinador') {
         const { data: sessionsData } = await supabase
           .from('workout_sessions')
           .select('*, profiles(name), workouts(title)')
           .order('completed_at', { ascending: false })
           .limit(5);
           
         if (sessionsData) {
           setRecentActivities(sessionsData);
         }
      }
    }
    
    fetchDashboardData();
  }, [user]);

  const StatCard = ({ title, value, icon: Icon }) => (
    <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6 flex items-center justify-between">
      <div>
        <p className="text-kinetic-white/60 text-sm font-medium mb-1">{title}</p>
        <p className="text-3xl font-display font-bold text-kinetic-white">{value}</p>
      </div>
      <div className="w-12 h-12 bg-kinetic-dark rounded-full flex items-center justify-center text-kinetic-neon">
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-bold text-kinetic-white uppercase tracking-wide">
          Dashboard
        </h1>
        <p className="text-kinetic-neon mt-2">Bem-vindo(a), {user?.name || user?.email?.split('@')[0]} ({user?.role || 'Sem Cargo'})</p>
      </header>

      {/* Role based rendering para Atletas */}
      {(user?.role === 'atleta' || user?.role === 'athlete' || !user?.role) && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Treinos Realizados" value={stats.sessions} icon={CheckCircle} />
            <StatCard title="Streak de Dias" value="0" icon={Flame} />
            <StatCard title="Volume Total (kg)" value="0k" icon={Trophy} />
          </div>

          <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6 mt-8">
            <h2 className="text-xl font-display font-bold text-kinetic-white mb-6">Volume de Treino Semanal</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockDataChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                  <XAxis dataKey="name" stroke="#ffffff" opacity={0.5} />
                  <YAxis stroke="#ffffff" opacity={0.5} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid #333333' }}
                    itemStyle={{ color: '#CCFF00' }}
                  />
                  <Line type="monotone" dataKey="volume" stroke="#CCFF00" strokeWidth={3} dot={{ fill: '#000000', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Role based rendering para Admin e Coach */}
      {(user?.role === 'treinador' || user?.role === 'admin' || user?.role === 'coach') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {user?.role === 'admin' ? (
             <>
               <StatCard title="Total de Treinadores" value={stats.coaches} icon={Users} />
               <StatCard title="Total de Atletas" value={stats.athletes} icon={Activity} />
             </>
          ) : (
             <>
               <StatCard title="Meus Alunos" value={stats.athletes} icon={Users} />
               <StatCard title="Treinos Criados" value={stats.workouts} icon={Activity} />
             </>
          )}
        </div>
      )}
      
      {/* Feed de Atividades para Treinador/Admin */}
      {(user?.role === 'treinador' || user?.role === 'admin' || user?.role === 'coach') && (
        <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6 mt-8">
          <h2 className="text-xl font-display font-bold text-kinetic-white mb-4">Últimas Sessões Realizadas no Sistema</h2>
          
          {recentActivities.length === 0 ? (
            <p className="text-kinetic-white/50 text-sm">Nenhuma atividade registrada ainda.</p>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((session, i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-kinetic-gray/50 last:border-0">
                  <div className="w-10 h-10 rounded-full bg-kinetic-dark flex items-center justify-center text-kinetic-neon uppercase font-bold text-sm">
                    {session.profiles?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-kinetic-white text-sm"><span className="font-bold text-kinetic-neon">{session.profiles?.name || 'Atleta'}</span> finalizou o treino "{session.workouts?.title || 'Treino'}".</p>
                    <p className="text-kinetic-white/50 text-xs mt-1">Sessão ID: {session.id.substring(0,8)}</p>
                  </div>
                  <span className="ml-auto text-xs text-kinetic-white/30">
                    {new Date(session.completed_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
