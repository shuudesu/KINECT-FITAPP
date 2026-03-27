import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, ChevronLeft } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

export default function WorkoutSession() {
  const { user } = useAuth();
  const [started, setStarted] = useState(false);
  const [completedSets, setCompletedSets] = useState({});
  
  const [availableWorkouts, setAvailableWorkouts] = useState([]);
  const [workout, setWorkout] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // Buscar treinos atribuídos ao atleta
    const fetchAssignedWorkouts = async () => {
      try {
        const { data: allocations } = await supabase
          .from('workout_assignments')
          .select('workout_id')
          .eq('athlete_id', user.id);
          
        if (allocations && allocations.length > 0) {
           const wIds = allocations.map(a => a.workout_id);
           const { data: wList, error } = await supabase
              .from('workouts')
              .select('*')
              .in('id', wIds)
              .order('title', { ascending: true });
           
           if (wList) setAvailableWorkouts(wList);
           if (error) throw error;
        }
      } catch (err) {
        console.error("Erro ao carregar treinos atribuídos", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignedWorkouts();
  }, [user.id]);

  const toggleSet = (exerciseIndex, setIndex) => {
    setCompletedSets(prev => ({
      ...prev,
      [`${exerciseIndex}-${setIndex}`]: !prev[`${exerciseIndex}-${setIndex}`]
    }));
  };

  const updateSetData = (exerciseIndex, setIndex, field, value) => {
    setCompletedSets(prev => ({
      ...prev,
      [`${exerciseIndex}-${setIndex}-data`]: {
        ...prev[`${exerciseIndex}-${setIndex}-data`],
        [field]: value
      }
    }));
  };

  const handleFinish = async () => {
    setSaving(true);
    setMsg('');
    try {
      const { error } = await supabase
        .from('workout_sessions')
        .insert([
          {
            athlete_id: user.id,
            workout_id: workout.id,
            stats: completedSets
          }
        ]);
        
      if (error) throw error;
      setMsg('Treino finalizado e salvo com sucesso! Máquina!');
      setStarted(false); 
      setWorkout(null); // Volta pra lista de treinos
    } catch (err) {
      console.error(err);
      setMsg('Erro ao salvar sessão.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
     return <div className="text-center text-kinetic-white flex items-center justify-center p-12"><span className="animate-pulse">Sincronizando prancheta...</span></div>;
  }

  // SE NÃO SELECIONOU TREINO AINDA
  if (!workout) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="mb-8 border-b border-kinetic-gray pb-6">
          <h1 className="text-3xl font-display font-bold text-kinetic-white uppercase tracking-wide">
            Minhas Fichas
          </h1>
          <p className="text-kinetic-white/60 mt-1">Selecione o seu treino do dia estruturado pelo treinador.</p>
        </header>

        {msg && <div className="p-4 bg-kinetic-neon/10 border border-kinetic-neon text-kinetic-neon font-bold rounded-lg mb-6">{msg}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableWorkouts.length === 0 ? (
            <div className="col-span-full p-8 border border-dashed border-kinetic-gray text-center rounded-xl text-kinetic-white/50">
              Nenhuma ficha de treino foi enviada para você ainda.<br/>Solicite ao seu treinador para atribuí-las na sua conta.
            </div>
          ) : (
            availableWorkouts.map(w => (
              <button 
                key={w.id} 
                onClick={() => setWorkout(w)} 
                className="bg-kinetic-black p-6 rounded-xl border border-kinetic-gray flex items-center justify-between hover:border-kinetic-neon hover:-translate-y-1 transition-all group shadow-lg text-left"
              >
                <div>
                  <h3 className="text-xl font-display font-bold text-kinetic-white group-hover:text-kinetic-neon transition-colors uppercase">{w.title}</h3>
                  <p className="text-sm text-kinetic-white/50 mt-1 font-medium">{w.exercises?.length || 0} exercícios na ficha</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-kinetic-dark border border-kinetic-gray flex items-center justify-center group-hover:bg-kinetic-neon group-hover:border-kinetic-neon transition-colors">
                  <Play className="w-5 h-5 text-kinetic-white transition-colors group-hover:text-kinetic-black translate-x-0.5" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  const totalSets = (workout.exercises || []).reduce((acc, curr) => acc + Number(curr.sets || 0), 0);

  // SE SELECIONOU, MAS NÃO INICIOU
  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto text-center px-4">
        <button onClick={() => setWorkout(null)} className="absolute top-24 left-6 text-kinetic-white/50 hover:text-white flex items-center gap-1 font-bold text-sm uppercase">
          <ChevronLeft className="w-4 h-4" /> Voltar às fichas
        </button>
        
        <h2 className="text-3xl font-display font-bold text-kinetic-white mb-2">TREINO DO DIA</h2>
        <h3 className="text-kinetic-neon text-5xl font-display mb-10 uppercase tracking-wider">{workout.title}</h3>
        
        <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-8 w-full mb-8 text-center text-kinetic-white/70 shadow-2xl">
          <p className="mb-6 uppercase text-sm font-bold opacity-60 tracking-wider">Métrica da Sessão</p>
          <div className="flex justify-center divide-x divide-kinetic-gray">
             <div className="px-8">
                <span className="block text-4xl font-display text-white mb-1">{workout.exercises?.length || 0}</span>
                <span className="text-xs uppercase font-bold tracking-wider opacity-60">Movimentos</span>
             </div>
             <div className="px-8">
                <span className="block text-4xl font-display text-kinetic-neon mb-1">{totalSets}</span>
                <span className="text-xs uppercase font-bold tracking-wider opacity-60">Séries OBR.</span>
             </div>
          </div>
        </div>

        <button 
          onClick={() => {
            setStarted(true);
            setMsg('');
            setCompletedSets({});
          }}
          className="bg-kinetic-neon text-kinetic-black w-full py-5 rounded-full font-bold text-xl uppercase tracking-widest hover:bg-kinetic-white hover:scale-105 transition-all shadow-[0_0_40px_rgba(204,255,0,0.3)] flex justify-center items-center gap-3"
        >
          <Play className="w-6 h-6 fill-current" />
          QUEBRAR TUDO
        </button>
      </div>
    );
  }

  // SESSÃO INICIADA
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-kinetic-gray pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-kinetic-white uppercase">
            {workout.title}
          </h1>
          <p className="text-kinetic-neon text-sm flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-kinetic-neon animate-pulse shadow-[0_0_10px_rgba(204,255,0,0.8)]"></span>
            SESSÃO EM PROGRESSO
          </p>
        </div>
        <button 
          onClick={handleFinish}
          disabled={saving}
          className="bg-kinetic-neon text-kinetic-black px-8 py-3 rounded-lg font-bold hover:bg-kinetic-white transition-colors uppercase tracking-wider disabled:opacity-50"
        >
           {saving ? 'Registrando...' : 'Finalizar Treino'}
        </button>
      </header>

      <div className="space-y-6">
        {(workout.exercises || []).map((exercise, index) => (
          <div key={index} className="bg-kinetic-black border border-kinetic-gray rounded-xl p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-2">
              <h2 className="text-xl font-bold text-kinetic-white flex items-center gap-3">
                <span className="text-kinetic-neon font-display text-2xl">{index + 1}.</span> {exercise.name}
              </h2>
              <div className="sm:text-right flex sm:flex-col gap-4 sm:gap-0 items-center sm:items-end">
                 {exercise.weight && <p className="text-sm font-bold text-kinetic-neon bg-kinetic-neon/10 px-3 py-1 rounded inline-block">Carga Alvo: {exercise.weight} kg</p>}
                <p className="text-sm font-bold text-kinetic-white/50 bg-kinetic-dark px-3 py-1 rounded">{exercise.sets} séries x {exercise.reps} reps</p>
              </div>
            </div>

            <div className="space-y-3">
              {[...Array(Number(exercise.sets) || 0)].map((_, sIndex) => {
                const isCompleted = completedSets[`${index}-${sIndex}`];
                return (
                  <div key={sIndex} className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${isCompleted ? 'bg-kinetic-neon/10 border-kinetic-neon' : 'bg-kinetic-dark border-kinetic-gray/50'}`}>
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm ${isCompleted ? 'bg-kinetic-neon text-kinetic-black' : 'bg-kinetic-black text-kinetic-white/50'}`}>
                      {sIndex + 1}
                    </div>
                    
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-kinetic-white/30 font-bold">KG</span>
                        <input 
                          type="number" 
                          placeholder="-" 
                          onChange={(e) => updateSetData(index, sIndex, 'weight', e.target.value)}
                          className={`w-full bg-kinetic-black border ${isCompleted ? 'border-kinetic-neon/30 text-kinetic-neon' : 'border-kinetic-gray text-kinetic-white'} rounded py-2 pl-9 pr-2 focus:outline-none focus:border-kinetic-neon font-mono`} 
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-kinetic-white/30 font-bold">REPS</span>
                        <input 
                          type="number" 
                          defaultValue={exercise.reps.split('-')[0]} 
                          onChange={(e) => updateSetData(index, sIndex, 'reps_done', e.target.value)}
                          className={`w-full bg-kinetic-black border ${isCompleted ? 'border-kinetic-neon/30 text-kinetic-neon' : 'border-kinetic-gray text-kinetic-white'} rounded py-2 pl-12 pr-2 focus:outline-none focus:border-kinetic-neon font-mono`} 
                        />
                      </div>
                    </div>
                    
                    <button onClick={() => toggleSet(index, sIndex)} className="relative group">
                      <div className={`absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity ${isCompleted ? 'bg-kinetic-neon' : 'bg-white/20'}`}></div>
                      {isCompleted ? (
                        <CheckCircle2 className="w-10 h-10 text-kinetic-neon relative z-10 drop-shadow-[0_0_10px_rgba(204,255,0,0.8)]" />
                      ) : (
                        <div className="w-10 h-10 rounded-full border-2 border-kinetic-gray/80 group-hover:border-kinetic-white/50 relative z-10 transition-colors bg-kinetic-black"></div>
                      )}
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
