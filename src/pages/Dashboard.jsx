import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Flame, Trophy, Users, CheckCircle, TrendingUp, Calendar, Dumbbell } from 'lucide-react';

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
  const [athletesDetails, setAthletesDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user?.role) return;
      setLoading(true);

      if (user.role === 'admin') {
        const { count: athletes } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'athlete');
        const { count: coaches } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'coach');
        setStats({ athletes: athletes || 0, coaches: coaches || 0 });
      } else if (user.role === 'coach' || user.role === 'treinador') {
        const { count: athletes } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('coach_id', user.id);
        const { count: workouts } = await supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('coach_id', user.id);
        setStats({ athletes: athletes || 0, workouts: workouts || 0 });

        // Buscar detalhes individuais de cada aluno
        const { data: athletesData } = await supabase.from('profiles').select('id, name, created_at').eq('coach_id', user.id);
        if (athletesData) {
           const enhancedAthletes = await Promise.all(athletesData.map(async (ath) => {
              const { count: sessionsCount } = await supabase.from('workout_sessions').select('*', { count: 'exact', head: true }).eq('athlete_id', ath.id);
              const { count: assignmentsCount } = await supabase.from('workout_assignments').select('*', { count: 'exact', head: true }).eq('athlete_id', ath.id);
              const { data: lastSession } = await supabase.from('workout_sessions').select('completed_at').eq('athlete_id', ath.id).order('completed_at', { ascending: false }).limit(1);

              return {
                  ...ath,
                  sessions_completed: sessionsCount || 0,
                  active_assignments: assignmentsCount || 0,
                  last_active: lastSession && lastSession[0] ? new Date(lastSession[0].completed_at).toLocaleDateString() : 'Sem atividade'
              }
           }));
           setAthletesDetails(enhancedAthletes);
        }

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
      setLoading(false);
    }
    
    fetchDashboardData();
  }, [user]);

  const StatCard = ({ title, value, icon: Icon }) => (
    <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6 flex items-center justify-between shadow-lg">
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
    <div className="space-y-8 animate-fade-in pb-12">
      <header className="mb-8 border-b border-kinetic-gray/30 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-kinetic-white uppercase tracking-wide">
            {user?.role === 'coach' || user?.role === 'treinador' ? 'Dashboard - Workout' : 'Dashboard'}
          </h1>
          <p className="text-kinetic-neon mt-2 font-medium">Bem-vindo(a), {user?.name || user?.email?.split('@')[0]}</p>
        </div>
        <div className="bg-kinetic-dark px-4 py-2 rounded-lg border border-kinetic-gray text-kinetic-white/50 text-sm uppercase font-bold tracking-widest">
          {user?.role || 'Visitante'}
        </div>
      </header>

      {loading ? (
        <div className="p-8 text-center text-kinetic-neon font-display animate-pulse uppercase tracking-widest">Carregando métricas da base de dados...</div>
      ) : (
        <>
          {/* Role based rendering para Atletas */}
          {(user?.role === 'atleta' || user?.role === 'athlete' || !user?.role) && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Treinos Realizados" value={stats.sessions} icon={CheckCircle} />
                <StatCard title="Streak de Dias" value="0" icon={Flame} />
                <StatCard title="Volume Total (kg)" value="0k" icon={Trophy} />
              </div>

              <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6 mt-8">
                <h2 className="text-xl font-display font-bold text-kinetic-white mb-6 uppercase">Volume de Treino Semanal</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mockDataChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                      <XAxis dataKey="name" stroke="#ffffff" opacity={0.5} />
                      <YAxis stroke="#ffffff" opacity={0.5} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111111', border: '1px solid #333333', borderRadius: '8px' }}
                        itemStyle={{ color: '#CCFF00', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="volume" stroke="#CCFF00" strokeWidth={3} dot={{ fill: '#000000', strokeWidth: 2, r: 5 }} activeDot={{ r: 8, fill: '#CCFF00' }} />
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
                   <StatCard title="Atletas Vinculados" value={stats.athletes} icon={Users} />
                   <StatCard title="Total de Treinos Criados" value={stats.workouts} icon={Dumbbell} />
                 </>
              )}
            </div>
          )}
          
          {/* Visão de Performance Individual dos Alunos para o Coach */}
          {(user?.role === 'treinador' || user?.role === 'coach') && athletesDetails.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-display font-bold text-kinetic-white mb-6 uppercase border-b border-kinetic-gray pb-2 flex items-center">
                <TrendingUp className="w-5 h-5 text-kinetic-neon mr-3" /> 
                Radar Individual de Alunos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {athletesDetails.map(ath => (
                  <div key={ath.id} className="bg-kinetic-dark rounded-xl p-5 border border-kinetic-gray/50 hover:border-kinetic-neon/50 transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-kinetic-neon/5 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-kinetic-neon/10 transition-colors"></div>
                    
                    <div className="flex items-center gap-4 mb-5 relative z-10">
                      <div className="w-12 h-12 rounded-xl bg-kinetic-neon/20 flex items-center justify-center text-kinetic-neon font-display font-bold text-xl uppercase border border-kinetic-neon/20">
                        {ath.name?.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-kinetic-white leading-tight">{ath.name}</h3>
                        <p className="text-xs text-kinetic-white/40 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" /> Membro desde {new Date(ath.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                      <div className="bg-kinetic-black rounded-lg p-3 border border-kinetic-gray/50">
                        <p className="text-[10px] text-kinetic-white/50 uppercase tracking-wider font-bold mb-1">Fichas Ativas</p>
                        <p className="text-xl font-bold text-kinetic-white">{ath.active_assignments}</p>
                      </div>
                      <div className="bg-kinetic-black rounded-lg p-3 border border-kinetic-gray/50">
                        <p className="text-[10px] text-kinetic-white/50 uppercase tracking-wider font-bold mb-1">Sessões Concluídas</p>
                        <p className="text-xl font-bold text-kinetic-neon">{ath.sessions_completed}</p>
                      </div>
                    </div>

                    <div className="border-t border-kinetic-gray/50 pt-3 flex justify-between items-center relative z-10">
                      <span className="text-xs text-kinetic-white/50 uppercase font-bold tracking-wider">Última Atividade:</span>
                      <span className={`text-xs font-bold ${ath.last_active === 'Sem atividade' ? 'text-kinetic-white/30' : 'text-kinetic-neon'}`}>{ath.last_active}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feed de Atividades Globais para Treinador/Admin */}
          {(user?.role === 'treinador' || user?.role === 'admin' || user?.role === 'coach') && (
            <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6 mt-8 shadow-xl">
              <h2 className="text-xl font-display font-bold text-kinetic-white mb-6 uppercase flex items-center">
                <Activity className="w-5 h-5 text-kinetic-neon mr-3" />
                Feed Recente de Sistema
              </h2>
              
              {recentActivities.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-kinetic-dark rounded-full flex items-center justify-center mx-auto mb-4">
                    <Activity className="w-8 h-8 text-kinetic-white/20" />
                  </div>
                  <p className="text-kinetic-white/50 text-sm">Nenhuma atividade registrada ainda nesta equipe.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivities.map((session, i) => (
                    <div key={i} className="flex items-start md:items-center gap-4 py-4 border-b border-kinetic-gray/50 last:border-0 hover:bg-kinetic-dark/30 transition-colors rounded-lg px-2">
                      <div className="w-10 h-10 rounded-full bg-kinetic-neon/20 border border-kinetic-neon/30 flex items-center justify-center text-kinetic-neon uppercase font-bold text-sm shrink-0">
                        {session.profiles?.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1">
                        <p className="text-kinetic-white text-sm">
                          <span className="font-bold text-kinetic-neon uppercase tracking-wide">{session.profiles?.name || 'Atleta'}</span> finalizou o treino <span className="text-kinetic-white/80">"{session.workouts?.title || 'Treino'}"</span>.
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs text-kinetic-white/50 font-mono bg-kinetic-dark px-2 py-1 rounded">
                          {new Date(session.completed_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
