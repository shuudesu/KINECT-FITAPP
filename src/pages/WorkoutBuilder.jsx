import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GripVertical, Edit2, X, Dumbbell, CheckCircle, Users, UserPlus } from 'lucide-react';
import { EXERCISE_GROUPS } from '../constants/exercises';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import AssignToStudentModal from '../components/AssignToStudentModal';

export default function WorkoutBuilder() {
  const { user } = useAuth();
  
  // Form State
  const [editingId, setEditingId] = useState(null);
  const [assigningToAthlete, setAssigningToAthlete] = useState(null);
  const [title, setTitle] = useState('');
  const [exercises, setExercises] = useState([
    { id: Date.now(), name: '', isCustom: false, customName: '', sets: 3, reps: '10', weight: '' }
  ]);
  
  // Feedback & Data State
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [existingWorkouts, setExistingWorkouts] = useState([]);
  const [coachCustomExercises, setCoachCustomExercises] = useState([]);
  const [savingToList, setSavingToList] = useState(null); // id do exercício sendo salvo
  const [athletes, setAthletes] = useState([]);

  useEffect(() => {
    if (user?.id) {
      fetchWorkouts();
      fetchAthletes();
      fetchCoachCustomExercises();
    }
  }, [user]);

  const fetchCoachCustomExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('coach_custom_exercises')
        .select('name')
        .eq('coach_id', user.id)
        .order('name', { ascending: true });
      if (error) throw error;
      setCoachCustomExercises((data || []).map(r => r.name));
    } catch (err) {
      // Tabela ainda não existe — lista fica vazia até ser criada
      console.warn('coach_custom_exercises:', err.message);
      setCoachCustomExercises([]);
    }
  };


  const saveExerciseToMyList = async (exerciseId, exerciseName) => {
    const trimmed = exerciseName?.trim();
    if (!trimmed) return;
    if (coachCustomExercises.includes(trimmed)) {
      setSuccess(`"${trimmed}" já está na sua lista!`);
      setTimeout(() => setSuccess(''), 2000);
      return;
    }
    setSavingToList(exerciseId);
    try {
      const { error } = await supabase
        .from('coach_custom_exercises')
        .insert([{ coach_id: user.id, name: trimmed }]);
      if (error) throw error;
      setCoachCustomExercises(prev => [...prev, trimmed].sort());
      setSuccess(`✨ "${trimmed}" salvo na sua lista!`);
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      console.error('Erro ao salvar exercício:', err);
      setError('Não foi possível salvar. Execute o SQL no Supabase para criar a tabela coach_custom_exercises.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingToList(null);
    }
  };

  const deleteExerciseFromMyList = async (exerciseName) => {
    if (!window.confirm(`Remover "${exerciseName}" da sua lista pessoal?`)) return;
    try {
      const { error } = await supabase
        .from('coach_custom_exercises')
        .delete()
        .eq('coach_id', user.id)
        .eq('name', exerciseName);
      if (error) throw error;
      setCoachCustomExercises(prev => prev.filter(n => n !== exerciseName));
      // Se algum exercício no form usava esse nome, limpar
      setExercises(prev => prev.map(ex =>
        ex.name === exerciseName ? { ...ex, name: '' } : ex
      ));
      setSuccess(`"${exerciseName}" removido da sua lista.`);
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      console.error('Erro ao excluir exercício:', err);
      setError('Não foi possível excluir.');
      setTimeout(() => setError(''), 3000);
    }
  };
  const fetchWorkouts = async () => {

    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const standardWorkouts = (data || []).filter(w => !w.exercises || !w.exercises[0] || !w.exercises[0].is_hiit);
      setExistingWorkouts(standardWorkouts);

    } catch (err) {
      console.error('Erro ao buscar treinos:', err);
    }
  };


  const fetchAthletes = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, created_at')
        .eq('coach_id', user.id);
      
      if (error) throw error;
      setAthletes(data || []);
    } catch (err) {
      console.error('Erro ao buscar alunos:', err);
    }
  };

  const addExercise = () => {
    setExercises([...exercises, { id: Date.now(), name: '', isCustom: false, customName: '', sets: 3, reps: '10', weight: '' }]);
  };

  const removeExercise = (id) => {
    setExercises(exercises.filter(ex => ex.id !== id));
  };

  const handleSave = async () => {
    if (!title) {
      setError('O treino precisa de um título.');
      return;
    }
    
    for (const ex of exercises) {
      if (!ex.isCustom && !ex.name) {
        setError('Preencha o nome de todos os exercícios.');
        return;
      }
      if (ex.isCustom && !ex.customName.trim()) {
        setError('Preencha o nome do exercício personalizado.');
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const mappedExercises = exercises.map(ex => ({
        name: ex.isCustom ? ex.customName.trim() : ex.name,
        sets: Number(ex.sets),
        reps: String(ex.reps),
        weight: String(ex.weight)
      }));

      if (editingId) {
        // UPDATE
        const { error: dbError } = await supabase
          .from('workouts')
          .update({ title, exercises: mappedExercises })
          .eq('id', editingId)
          .eq('coach_id', user.id);
        if (dbError) throw dbError;
        setSuccess('Treino atualizado com sucesso!');
      } else {
        // INSERT
        const { error: dbError } = await supabase
          .from('workouts')
          .insert([{ title, coach_id: user.id, exercises: mappedExercises }]);
        if (dbError) throw dbError;
        setSuccess('Treino salvo com sucesso!');
      }

      resetForm();
      fetchWorkouts();
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar o treino. Verifique console.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setExercises([{ id: Date.now(), name: '', isCustom: false, customName: '', sets: 3, reps: '10', weight: '' }]);
  };

  const handleEdit = (w) => {
    setEditingId(w.id);
    setTitle(w.title);
    setError('');
    setSuccess('');
    
    // Flat de todos exercícios base
    const allPresets = Object.values(EXERCISE_GROUPS).flat();
    
    if (w.exercises && w.exercises.length > 0) {
      const mapped = w.exercises.map((ex, i) => {
         const isCustom = !allPresets.includes(ex.name);
         return {
           id: Date.now() + i, 
           name: isCustom ? 'CUSTOM_EXERCISE' : ex.name,
           isCustom,
           customName: isCustom ? ex.name : '',
           sets: ex.sets || 3,
           reps: ex.reps || '10',
           weight: ex.weight || ''
         };
      });
      setExercises(mapped);
    } else {
      setExercises([{ id: Date.now(), name: '', isCustom: false, customName: '', sets: 3, reps: '10', weight: '' }]);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };



  const handleDeleteWorkout = async (id) => {
    if (!window.confirm("ATENÇÃO: Deseja realmente excluir este treino permanentemente? Isso irá removê-lo do aplicativo e das fichas dos alunos atribuídos.")) return;
    try {
      // Remover referências primeiro para não dar erro de restrição de chave estrangeira
      const { error: assignError } = await supabase.from('workout_assignments').delete().eq('workout_id', id);
      if (assignError) console.warn("Aviso ao remover atribuições:", assignError);

      const { error } = await supabase.from('workouts').delete().eq('id', id).eq('coach_id', user.id);
      if (error) throw error;
      
      fetchWorkouts();
      if (editingId === id) resetForm();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir o treino.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      
      {/* FORMULÁRIO DE CRIAÇÃO/EDIÇÃO */}
      <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-8 shadow-2xl relative overflow-hidden">
        {editingId && (
          <div className="absolute top-0 left-0 w-full h-1 bg-kinetic-neon animate-pulse"></div>
        )}
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-kinetic-white uppercase tracking-wide flex items-center gap-3">
              {editingId ? <><Edit2 className="w-6 h-6 text-kinetic-neon" /> Editando Treino</> : 'Workout Builder'}
            </h1>
            <p className="text-kinetic-white/60 mt-1">Crie e edite as sessões de treino para seus atletas.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {editingId && (
              <button 
                onClick={resetForm}
                className="flex items-center gap-2 bg-transparent border border-kinetic-gray text-kinetic-white px-4 py-3 rounded-lg font-bold hover:bg-kinetic-white/10 transition-colors uppercase text-sm"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
            )}
            <button 
              onClick={handleSave}
              disabled={loading}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-kinetic-neon text-kinetic-black px-8 py-3 rounded-lg font-bold hover:bg-kinetic-white transition-colors disabled:opacity-50 uppercase text-sm"
            >
              <Save className="w-4 h-4" />
              {loading ? 'SALVANDO...' : (editingId ? 'SALVAR ALTERAÇÕES' : 'SALVAR NOVO TREINO')}
            </button>
          </div>
        </header>

        {success && (
          <div className="mb-6 p-4 bg-kinetic-neon/10 border border-kinetic-neon text-kinetic-neon rounded-lg font-bold text-sm uppercase flex items-center gap-2">
            <CheckCircle className="w-5 h-5" /> {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg font-bold text-sm">
            ❌ {error}
          </div>
        )}

        <div className="mb-8">
          <label className="block text-sm font-bold text-kinetic-white mb-2 uppercase tracking-wide">Nome da Ficha de Treino</label>
          <input 
            type="text" 
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Upper Body A - Foco Supino" 
            className="w-full bg-kinetic-dark border border-kinetic-gray rounded-lg px-4 py-4 text-kinetic-white focus:outline-none focus:border-kinetic-neon font-medium text-lg" 
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-display font-bold text-kinetic-white border-b border-kinetic-gray pb-2 mb-6 uppercase">Exercícios Selecionados</h3>
          
          {exercises.map((exercise, index) => (
            <div key={exercise.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-kinetic-dark p-6 rounded-lg border border-kinetic-gray/50 group hover:border-kinetic-neon/30 transition-colors">
              <div className="cursor-move text-kinetic-white/30 hover:text-kinetic-neon hidden md:block mt-6">
                <GripVertical className="w-5 h-5" />
              </div>
              <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* Nome do Exercício */}
                <div className="col-span-1 md:col-span-5 flex flex-col">
                  <span className="text-kinetic-white/50 text-xs mb-1 uppercase font-bold">Exercício</span>
                  {!exercise.isCustom ? (
                    <div className="flex gap-2 items-center">
                    <select
                      value={exercise.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newExs = [...exercises];
                        if (val === 'CUSTOM_EXERCISE') {
                           newExs[index].isCustom = true;
                           newExs[index].name = 'CUSTOM_EXERCISE';
                        } else {
                           newExs[index].name = val;
                        }
                        setExercises(newExs);
                      }}
                      className="w-full bg-kinetic-black border border-kinetic-gray focus:border-kinetic-neon text-kinetic-white py-3 px-3 rounded-lg focus:outline-none font-medium"
                    >
                      <option value="">Selecione da Lista</option>
                      <option value="CUSTOM_EXERCISE" className="text-kinetic-neon font-bold">++ CRIAR EXERCÍCIO MANUAL ++</option>
                      
                      {coachCustomExercises.length > 0 && (
                        <optgroup label={`⚡ Exercícios de ${user?.user_metadata?.name?.split(' ')[0] || 'Treinador'}`} className="bg-kinetic-neon/20 text-kinetic-neon font-black">
                          {coachCustomExercises.map(exName => (
                            <option key={exName} value={exName} className="font-normal text-kinetic-white">{exName}</option>
                          ))}
                        </optgroup>
                      )}

                      {Object.entries(EXERCISE_GROUPS).map(([groupName, groupExercises]) => (
                        <optgroup key={groupName} label={groupName} className="bg-kinetic-gray text-kinetic-white font-bold">
                          {groupExercises.map(exName => (
                            <option key={exName} value={exName} className="font-normal">{exName}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {/* Botão excluir da lista pessoal — aparece apenas para exercícios do treinador */}
                    {coachCustomExercises.includes(exercise.name) && (
                      <button
                        onClick={() => deleteExerciseFromMyList(exercise.name)}
                        title="Remover da minha lista"
                        className="mt-0.5 flex items-center justify-center px-2 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/30 hover:border-red-500 text-xs font-bold whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  ) : (
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={exercise.customName}
                         onChange={(e) => {
                           const newExs = [...exercises];
                           newExs[index].customName = e.target.value;
                           setExercises(newExs);
                         }}
                         placeholder="Digite o nome do exercício..."
                         className="w-full bg-kinetic-black border border-kinetic-neon text-kinetic-neon font-medium py-3 px-3 rounded-lg focus:outline-none"
                         autoFocus
                       />
                       {/* Botão: Salvar na lista pessoal */}
                       <button
                         onClick={() => saveExerciseToMyList(exercise.id, exercise.customName)}
                         disabled={!exercise.customName?.trim() || savingToList === exercise.id}
                         title="Salvar este exercício na sua lista pessoal"
                         className="flex items-center justify-center bg-kinetic-neon text-kinetic-black px-3 rounded-lg font-black text-lg hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed min-w-[40px]"
                       >
                         {savingToList === exercise.id ? (
                           <span className="text-xs font-bold animate-pulse">...</span>
                         ) : (
                           <Plus className="w-4 h-4" />
                         )}
                       </button>
                       {/* Botão: Voltar para a lista */}
                       <button 
                         onClick={() => {
                           const newExs = [...exercises];
                           newExs[index].isCustom = false;
                           newExs[index].name = '';
                           newExs[index].customName = '';
                           setExercises(newExs);
                         }}
                         className="bg-kinetic-gray border border-transparent hover:border-kinetic-white/50 text-kinetic-white px-3 rounded-lg text-xs uppercase font-bold transition-all"
                         title="Voltar para a lista"
                       >
                         Lista
                       </button>
                    </div>
                  )}
                </div>

                {/* Séries */}
                <div className="col-span-1 md:col-span-2 flex flex-col">
                  <span className="text-kinetic-white/50 text-xs mb-1 uppercase font-bold text-center">Séries</span>
                  <input type="number" value={exercise.sets} onChange={(e) => {
                      const newExs = [...exercises];
                      newExs[index].sets = e.target.value;
                      setExercises(newExs);
                  }} placeholder="Ex: 3" min="1" className="w-full bg-transparent border-b border-kinetic-gray focus:border-kinetic-neon text-kinetic-white py-3 focus:outline-none text-center font-mono text-lg" />
                </div>

                {/* Reps */}
                <div className="col-span-1 md:col-span-2 flex flex-col">
                  <span className="text-kinetic-white/50 text-xs mb-1 uppercase font-bold text-center">Repetições</span>
                  <input type="text" value={exercise.reps} onChange={(e) => {
                      const newExs = [...exercises];
                      newExs[index].reps = e.target.value;
                      setExercises(newExs);
                  }} placeholder="Ex: 8-12" className="w-full bg-transparent border-b border-kinetic-gray focus:border-kinetic-neon text-kinetic-white py-3 focus:outline-none text-center font-mono text-lg" />
                </div>

                {/* Comentários */}
                <div className="col-span-1 md:col-span-3 flex flex-col">
                  <span className="text-kinetic-white/50 text-xs mb-1 uppercase font-bold text-center text-kinetic-neon">Comentários</span>
                  <input type="text" value={exercise.weight} onChange={(e) => {
                      const newExs = [...exercises];
                      newExs[index].weight = e.target.value;
                      setExercises(newExs);
                  }} placeholder="Obs para o aluno..." className="w-full bg-transparent border-b border-kinetic-neon/30 focus:border-kinetic-neon text-kinetic-neon py-3 focus:outline-none text-center font-sans text-sm" />
                </div>



              </div>
              <button 
                onClick={() => removeExercise(exercise.id)}
                className="text-kinetic-white/30 hover:text-red-500 transition-colors p-2 md:mt-6 mt-2 self-end bg-kinetic-black rounded hover:bg-red-500/10"
                title="Remover Exercício"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}

          <button 
            onClick={addExercise}
            className="w-full mt-4 py-5 border-2 border-dashed border-kinetic-gray/50 rounded-xl text-kinetic-white/50 hover:text-kinetic-neon hover:border-kinetic-neon transition-colors flex items-center justify-center gap-2 font-bold uppercase text-sm"
          >
            <Plus className="w-5 h-5" />
            Adicionar Novo Exercício
          </button>
        </div>
      </div>

      {/* LISTA DE TREINOS EXISTENTES */}
      <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-8">
        <h2 className="text-2xl font-display font-bold text-kinetic-white mb-6 uppercase flex items-center gap-2">
          <Dumbbell className="w-6 h-6 text-kinetic-neon" /> Catálogo de Treinos
        </h2>
        
        {existingWorkouts.length === 0 ? (
          <div className="text-kinetic-white/50 border border-dashed border-kinetic-gray p-8 rounded-xl text-center">
            Você ainda não construiu nenhuma ficha de treino.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {existingWorkouts.map(w => (
              <div key={w.id} className={`p-5 rounded-xl border transition-all ${editingId === w.id ? 'bg-kinetic-neon/10 border-kinetic-neon shadow-[0_0_15px_rgba(204,255,0,0.2)] scale-[1.02]' : 'bg-kinetic-dark border-kinetic-gray hover:border-kinetic-white/30'}`}>
                <h3 className="text-lg font-bold text-kinetic-white truncate mb-1" title={w.title}>{w.title}</h3>
                <p className="text-sm font-medium text-kinetic-white/50 mb-4">{w.exercises ? w.exercises.length : 0} exercícios na ficha</p>
                
                <div className="flex items-center gap-2 pt-4 border-t border-kinetic-gray/50">
                   <button 
                     onClick={() => handleEdit(w)}
                     className={`flex-1 flex items-center justify-center gap-1 py-2 rounded text-xs font-bold uppercase transition-colors ${editingId === w.id ? 'bg-kinetic-neon text-kinetic-black' : 'bg-kinetic-white/10 text-kinetic-white hover:bg-kinetic-white hover:text-kinetic-black'}`}
                   >
                     <Edit2 className="w-3 h-3" /> Editar
                   </button>
                   <button 
                     onClick={() => handleDeleteWorkout(w.id)}
                     className="px-3 py-2 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-kinetic-black transition-colors"
                     title="Excluir Treino"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION: MEUS ALUNOS - ATRIBUIÇÃO */}
      <div className="bg-kinetic-black border border-kinetic-gray rounded-xl p-8 mb-8">
        <h2 className="text-2xl font-display font-bold text-kinetic-white mb-6 uppercase flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-kinetic-neon" /> Atribuição de Fichas aos Alunos
        </h2>
        
        {athletes.length === 0 ? (
          <div className="text-kinetic-white/50 border border-dashed border-kinetic-gray p-8 rounded-xl text-center">
            Você ainda não possui alunos vinculados para atribuir treinos de musculação.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {athletes.map(athlete => (
              <div key={athlete.id} className="bg-kinetic-dark p-5 rounded-2xl border border-kinetic-gray flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-kinetic-neon/20 flex items-center justify-center text-kinetic-neon font-bold">
                    {athlete.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-kinetic-white">{athlete.name}</h4>
                    <p className="text-xs text-kinetic-white/50">Aluno desde {new Date(athlete.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setAssigningToAthlete(athlete)}
                  className="p-2 bg-kinetic-neon text-kinetic-black rounded-lg hover:bg-kinetic-white transition-all"
                  title="Atribuir Treinos Musculação"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE ATRIBUIÇÃO MÚLTIPLA */}
      {assigningToAthlete && (
        <AssignToStudentModal
          athlete={assigningToAthlete}
          coachId={user.id}
          workoutType="standard"
          onClose={(saved) => {
            if (saved) {
              setSuccess(`Fichas atribuídas para ${assigningToAthlete.name}!`);
              setTimeout(() => setSuccess(''), 3000);
            }
            setAssigningToAthlete(null);
          }}
        />
      )}

    </div>
  );
}
