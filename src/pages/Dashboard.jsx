import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Activity, Flame, Trophy, Users, CheckCircle, TrendingUp, Calendar,
  Dumbbell, Timer, Zap, Target, BarChart2,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────

function calcStreak(sessions) {
  if (!sessions?.length) return 0;
  const dateSet = [...new Set(sessions.map(s => new Date(s.completed_at).toISOString().slice(0, 10)))].sort().reverse();
  if (!dateSet.length) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateSet[0] !== today && dateSet[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < dateSet.length; i++) {
    const diff = Math.round((new Date(dateSet[i - 1]) - new Date(dateSet[i])) / 86400000);
    if (diff === 1) streak++; else break;
  }
  return streak;
}

// Constrói dados de gráfico a partir do PRIMEIRO dia com dados (sem padding vazio antes)
function buildChartData(sessions, maxDays = 90) {
  if (!sessions?.length) return [];
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const today = new Date(); today.setHours(23, 59, 59, 999);

  // Primeiro dia com dado (respeitando o limite de maxDays)
  const firstDate = sessions.reduce((min, s) => {
    const d = new Date(s.completed_at); return d < min ? d : min;
  }, new Date(sessions[0].completed_at));
  const limitStart = new Date(today.getTime() - maxDays * 86400000);
  const startDate = new Date(Math.max(firstDate.getTime(), limitStart.getTime()));
  startDate.setHours(0, 0, 0, 0);

  // Construir array do startDate até hoje
  const result = [];
  const cur = new Date(startDate);
  while (cur <= today) {
    const dateStr = cur.toISOString().slice(0, 10);
    result.push({
      name: result.length < 14 ? dayNames[cur.getDay()] : `${cur.getDate()}/${cur.getMonth() + 1}`,
      date: dateStr,
      volume: 0, sessions: 0, duration: 0, completion: 0,
    });
    cur.setDate(cur.getDate() + 1);
  }

  sessions.forEach(s => {
    const dayKey = new Date(s.completed_at).toISOString().slice(0, 10);
    const entry = result.find(r => r.date === dayKey);
    if (entry) {
      entry.volume = Math.round((entry.volume + (s.total_volume_kg || 0)) * 10) / 10;
      entry.sessions++;
      entry.duration += (s.duration_minutes || 0);
      if (s.completion_rate) entry.completion = Math.round(s.completion_rate);
    }
  });
  return result;
}

function getMusclePrimary(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('supino') || n.includes('crucifixo') || n.includes('peck') || n.includes('voador')) return 'Peito';
  if (n.includes('remada') || n.includes('pull') || n.includes('costas') || n.includes('serrátil')) return 'Costas';
  if (n.includes('agacha') || n.includes('leg') || n.includes('stiff') || n.includes('afundo') || n.includes('cadeira')) return 'Pernas';
  if (n.includes('ombro') || n.includes('desenvolvimento') || n.includes('elevação lateral')) return 'Ombros';
  if (n.includes('rosca') || n.includes('bíceps') || n.includes('curl') || n.includes('martelo')) return 'Bíceps';
  if (n.includes('tríceps') || n.includes('skull') || n.includes('francês') || n.includes('mergulho')) return 'Tríceps';
  if (n.includes('prancha') || n.includes('abdominal') || n.includes('crunch') || n.includes('alpinista') || n.includes('russian')) return 'Core';
  if (n.includes('glúteo') || n.includes('ponte') || n.includes('hip')) return 'Glúteos';
  return 'Outros';
}

const NEON = '#CCFF00';
const NEON_DIM = '#88AA00';

