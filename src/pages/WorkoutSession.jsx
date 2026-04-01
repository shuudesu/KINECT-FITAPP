import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, CheckCircle2, ChevronLeft, CheckCircle, Trophy, Timer, Zap, TrendingUp, RotateCcw } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

export default function WorkoutSession() {
  const { user } = useAuth();
  const [started, setStarted] = useState(false);
  const [completedSets, setCompletedSets] = useState({});
  const startedAtRef = useRef(null);

  const [availableWorkouts, setAvailableWorkouts] = useState([]);
  const [weeklyCompletions, setWeeklyCompletions] = useState({}); // workout_id -> completed_at (7 dias)
  const [workout, setWorkout] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: allocations } = await supabase
          .from('workout_assignments')
          .select('workout_id')
          .eq('athlete_id', user.id);

        if (allocations && allocations.length > 0) {
          const wIds = allocations.map(a => a.workout_id);

          const [wListRes, recentRes] = await Promise.all([
            supabase.from('workouts').select('*').in('id', wIds).order('title', { ascending: true }),
            supabase.from('workout_sessions')
              .select('workout_id, completed_at')
              .eq('athlete_id', user.id)
              .in('workout_id', wIds)
              .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
          ]);

          if (wListRes.data) setAvailableWorkouts(wListRes.data);

          if (recentRes.data) {
            const map = {};
            recentRes.data.forEach(s => {
              if (!map[s.workout_id] || new Date(s.completed_at) > new Date(map[s.workout_id])) {
                map[s.workout_id] = s.completed_at;
              }
            });
            setWeeklyCompletions(map);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar treinos:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const toggleSet = (exIdx, sIdx) => {
    const isNowComplete = !completedSets[`${exIdx}-${sIdx}`];
    setCompletedSets(prev => {
      const next = { ...prev, [`${exIdx}-${sIdx}`]: isNowComplete };
      // Se está marcando como feito, garante que reps_done exista com valor default
      if (isNowComplete && !prev[`${exIdx}-${sIdx}-data`]?.reps_done) {
        const exercise = workout?.exercises?.[exIdx];
        const defaultReps = String(exercise?.reps || '').split('-')[0] || '0';
        next[`${exIdx}-${sIdx}-data`] = { ...prev[`${exIdx}-${sIdx}-data`], reps_done: defaultReps };
      }
      return next;
    });
  };

  const updateSetData = (exIdx, sIdx, field, value) =>
    setCompletedSets(prev => ({
      ...prev,
      [`${exIdx}-${sIdx}-data`]: { ...prev[`${exIdx}-${sIdx}-data`], [field]: value },
    }));

  // Volume e séries em tempo real (durante sessão ativa)
  const liveVolume = useMemo(() => {
    if (!workout?.exercises) return 0;
    let total = 0;
    workout.exercises.forEach((ex, exIdx) => {
      for (let sIdx = 0; sIdx < Number(ex.sets || 0); sIdx++) {
        if (completedSets[`${exIdx}-${sIdx}`]) {
          const raw = completedSets[`${exIdx}-${sIdx}-data`] || {};
          const kg = parseFloat(raw.weight) || 0;
          const reps = parseInt(raw.reps_done) || parseInt(String(ex.reps || '').split('-')[0]) || 0;
          total += kg * reps;
        }
      }
    });
    return Math.round(total * 10) / 10;
  }, [completedSets, workout]);

  const liveSets = useMemo(() =>
    Object.keys(completedSets).filter(k => !k.includes('-data') && completedSets[k]).length,
  [completedSets]);


  const handleFinish = async () => {
    setSaving(true);
    const finishedAt = new Date().toISOString();
    const startedAt = startedAtRef.current || finishedAt;
    const durationMinutes = Math.max(1, Math.round((new Date(finishedAt) - new Date(startedAt)) / 60000));

    const exercises = workout.exercises || [];
    const setsRows = [];
    let totalVolume = 0, setsDone = 0, setsTotal = 0, exercisesCompleted = 0;

    exercises.forEach((exercise, exIdx) => {
      const numSets = Number(exercise.sets) || 0;
      setsTotal += numSets;
      let exDone = false;

      for (let sIdx = 0; sIdx < numSets; sIdx++) {
        const isDone = !!completedSets[`${exIdx}-${sIdx}`];
        const raw = completedSets[`${exIdx}-${sIdx}-data`] || {};
        const kg = parseFloat(raw.weight) || 0;
        const repsDone = parseInt(raw.reps_done) || parseInt(String(exercise.reps || '').split('-')[0]) || 0;
        const repsPlanned = parseInt(String(exercise.reps || '').split('-')[0]) || 0;
        const vol = isDone ? kg * repsDone : 0;

        if (isDone) { setsDone++; totalVolume += vol; exDone = true; }

        setsRows.push({
          exercise_name: exercise.name || exercise.customName || 'Exercício',
          set_number: sIdx + 1,
          weight_kg: kg > 0 ? kg : null,
          reps_planned: repsPlanned || null,
          reps_done: isDone ? repsDone : null,
          is_completed: isDone,
          volume_kg: isDone ? Math.round(vol * 10) / 10 : 0,
        });
      }
      if (exDone) exercisesCompleted++;
    });

    const completionRate = setsTotal > 0 ? Math.round((setsDone / setsTotal) * 100) : 0;
    const volumeRounded = Math.round(totalVolume * 10) / 10;

    try {
      const { data: sessionData, error } = await supabase
        .from('workout_sessions')
        .insert([{
          athlete_id: user.id,
          workout_id: workout.id,
          started_at: startedAt,
          completed_at: finishedAt,
          duration_minutes: durationMinutes,
          exercises_total: exercises.length,
          exercises_completed: exercisesCompleted,
          sets_total: setsTotal,
          sets_done: setsDone,
          total_volume_kg: volumeRounded,
          completion_rate: completionRate,
          stats: completedSets,
        }])
        .select('id')
        .single();

      if (error) throw error;

      // Salvar séries individuais — aguardar para capturar erro
      if (sessionData?.id && setsRows.length > 0) {
        const { error: setsError } = await supabase
          .from('session_sets')
          .insert(setsRows.map(r => ({ ...r, session_id: sessionData.id, athlete_id: user.id })));
        if (setsError) {
          console.warn('session_sets não salvo:', setsError.message);
          // Não bloquear o fluxo — sessão principal foi salva
        }
      }

      // Tick imediato no card
      setWeeklyCompletions(prev => ({ ...prev, [workout.id]: finishedAt }));

      setSessionResult({ durationMinutes, totalVolume: volumeRounded, setsDone, setsTotal, completionRate, exercisesCompleted, exercisesTotal: exercises.length });
      setStarted(false);
      setWorkout(null);
    } catch (err) {
      console.error(err);
      setMsg('Erro ao salvar sessão. Verifique o console.');
    } finally {
      setSaving(false);
    }
  };

  // ── Telas ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-kinetic-white">
        <span className="animate-pulse font-display tracking-widest uppercase">Sincronizando prancheta...</span>
      </div>
    );
  }

  // TELA: Resumo pós-sessão
  if (sessionResult) {
    const cards = [
      { label: 'Duração', value: `${sessionResult.durationMinutes}min`, icon: Timer, color: 'text-kinetic-neon' },
      { label: 'Volume Total', value: `${sessionResult.totalVolume}kg`, icon: Zap, color: 'text-yellow-400' },
      { label: 'Conclusão', value: `${sessionResult.completionRate}%`, icon: CheckCircle, color: 'text-emerald-400' },
      { label: 'Séries', value: `${sessionResult.setsDone}/${sessionResult.setsTotal}`, icon: TrendingUp, color: 'text-blue-400' },
    ];
    return (
      <div className="max-w-2xl mx-auto text-center px-4 py-8 animate-fade-in">
        <div className="mb-8">
          <div className="w-24 h-24 bg-kinetic-neon/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-kinetic-neon shadow-[0_0_40px_rgba(204,255,0,0.3)]">
            <Trophy className="w-12 h-12 text-kinetic-neon" />
          </div>
          <h1 className="text-4xl font-display font-bold text-kinetic-white uppercase mb-2">Sessão Concluída!</h1>
          <p className="text-kinetic-white/50 text-lg">Dados registrados com sucesso 💪</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {cards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-kinetic-black border border-kinetic-gray rounded-xl p-5 flex flex-col items-center">
              <Icon className={`w-6 h-6 ${color} mb-2`} />
              <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
              <p className="text-kinetic-white/40 text-xs mt-1 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setSessionResult(null)}
          className="bg-kinetic-neon text-kinetic-black font-bold px-10 py-4 rounded-full uppercase tracking-widest hover:bg-kinetic-white hover:scale-105 transition-all shadow-[0_0_30px_rgba(204,255,0,0.3)] flex items-center gap-2 mx-auto"
        >
          <RotateCcw className="w-4 h-4" /> Ver Minhas Fichas
        </button>
      </div>
    );
  }

  // TELA: Lista de fichas
  if (!workout) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="mb-8 border-b border-kinetic-gray pb-6">
          <h1 className="text-3xl font-display font-bold text-kinetic-white uppercase tracking-wide">Minhas Fichas</h1>
          <p className="text-kinetic-white/60 mt-1">Selecione o seu treino do dia estruturado pelo treinador.</p>
        </header>

        {msg && <div className="p-4 bg-kinetic-neon/10 border border-kinetic-neon text-kinetic-neon font-bold rounded-lg mb-6">{msg}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableWorkouts.length === 0 ? (
            <div className="col-span-full p-10 border border-dashed border-kinetic-gray text-center rounded-xl text-kinetic-white/50">
              Nenhuma ficha de treino foi enviada para você ainda.<br />Solicite ao seu treinador.
            </div>
          ) : (
            availableWorkouts.map(w => {
              const done = !!weeklyCompletions[w.id];
              return (
                <button
                  key={w.id}
                  onClick={() => setWorkout(w)}
                  className={`relative bg-kinetic-black p-6 rounded-xl border flex items-center justify-between hover:-translate-y-1 transition-all group shadow-lg text-left overflow-hidden ${done ? 'border-kinetic-neon/40' : 'border-kinetic-gray hover:border-kinetic-neon'}`}
                >
                  {done && <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-kinetic-neon to-transparent" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className={`text-xl font-display font-bold uppercase transition-colors ${done ? 'text-kinetic-neon' : 'text-kinetic-white group-hover:text-kinetic-neon'}`}>{w.title}</h3>
                      {done && (
                        <span className="flex items-center gap-1 text-xs bg-kinetic-neon/15 text-kinetic-neon px-2 py-0.5 rounded-full font-bold border border-kinetic-neon/30">
                          <CheckCircle className="w-3 h-3" /> Feito esta semana
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-kinetic-white/50 font-medium">{w.exercises?.length || 0} exercícios na ficha</p>
                    {done && <p className="text-xs text-kinetic-neon/40 mt-1">↻ Reset automático em 7 dias</p>}
                  </div>
                  <div className={`w-12 h-12 rounded-full border flex items-center justify-center transition-colors shrink-0 ml-4 ${done ? 'bg-kinetic-neon/10 border-kinetic-neon' : 'bg-kinetic-dark border-kinetic-gray group-hover:bg-kinetic-neon group-hover:border-kinetic-neon'}`}>
                    {done
                      ? <CheckCircle2 className="w-6 h-6 text-kinetic-neon" />
                      : <Play className="w-5 h-5 text-kinetic-white group-hover:text-kinetic-black translate-x-0.5" />
                    }
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const totalSets = (workout.exercises || []).reduce((acc, ex) => acc + Number(ex.sets || 0), 0);

  // TELA: Preview antes de iniciar
  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto text-center px-4">
        <button onClick={() => setWorkout(null)} className="absolute top-24 left-6 text-kinetic-white/50 hover:text-white flex items-center gap-1 font-bold text-sm uppercase">
          <ChevronLeft className="w-4 h-4" /> Voltar às fichas
        </button>

        <h2 className="text-3xl font-display font-bold text-kinetic-white mb-2">TREINO DO DIA</h2>
        <h3 className="text-kinetic-neon text-5xl font-display mb-10 uppercase tracking-wider">{workout.title}</h3>

        <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-8 w-full mb-8 shadow-2xl">
          <p className="mb-6 uppercase text-sm font-bold text-kinetic-white/40 tracking-wider">Métrica da Sessão</p>
          <div className="flex justify-center divide-x divide-kinetic-gray">
            <div className="px-8">
              <span className="block text-4xl font-display text-white mb-1">{workout.exercises?.length || 0}</span>
              <span className="text-xs uppercase font-bold tracking-wider text-kinetic-white/40">Movimentos</span>
            </div>
            <div className="px-8">
              <span className="block text-4xl font-display text-kinetic-neon mb-1">{totalSets}</span>
              <span className="text-xs uppercase font-bold tracking-wider text-kinetic-white/40">Séries OBR.</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setStarted(true);
            setMsg('');
            setCompletedSets({});
            startedAtRef.current = new Date().toISOString();
          }}
          className="bg-kinetic-neon text-kinetic-black w-full py-5 rounded-full font-bold text-xl uppercase tracking-widest hover:bg-kinetic-white hover:scale-105 transition-all shadow-[0_0_40px_rgba(204,255,0,0.3)] flex justify-center items-center gap-3"
        >
          <Play className="w-6 h-6 fill-current" /> QUEBRAR TUDO
        </button>
      </div>
    );
  }

  // TELA: Sessão ativa
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-kinetic-gray pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-kinetic-white uppercase">{workout.title}</h1>
          <p className="text-kinetic-neon text-sm flex items-center gap-2 font-medium mt-1">
            <span className="w-2 h-2 rounded-full bg-kinetic-neon animate-pulse shadow-[0_0_10px_rgba(204,255,0,0.8)]" />
            SESSÃO EM PROGRESSO
          </p>
          {/* Contador ao vivo */}
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-sm font-bold text-kinetic-neon">
              <Zap className="w-3 h-3" /> {liveVolume > 0 ? `${liveVolume}kg` : '--'}
            </span>
            <span className="text-xs text-kinetic-white/40 font-bold">{liveSets}/{totalSets} séries</span>
          </div>
        </div>
        <button
          onClick={handleFinish}
          disabled={saving}
          className="bg-kinetic-neon text-kinetic-black px-8 py-3 rounded-lg font-bold hover:bg-kinetic-white transition-colors uppercase tracking-wider disabled:opacity-50"
        >
          {saving ? 'Registrando...' : 'Finalizar Treino'}
        </button>
      </header>

      {msg && <div className="p-4 bg-red-500/10 border border-red-500 text-red-400 font-bold rounded-lg">{msg}</div>}

      <div className="space-y-6">
        {(workout.exercises || []).map((exercise, index) => (
          <div key={index} className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-2">
              <h2 className="text-xl font-bold text-kinetic-white flex items-center gap-3">
                <span className="text-kinetic-neon font-display text-2xl">{index + 1}.</span>
                {exercise.name || exercise.customName}
              </h2>
              <div className="sm:text-right flex flex-col gap-1 sm:items-end">
                {exercise.comment && <p className="text-sm text-kinetic-neon/70 italic">💬 {exercise.comment}</p>}
                <p className="text-sm font-bold text-kinetic-white/50 bg-kinetic-dark px-3 py-1 rounded">
                  {exercise.sets} séries × {exercise.reps} reps
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[...Array(Number(exercise.sets) || 0)].map((_, sIndex) => {
                const isCompleted = !!completedSets[`${index}-${sIndex}`];
                return (
                  <div key={sIndex} className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${isCompleted ? 'bg-kinetic-neon/10 border-kinetic-neon' : 'bg-kinetic-dark border-kinetic-gray/50'}`}>
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm shrink-0 ${isCompleted ? 'bg-kinetic-neon text-kinetic-black' : 'bg-kinetic-black text-kinetic-white/50'}`}>
                      {sIndex + 1}
                    </div>

                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold z-10"
                          style={{ color: isCompleted && !completedSets[`${index}-${sIndex}-data`]?.weight ? '#FFAA00' : '#ffffff30' }}>
                          KG
                        </span>
                        <input
                          type="number"
                          placeholder="-"
                          onChange={e => updateSetData(index, sIndex, 'weight', e.target.value)}
                          className={`w-full bg-kinetic-black border rounded py-2 pl-9 pr-2 focus:outline-none focus:border-kinetic-neon font-mono transition-colors ${
                            isCompleted && !completedSets[`${index}-${sIndex}-data`]?.weight
                              ? 'border-yellow-500/70 text-yellow-400'
                              : isCompleted
                              ? 'border-kinetic-neon/30 text-kinetic-neon'
                              : 'border-kinetic-gray text-kinetic-white'
                          }`}
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-kinetic-white/30 font-bold">REPS</span>
                        <input
                          type="number"
                          defaultValue={String(exercise.reps || '').split('-')[0]}
                          onChange={e => updateSetData(index, sIndex, 'reps_done', e.target.value)}
                          className={`w-full bg-kinetic-black border rounded py-2 pl-12 pr-2 focus:outline-none focus:border-kinetic-neon font-mono ${isCompleted ? 'border-kinetic-neon/30 text-kinetic-neon' : 'border-kinetic-gray text-kinetic-white'}`}
                        />
                      </div>
                    </div>

                    <button onClick={() => toggleSet(index, sIndex)} className="relative group shrink-0">
                      <div className={`absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity ${isCompleted ? 'bg-kinetic-neon' : 'bg-white/20'}`} />
                      {isCompleted
                        ? <CheckCircle2 className="w-10 h-10 text-kinetic-neon relative z-10 drop-shadow-[0_0_10px_rgba(204,255,0,0.8)]" />
                        : <div className="w-10 h-10 rounded-full border-2 border-kinetic-gray/80 group-hover:border-kinetic-white/50 relative z-10 transition-colors bg-kinetic-black" />
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