// ── Componente ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();

  // Coach / Admin state
  const [stats, setStats] = useState({ athletes: 0, workouts: 0, coaches: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [athletesDetails, setAthletesDetails] = useState([]);
  const [teamSessions, setTeamSessions] = useState([]);
  const [coachPeriod, setCoachPeriod] = useState(14);
  const [allTeamWeightRaw, setAllTeamWeightRaw] = useState([]);
  const [selectedAthleteForExChart, setSelectedAthleteForExChart] = useState('');

  // Athlete state
  const [allSessions, setAllSessions] = useState([]);
  const [athleteMetrics, setAthleteMetrics] = useState({ sessions: 0, totalVolume: 0, streak: 0, avgCompletion: 0, avgDuration: 0 });
  const [athletePeriod, setAthletePeriod] = useState(30);
  const [prs, setPrs] = useState([]);
  const [muscleData, setMuscleData] = useState([]);
  const [weightProgressData, setWeightProgressData] = useState([]);
  const [progressionExercises, setProgressionExercises] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.role) return;
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);

    if (user.role === 'admin') {
      const [{ count: athletes }, { count: coaches }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'athlete'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'coach'),
      ]);
      setStats({ athletes: athletes || 0, coaches: coaches || 0 });

    } else if (user.role === 'coach' || user.role === 'treinador') {
      // KPI coach
      const [{ count: athletes }, { count: workouts }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('coach_id', user.id),
        supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('coach_id', user.id),
      ]);
      setStats({ athletes: athletes || 0, workouts: workouts || 0 });

      // Detalhes por aluno
      const { data: athletesData } = await supabase.from('profiles').select('id, name, created_at').eq('coach_id', user.id);
      if (athletesData) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const enhanced = await Promise.all(athletesData.map(async ath => {
          const [
            { count: total },
            { count: assignments },
            { data: lastSession },
            { count: weekSessions },
          ] = await Promise.all([
            supabase.from('workout_sessions').select('*', { count: 'exact', head: true }).eq('athlete_id', ath.id),
            supabase.from('workout_assignments').select('*', { count: 'exact', head: true }).eq('athlete_id', ath.id),
            supabase.from('workout_sessions').select('completed_at, total_volume_kg').eq('athlete_id', ath.id).order('completed_at', { ascending: false }).limit(1),
            supabase.from('workout_sessions').select('*', { count: 'exact', head: true }).eq('athlete_id', ath.id).gte('completed_at', sevenDaysAgo),
          ]);
          const adherence = assignments > 0 ? Math.round(((weekSessions || 0) / assignments) * 100) : 0;
          return {
            ...ath,
            sessions_completed: total || 0,
            active_assignments: assignments || 0,
            week_sessions: weekSessions || 0,
            adherence: Math.min(adherence, 100),
            total_volume: lastSession?.[0]?.total_volume_kg || 0,
            last_active: lastSession?.[0] ? new Date(lastSession[0].completed_at).toLocaleDateString('pt-BR') : 'Sem atividade',
          };
        }));
        setAthletesDetails(enhanced);

        // Team sessions — last 30 dias (para gráficos diários), com stats para calcular volume real
        const athleteIds = athletesData.map(a => a.id);
        const { data: tSess } = await supabase
          .from('workout_sessions')
          .select('athlete_id, completed_at, total_volume_kg, duration_minutes, stats, workouts(exercises)')
          .in('athlete_id', athleteIds)
          .gte('completed_at', new Date(Date.now() - 30 * 86400000).toISOString())
          .order('completed_at', { ascending: true });

        if (tSess) {
          // Post-processar: calcular volume do stats quando total_volume_kg é 0/null
          const processed = tSess.map(s => {
            if (s.total_volume_kg && s.total_volume_kg > 0) return s;
            const exercises = s.workouts?.exercises || [];
            const stats = s.stats || {};
            let vol = 0;
            exercises.forEach((ex, exIdx) => {
              for (let sIdx = 0; sIdx < Number(ex.sets || 0); sIdx++) {
                if (stats[`${exIdx}-${sIdx}`]) {
                  const raw = stats[`${exIdx}-${sIdx}-data`] || {};
                  const kg = parseFloat(raw.weight) || 0;
                  const reps = parseInt(raw.reps_done) || parseInt(String(ex.reps || '').split('-')[0]) || 0;
                  vol += kg * reps;
                }
              }
            });
            return { ...s, total_volume_kg: Math.round(vol * 10) / 10 };
          });
          setTeamSessions(processed);

          // Extrair evolução de carga por exercício com athlete_id (para dropdown)
          const teamWeightData = [];
          tSess.forEach(s => {
            const exercises = s.workouts?.exercises || [];
            const stats = s.stats || {};
            const dateKey = new Date(s.completed_at).toISOString().slice(0, 10);
            exercises.forEach((ex, exIdx) => {
              for (let sIdx = 0; sIdx < Number(ex.sets || 0); sIdx++) {
                if (stats[`${exIdx}-${sIdx}`]) {
                  const raw = stats[`${exIdx}-${sIdx}-data`] || {};
                  const kg = parseFloat(raw.weight) || 0;
                  if (kg > 0) {
                    teamWeightData.push({
                      athlete_id: s.athlete_id,
                      exercise_name: ex.name || ex.customName || 'Exercício',
                      weight_kg: kg,
                      date: dateKey,
                    });
                  }
                }
              }
            });
          });
          setAllTeamWeightRaw(teamWeightData);
        }
      }

      // Feed
      const { data: feed } = await supabase
        .from('workout_sessions')
        .select('completed_at, total_volume_kg, duration_minutes, profiles(name), workouts(title)')
        .order('completed_at', { ascending: false })
        .limit(8);
      if (feed) setRecentActivities(feed);

    } else {
      // ATLETA — buscar tudo incluindo stats e exercícios do treino
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('completed_at, total_volume_kg, completion_rate, duration_minutes, stats, workout_id, workouts(exercises)')
        .eq('athlete_id', user.id)
        .order('completed_at', { ascending: true });

      // ── Extrair dados de peso do campo stats (fallback principal) ─────────
      const statsWeightData = []; // { exercise_name, weight_kg, reps_done, volume_kg, created_at }

      // Post-processar sessões: calcular volume/conclusão do stats se colunas novas estão a 0/null
      const processedSessions = (sessions || []).map(s => {
        const exercises = s.workouts?.exercises || [];
        const stats = s.stats || {};
        let vol = 0, done = 0, total = 0;

        exercises.forEach((ex, exIdx) => {
          const numSets = Number(ex.sets || 0);
          total += numSets;
          for (let sIdx = 0; sIdx < numSets; sIdx++) {
            if (stats[`${exIdx}-${sIdx}`]) {
              done++;
              const raw = stats[`${exIdx}-${sIdx}-data`] || {};
              const kg = parseFloat(raw.weight) || 0;
              const reps = parseInt(raw.reps_done) || parseInt(String(ex.reps || '').split('-')[0]) || 0;
              const sessionVol = kg * reps;
              vol += sessionVol;

              // Adicionar ao array de pesos para PRs e progressão
              if (kg > 0) {
                statsWeightData.push({
                  exercise_name: ex.name || ex.customName || 'Exercício',
                  weight_kg: kg,
                  reps_done: reps,
                  volume_kg: Math.round(sessionVol * 10) / 10,
                  is_completed: true,
                  created_at: s.completed_at,
                });
              }
            }
          }
        });

        return {
          ...s,
          // Usa coluna real se existir e for > 0, senão calcula do stats
          total_volume_kg: (s.total_volume_kg && s.total_volume_kg > 0)
            ? s.total_volume_kg
            : Math.round(vol * 10) / 10,
          completion_rate: (s.completion_rate && s.completion_rate > 0)
            ? s.completion_rate
            : (total > 0 ? Math.round((done / total) * 100) : 0),
        };
      });

      if (processedSessions.length) {
        setAllSessions(processedSessions);
        const totalVol = Math.round(processedSessions.reduce((s, r) => s + (r.total_volume_kg || 0), 0));
        const avgCompl = Math.round(processedSessions.reduce((s, r) => s + (r.completion_rate || 0), 0) / processedSessions.length);
        const avgDur = Math.round(processedSessions.reduce((s, r) => s + (r.duration_minutes || 0), 0) / processedSessions.length);
        setAthleteMetrics({ sessions: processedSessions.length, totalVolume: totalVol, streak: calcStreak(processedSessions), avgCompletion: avgCompl, avgDuration: avgDur });
      }

      // PRs e radar muscular — tenta session_sets primeiro, usa stats como fallback
      const { data: dbSets } = await supabase
        .from('session_sets')
        .select('exercise_name, weight_kg, reps_done, volume_kg, is_completed, created_at')
        .eq('athlete_id', user.id)
        .eq('is_completed', true);

      // Combinar: session_sets (mais preciso) + stats (dados históricos)
      const setsToUse = (dbSets && dbSets.length > 0)
        ? [...dbSets, ...statsWeightData.filter(sd => !dbSets.some(d => d.exercise_name === sd.exercise_name))]
        : statsWeightData;

      if (setsToUse.length > 0) {
        // PRs
        const prMap = {};
        setsToUse.forEach(s => {
          if (!s.weight_kg) return;
          if (!prMap[s.exercise_name] || s.weight_kg > prMap[s.exercise_name].weight) {
            prMap[s.exercise_name] = { exercise: s.exercise_name, weight: s.weight_kg, reps: s.reps_done };
          }
        });
        setPrs(Object.values(prMap).sort((a, b) => b.weight - a.weight).slice(0, 8));

        // Radar muscular
        const muscleMap = {};
        setsToUse.forEach(s => {
          const g = getMusclePrimary(s.exercise_name);
          muscleMap[g] = (muscleMap[g] || 0) + (s.volume_kg || 0);
        });
        const maxV = Math.max(...Object.values(muscleMap), 1);
        setMuscleData(Object.entries(muscleMap).map(([subject, vol]) => ({ subject, A: Math.round((vol / maxV) * 100) })));
      }

      // Progressão de carga por exercício — usando setsToUse (com data)
      const weightData = setsToUse.filter(s => s.weight_kg > 0 && s.created_at);
      if (weightData.length > 0) {
        const exCount = {};
        weightData.forEach(s => { exCount[s.exercise_name] = (exCount[s.exercise_name] || 0) + 1; });
        const topEx = Object.entries(exCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([ex]) => ex);

        const dates = [...new Set(weightData.map(s => new Date(s.created_at).toISOString().slice(0, 10)))].sort();
        const progData = dates.map(date => {
          const row = { date, name: `${new Date(date).getDate()}/${new Date(date).getMonth() + 1}` };
          topEx.forEach(ex => {
            const vals = weightData
              .filter(s => new Date(s.created_at).toISOString().slice(0, 10) === date && s.exercise_name === ex)
              .map(s => s.weight_kg);
            if (vals.length > 0) row[ex] = Math.max(...vals);
          });
          return row;
        });
        setProgressionExercises(topEx);
        setWeightProgressData(progData);
      }
    }


    setLoading(false);
  };

  // ── useMemo: Evolução de Carga por Exercício (coach — por aluno) ────────────
  const athleteExerciseChart = useMemo(() => {
    const raw = selectedAthleteForExChart
      ? allTeamWeightRaw.filter(d => d.athlete_id === selectedAthleteForExChart)
      : allTeamWeightRaw;
    if (raw.length === 0) return { progress: [], exercises: [] };
    const exCount = {};
    raw.forEach(s => { exCount[s.exercise_name] = (exCount[s.exercise_name] || 0) + 1; });
    const topEx = Object.entries(exCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ex]) => ex);
    const dates = [...new Set(raw.map(s => s.date))].sort();
    const progress = dates.map(date => {
      const d = new Date(date);
      const row = { date, name: `${d.getDate()}/${d.getMonth() + 1}` };
      topEx.forEach(ex => {
        const vals = raw.filter(s => s.date === date && s.exercise_name === ex).map(s => s.weight_kg);
        if (vals.length > 0) row[ex] = Math.max(...vals);
      });
      return row;
    });
    return { progress, exercises: topEx };
  }, [allTeamWeightRaw, selectedAthleteForExChart]);

  // ── Sub-componentes ────────────────────────────────────────────────────────

  const StatCard = ({ title, value, icon: Icon, sub }) => (
    <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-3 md:p-5 flex items-center justify-between shadow-lg hover:border-kinetic-neon/30 transition-colors">
      <div className="min-w-0 mr-2">
        <p className="text-kinetic-white/50 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 truncate">{title}</p>
        <p className="text-2xl md:text-3xl font-display font-bold text-kinetic-white leading-tight">{value}</p>
        {sub && <p className="text-[10px] md:text-xs text-kinetic-white/30 mt-1 hidden sm:block">{sub}</p>}
      </div>
      <div className="w-9 h-9 md:w-12 md:h-12 bg-kinetic-dark rounded-full flex items-center justify-center text-kinetic-neon shrink-0">
        <Icon className="w-4 h-4 md:w-6 md:h-6" />
      </div>
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-kinetic-black border border-kinetic-gray/80 rounded-lg px-4 py-3 shadow-xl">
        <p className="text-kinetic-white/60 text-xs mb-1 font-bold uppercase">{label}</p>
        {payload.map(p => (
          <p key={p.dataKey} className="text-kinetic-neon font-bold text-sm">{Math.round(p.value)}{p.dataKey === 'volume' ? ' kg' : p.dataKey === 'adherence' ? '%' : ''}</p>
        ))}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      <header className="mb-8 border-b border-kinetic-gray/30 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-kinetic-white uppercase tracking-wide">
            {user?.role === 'coach' || user?.role === 'treinador' ? 'Dashboard — Workout' : 'Dashboard'}
          </h1>
          <p className="text-kinetic-neon mt-2 font-medium">Bem-vindo(a), {user?.name || user?.email?.split('@')[0]}</p>
        </div>
        <div className="bg-kinetic-dark px-4 py-2 rounded-lg border border-kinetic-gray text-kinetic-white/50 text-sm uppercase font-bold tracking-widest">
          {user?.role || 'Visitante'}
        </div>
      </header>

      {loading ? (
        <div className="p-8 text-center text-kinetic-neon font-display animate-pulse uppercase tracking-widest">Carregando métricas...</div>
      ) : (
        <>
          {/* ── ATLETA ─────────────────────────────────────────────────────── */}
          {(user?.role === 'atleta' || user?.role === 'athlete' || !user?.role) && (
            <div className="space-y-8">

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                <StatCard title="Treinos" value={athleteMetrics.sessions} icon={CheckCircle} />
                <StatCard title="Streak 🔥" value={`${athleteMetrics.streak}d`} icon={Flame} sub="Dias consecutivos" />
                <StatCard title="Volume Total" value={athleteMetrics.totalVolume > 999 ? `${(athleteMetrics.totalVolume / 1000).toFixed(1)}t` : `${athleteMetrics.totalVolume}kg`} icon={Zap} />
                <StatCard title="Conclusão" value={`${athleteMetrics.avgCompletion}%`} icon={Target} sub="Média das sessões" />
                <StatCard title="Duração Média" value={`${athleteMetrics.avgDuration}min`} icon={Timer} />
              </div>

              {/* Volume — AreaChart com toggle de período */}
              <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-display font-bold text-kinetic-white uppercase flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-kinetic-neon" /> Volume de Treino
                  </h2>
                  <div className="flex gap-2">
                    {[7, 14, 30].map(d => (
                      <button key={d} onClick={() => setAthletePeriod(d)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          athletePeriod === d ? 'bg-kinetic-neon text-kinetic-black' : 'bg-kinetic-dark text-kinetic-white/50 border border-kinetic-gray hover:text-white'
                        }`}>{d}d</button>
                    ))}
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={buildChartData(
                      allSessions.filter(s => new Date(s.completed_at) >= new Date(Date.now() - athletePeriod * 86400000))
                    )}>
                      <defs>
                        <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={NEON} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={NEON} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff40" tick={{ fontSize: 10 }} interval={athletePeriod > 14 ? 3 : 0} />
                      <YAxis stroke="#ffffff40" tick={{ fontSize: 10 }} tickFormatter={v => v > 0 ? `${v}kg` : '0'} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="volume" name="Volume" stroke={NEON} strokeWidth={2}
                        fill="url(#volGrad)" dot={{ fill: NEON, r: 3 }} activeDot={{ r: 6, fill: NEON }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tendências — Taxa de Conclusão & Duração */}
              {allSessions.length > 1 && (() => {
                const trend = allSessions.slice(-14).map((s, i) => ({
                  name: `S${i + 1}`,
                  conclusao: Math.round(s.completion_rate || 0),
                  duracao: s.duration_minutes || 0,
                }));
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6">
                      <h2 className="text-base font-display font-bold text-kinetic-white uppercase mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4 text-kinetic-neon" /> Conclusão — Últimas Sessões
                      </h2>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                            <XAxis dataKey="name" stroke="#ffffff40" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#ffffff40" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="conclusao" name="Conclusão" stroke={NEON}
                              strokeWidth={2} dot={{ fill: NEON, r: 3 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6">
                      <h2 className="text-base font-display font-bold text-kinetic-white uppercase mb-4 flex items-center gap-2">
                        <Timer className="w-4 h-4 text-blue-400" /> Duração — Últimas Sessões
                      </h2>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                            <XAxis dataKey="name" stroke="#ffffff40" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#ffffff40" tick={{ fontSize: 10 }} unit="min" />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="duracao" name="Duração" stroke="#60A5FA"
                              strokeWidth={2} dot={{ fill: '#60A5FA', r: 3 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PRs — Recordes Pessoais */}
                <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6">
                  <h2 className="text-lg font-display font-bold text-kinetic-white uppercase mb-5 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" /> Recordes Pessoais
                  </h2>
                  {prs.length === 0 ? (
                    <div className="text-center py-8 text-kinetic-white/30 text-sm">
                      <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      Complete treinos com KG para ver seus recordes.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {prs.map((pr, i) => (
                        <div key={pr.exercise} className="flex items-center gap-3 p-3 rounded-lg bg-kinetic-dark border border-kinetic-gray/40 hover:border-kinetic-neon/30 transition-colors">
                          <span className={`text-xs font-bold w-5 text-center shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-kinetic-white/30'}`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                          </span>
                          <span className="flex-1 text-kinetic-white text-sm font-medium truncate">{pr.exercise}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-kinetic-neon font-bold font-mono">{pr.weight}kg</span>
                            {pr.reps && <span className="text-kinetic-white/30 text-xs">× {pr.reps}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Radar Muscular */}
                <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6">
                  <h2 className="text-lg font-display font-bold text-kinetic-white uppercase mb-5 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-kinetic-neon" /> Distribuição Muscular
                  </h2>
                  {muscleData.length === 0 ? (
                    <div className="text-center py-8 text-kinetic-white/30 text-sm">
                      <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      Complete treinos para ver a distribuição muscular.
                    </div>
                  ) : (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={muscleData}>
                          <PolarGrid stroke="#333" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#ffffff80', fontSize: 11 }} />
                          <Radar name="Volume" dataKey="A" stroke={NEON} fill={NEON} fillOpacity={0.15} strokeWidth={2} />
                          <Tooltip content={<CustomTooltip />} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Progressão de Carga por Exercício */}
              {weightProgressData.length > 1 && (() => {
                const COLORS = [NEON, '#60A5FA', '#F59E0B', '#A78BFA'];
                return (
                  <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6">
                    <h2 className="text-base font-display font-bold text-kinetic-white uppercase mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-kinetic-neon" /> Progressão de Carga — Top Exercícios
                    </h2>
                    <div className="flex flex-wrap gap-4 mb-4">
                      {progressionExercises.map((ex, i) => (
                        <span key={ex} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: COLORS[i] }}>
                          <span className="w-4 h-1 rounded-full inline-block" style={{ backgroundColor: COLORS[i] }} />
                          {ex}
                        </span>
                      ))}
                    </div>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weightProgressData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                          <XAxis dataKey="name" stroke="#ffffff40" tick={{ fontSize: 10 }} />
                          <YAxis stroke="#ffffff40" tick={{ fontSize: 10 }} unit="kg" />
                          <Tooltip content={<CustomTooltip />} />
                          {progressionExercises.map((ex, i) => (
                            <Line key={ex} type="monotone" dataKey={ex} stroke={COLORS[i]}
                              strokeWidth={2} dot={{ r: 4, fill: COLORS[i] }} activeDot={{ r: 7 }}
                              connectNulls />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

          {/* ── TREINADOR ──────────────────────────────────────────────────── */}
          {(user?.role === 'treinador' || user?.role === 'admin' || user?.role === 'coach') && (
            <div className="space-y-8">

              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {user?.role === 'admin' ? (
                  <>
                    <StatCard title="Total Treinadores" value={stats.coaches} icon={Users} />
                    <StatCard title="Total Atletas" value={stats.athletes} icon={Activity} />
                  </>
                ) : (
                  <>
                    <StatCard title="Atletas Vinculados" value={stats.athletes} icon={Users} />
                    <StatCard title="Treinos Criados" value={stats.workouts} icon={Dumbbell} />
                  </>
                )}
              </div>

              {/* Gráficos diários da equipe */}
              {teamSessions.length > 0 && (() => {
                const coachAdherenceBar = athletesDetails.map(a => ({
                  name: a.name.split(' ')[0], adherence: a.adherence,
                }));
                return (
                  <>
                    {/* Dois area charts lado a lado */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-base font-display font-bold text-kinetic-white uppercase flex items-center gap-2">
                            <Activity className="w-4 h-4 text-kinetic-neon" /> Sessões Diárias da Equipe
                          </h2>
                          <div className="flex gap-1">
                            {[7, 14, 30].map(d => (
                              <button key={d} onClick={() => setCoachPeriod(d)}
                                className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                                  coachPeriod === d ? 'bg-kinetic-neon text-kinetic-black' : 'bg-kinetic-dark text-kinetic-white/40 border border-kinetic-gray'
                                }`}>{d}d</button>
                            ))}
                          </div>
                        </div>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={buildChartData(teamSessions, coachPeriod)}>
                              <defs>
                                <linearGradient id="teamGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={NEON} stopOpacity={0.2} />
                                  <stop offset="95%" stopColor={NEON} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                              <XAxis dataKey="name" stroke="#ffffff40" tick={{ fontSize: 9 }} interval={coachPeriod > 14 ? 4 : 0} />
                              <YAxis stroke="#ffffff40" tick={{ fontSize: 9 }} allowDecimals={false} />
                              <Tooltip content={<CustomTooltip />} />
                              <Area type="monotone" dataKey="sessions" name="Sessões" stroke={NEON}
                                strokeWidth={2} fill="url(#teamGrad)" dot={false} activeDot={{ r: 4, fill: NEON }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Evolução de Carga por Exercício */}
                      <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6">
                        <h2 className="text-base font-display font-bold text-kinetic-white uppercase mb-3 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-kinetic-neon" /> Evolução de Carga — Exercícios
                        </h2>
                        {athleteExerciseChart.progress.length < 2 ? (
                          <div className="h-44 flex flex-col items-center justify-center text-kinetic-white/30 gap-2">
                            <TrendingUp className="w-8 h-8 opacity-20" />
                            <p className="text-xs text-center">Preencha o KG nos treinos para ver a evolução por exercício.</p>
                          </div>
                        ) : (() => {
                          const EX_COLORS = [NEON, '#60A5FA', '#F59E0B', '#A78BFA', '#F87171'];
                          return (
                            <>
                              <div className="flex flex-wrap gap-3 mb-3">
                                {athleteExerciseChart.exercises.map((ex, i) => (
                                  <span key={ex} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: EX_COLORS[i] }}>
                                    <span className="w-3 h-1 rounded-full inline-block" style={{ backgroundColor: EX_COLORS[i] }} />
                                    {ex}
                                  </span>
                                ))}
                              </div>
                              <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={athleteExerciseChart.progress}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                                    <XAxis dataKey="name" stroke="#ffffff40" tick={{ fontSize: 9 }} />
                                    <YAxis stroke="#ffffff40" tick={{ fontSize: 9 }} unit="kg" />
                                    <Tooltip content={<CustomTooltip />} />
                                    {athleteExerciseChart.exercises.map((ex, i) => (
                                      <Line key={ex} type="monotone" dataKey={ex} stroke={EX_COLORS[i]}
                                        strokeWidth={2} dot={{ r: 3, fill: EX_COLORS[i] }} activeDot={{ r: 5 }}
                                        connectNulls />
                                    ))}
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Barra de aderência por aluno */}
                    <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6">
                      <h2 className="text-base font-display font-bold text-kinetic-white uppercase mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4 text-kinetic-neon" /> Aderência Semanal por Aluno
                      </h2>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={coachAdherenceBar} barSize={48}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                            <XAxis dataKey="name" stroke="#ffffff40" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#ffffff40" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="adherence" name="Aderência" radius={[6, 6, 0, 0]}>
                              {coachAdherenceBar.map((e, i) => (
                                <Cell key={i} fill={e.adherence >= 80 ? NEON : e.adherence >= 50 ? '#FFAA00' : '#FF4444'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex gap-4 mt-3 text-xs text-kinetic-white/30">
                        <span><span className="inline-block w-2 h-2 rounded-full bg-kinetic-neon mr-1" />≥ 80% Excelente</span>
                        <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1" />50-79% Regular</span>
                        <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />&lt; 50% Alerta</span>
                      </div>
                    </div>
                  </>
                );
              })()}


              {/* Radar individual de alunos */}
              {athletesDetails.length > 0 && (
                <div>
                  <h2 className="text-xl font-display font-bold text-kinetic-white mb-6 uppercase border-b border-kinetic-gray pb-2 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-kinetic-neon" /> Radar Individual de Alunos
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {athletesDetails.map(ath => (
                      <div key={ath.id} className="bg-kinetic-dark rounded-xl p-5 border border-kinetic-gray/50 hover:border-kinetic-neon/40 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-kinetic-neon/5 rounded-full blur-2xl -mr-6 -mt-6" />
                        <div className="flex items-center gap-3 mb-5 relative z-10">
                          <div className="w-11 h-11 rounded-xl bg-kinetic-neon/15 flex items-center justify-center text-kinetic-neon font-display font-bold text-lg border border-kinetic-neon/20">
                            {ath.name?.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-kinetic-white leading-tight">{ath.name}</h3>
                            <p className="text-xs text-kinetic-white/40 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" /> Desde {new Date(ath.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
                          {[
                            { label: 'Fichas', value: ath.active_assignments },
                            { label: 'Sessões', value: ath.sessions_completed, color: 'text-kinetic-neon' },
                            { label: 'Semana', value: `${ath.week_sessions}T`, color: ath.week_sessions > 0 ? 'text-kinetic-neon' : 'text-kinetic-white/30' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-kinetic-black rounded-lg p-2 border border-kinetic-gray/40 text-center">
                              <p className="text-[10px] text-kinetic-white/40 uppercase tracking-wider mb-1">{label}</p>
                              <p className={`text-lg font-bold ${color || 'text-kinetic-white'}`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Barra de aderência */}
                        <div className="relative z-10">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-kinetic-white/40 uppercase font-bold">Aderência semanal</span>
                            <span className={`font-bold ${ath.adherence >= 80 ? 'text-kinetic-neon' : ath.adherence >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{ath.adherence}%</span>
                          </div>
                          <div className="h-1.5 bg-kinetic-gray/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${ath.adherence}%`,
                                backgroundColor: ath.adherence >= 80 ? NEON : ath.adherence >= 50 ? '#FFAA00' : '#FF4444',
                              }}
                            />
                          </div>
                        </div>

                        <div className="border-t border-kinetic-gray/30 pt-3 mt-3 flex justify-between items-center z-10 relative">
                          <span className="text-xs text-kinetic-white/40 uppercase font-bold">Última atividade:</span>
                          <span className={`text-xs font-bold ${ath.last_active === 'Sem atividade' ? 'text-kinetic-white/20' : 'text-kinetic-neon'}`}>{ath.last_active}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feed */}
              <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-display font-bold text-kinetic-white mb-6 uppercase flex items-center gap-2">
                  <Activity className="w-5 h-5 text-kinetic-neon" /> Feed Recente de Sistema
                </h2>
                {recentActivities.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-kinetic-white/10 mx-auto mb-3" />
                    <p className="text-kinetic-white/40 text-sm">Nenhuma atividade registrada ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivities.map((s, i) => (
                      <div key={i} className="flex items-center gap-4 py-3 px-3 border-b border-kinetic-gray/30 last:border-0 hover:bg-kinetic-dark/40 rounded-lg transition-colors">
                        <div className="w-9 h-9 rounded-full bg-kinetic-neon/15 border border-kinetic-neon/20 flex items-center justify-center text-kinetic-neon font-bold text-sm shrink-0">
                          {s.profiles?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-kinetic-white text-sm">
                            <span className="font-bold text-kinetic-neon">{s.profiles?.name || 'Atleta'}</span>
                            {' '}finalizou{' '}
                            <span className="text-kinetic-white/80 font-medium">"{s.workouts?.title || 'Treino'}"</span>
                          </p>
                          {(s.total_volume_kg || s.duration_minutes) && (
                            <p className="text-xs text-kinetic-white/30 mt-0.5 flex items-center gap-2">
                              {s.total_volume_kg > 0 && <span>⚡ {s.total_volume_kg}kg volume</span>}
                              {s.duration_minutes > 0 && <span>⏱ {s.duration_minutes}min</span>}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-kinetic-white/30 font-mono bg-kinetic-dark px-2 py-1 rounded shrink-0">
                          {new Date(s.completed_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
}
