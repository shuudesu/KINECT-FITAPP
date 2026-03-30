import React, { useState, useEffect } from 'react';
import { 
  Users, TrendingUp, Activity, Timer, Flame, Plus, Play, Pause, X, Save, Edit2, Trash2, Dumbbell, UserPlus
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import AssignToStudentModal from '../components/AssignToStudentModal';


const mockChartData = [
  { time: '06:00', burpees: 0, kcal: 0 },
  { time: '08:00', burpees: 0, kcal: 0 },
  { time: '10:00', burpees: 0, kcal: 0 },
  { time: '12:00', burpees: 0, kcal: 0 },
  { time: '14:00', burpees: 0, kcal: 0 },
  { time: '16:00', burpees: 0, kcal: 0 },
  { time: '18:00', burpees: 0, kcal: 0 },
];

const PREDEFINED_HIIT_EXERCISES = [
  'Burpees', 'Polichinelos', 'Alpinista (Mountain Climbers)', 
  'Corrida Estacionária', 'Agachamento com Salto', 'Avanço com Salto', 
  'Sprints (Tiros)', 'Prancha com Salto Térmico', 'Kettlebell Swing', 
  'Abdominal Remador', 'Sprawl', 'Corda Naval', 'Pular Corda', 'Thrusters'
];

const INTENSITIES = [
  { id: 'leve', emoji: '🟢', label: 'Leve (Z2)' },
  { id: 'moderado', emoji: '🟡', label: 'Moderado (Z3)' },
  { id: 'intenso', emoji: '🔴', label: 'Intenso (Z4)' },
  { id: 'maximo', emoji: '🔥', label: 'Máximo (Z5)' }
];

export default function CoachDashboard() {
  const { user } = useAuth();
  
  const [exercises, setExercises] = useState([]);
  const [customExercise, setCustomExercise] = useState({ name: '', duration: 40, rest: 20 });
  const [selectedIntensity, setSelectedIntensity] = useState('intenso');

  // Novos Estados (Builder & Assign)
  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [assigningToAthlete, setAssigningToAthlete] = useState(null);
  const [existingWorkouts, setExistingWorkouts] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [athletesDetails, setAthletesDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchWorkouts();
      fetchAthletes();
    }
  }, [user]);

  const fetchWorkouts = async () => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const hiitWorkouts = (data || []).filter(w => w.exercises && w.exercises[0] && w.exercises[0].is_hiit);
      setExistingWorkouts(hiitWorkouts);
    } catch (err) {
      console.error('Erro ao buscar treinos HIIT:', err);
    }
  };

  const fetchAthletes = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, created_at')
        .eq('coach_id', user.id);
      
      if (error) throw error;
      
      if (data) {
         const enhancedAthletes = await Promise.all(data.map(async (ath) => {
            const { data: assignments } = await supabase.from('workout_assignments').select('*, workouts(exercises)').eq('athlete_id', ath.id);
            const activeHiit = (assignments || []).filter(a => a.workouts?.exercises && a.workouts.exercises.length > 0 && a.workouts.exercises[0].is_hiit).length;

            return {
                ...ath,
                active_hiit: activeHiit
            }
         }));
         setAthletesDetails(enhancedAthletes);
      }
      
      setAthletes(data || []);
    } catch (err) {
      console.error('Erro ao buscar alunos:', err);
    }
  };


  const addExercise = (name) => {
    setExercises([...exercises, { id: Date.now(), name, duration: 45, rest: 15, intensity: selectedIntensity, imageUrl: '' }]);
  };

  const addCustomExercise = (e) => {
    e.preventDefault();
    if (!customExercise.name.trim()) return;
    setExercises([...exercises, { id: Date.now(), ...customExercise, intensity: selectedIntensity, imageUrl: '' }]);
    setCustomExercise({ name: '', duration: 40, rest: 20 });
  };

  const removeExercise = (id) => {
    setExercises(exercises.filter(ex => ex.id !== id));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Dê um nome ao treino HIIT.');
      return;
    }
    if (exercises.length === 0) {
      alert('Adicione blocos ao treino HIIT.');
      return;
    }

    setLoading(true);
    setSuccess('');
    
    try {
       // Injeta a marca is_hiit para diferenciar do musculação no BD
       const mappedExercises = exercises.map(ex => ({ ...ex, is_hiit: true }));
       
       if (editingId) {
         await supabase
          .from('workouts')
          .update({ title, exercises: mappedExercises })
          .eq('id', editingId)
          .eq('coach_id', user.id);
         setSuccess('Treino HIIT atualizado!');
       } else {
         await supabase
          .from('workouts')
          .insert([{ title, exercises: mappedExercises, coach_id: user.id }]);
         setSuccess('Treino HIIT salvo com sucesso!');
       }
       resetForm();
       fetchWorkouts();
       setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar o treino HIIT.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setExercises([]);
  };



  const handleEdit = (w) => {
    setEditingId(w.id);
    setTitle(w.title);
    setExercises(w.exercises || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleDeleteWorkout = async (id) => {
    if (!window.confirm("ATENÇÃO: Deseja realmente excluir este treino HIIT permanentemente?")) return;
    try {
      const { error: assignError } = await supabase.from('workout_assignments').delete().eq('workout_id', id);
      if (assignError) console.warn(assignError);
      
      const { error } = await supabase.from('workouts').delete().eq('id', id).eq('coach_id', user.id);
      if (error) throw error;
      
      fetchWorkouts();
      if (editingId === id) resetForm();
    } catch(err) {
      alert("Erro ao excluir o treino HIIT.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0714] text-[#fcf4ff] font-sans pb-24">
      {/* HEADER / EDITORIAL */}
      <div className="pt-12 px-6 pb-8 bg-gradient-to-br from-[#1c0d33] to-[#0d0714]">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 uppercase flex items-center gap-3">
          {editingId ? <><Edit2 className="w-8 h-8 text-[#6437db]" /> Editando HIIT</> : 'VOLT_HIIT'}
        </h1>
        <p className="text-[#baa4d3] text-lg">Construtor de Treinos Intervalados</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {success && (
          <div className="mb-6 bg-[#6437db]/20 border border-[#6437db] text-white p-4 rounded-xl font-bold">
            🔥 {success}
          </div>
        )}

        {/* INDIVIDUAL KPI BOARD (SUBSTITUI OS DADOS MOCKADOS GLOBAIS) */}
        <div className="mb-8">
          <h2 className="text-[#baa4d3] text-sm font-semibold uppercase tracking-wider mb-4 flex items-center">
            <Activity className="w-4 h-4 mr-2" /> Monitoramento Individual - HIIT
          </h2>
          {athletesDetails.length === 0 ? (
            <div className="bg-[#1a0f2e] border border-[#baa4d3]/10 p-4 rounded-xl text-[#826f9a] text-sm">
              Carregando dados dos alunos ou nenhum aluno matriculado.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               {athletesDetails.map(ath => (
                  <div key={'kpi-'+ath.id} className="bg-[#1a0f2e] rounded-2xl p-5 border border-[#baa4d3]/10 transition-transform hover:scale-[1.02]">
                     <div className="flex items-center gap-3 mb-4">
                       <div className="w-10 h-10 rounded-full bg-[#6437db] text-white flex items-center justify-center font-bold">
                         {ath.name.charAt(0)}
                       </div>
                       <div className="truncate">
                         <h3 className="text-white font-bold truncate">{ath.name}</h3>
                         <p className="text-xs text-[#baa4d3]">Aluno Ativo</p>
                       </div>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#150a25] p-3 rounded-xl border border-[#341d5e] text-center">
                           <span className="block text-2xl font-bold text-[#6437db]">{ath.active_hiit}</span>
                           <span className="text-[10px] text-[#baa4d3] uppercase font-bold tracking-wider">Fichas HIIT</span>
                        </div>
                        <div className="bg-[#150a25] p-3 rounded-xl border border-[#341d5e] text-center">
                           <span className="block text-2xl font-bold text-[#f74b6d]">--</span>
                           <span className="text-[10px] text-[#baa4d3] uppercase font-bold tracking-wider">Kcal Queimada</span>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: CATÁLOGO DE TREINOS HIIT */}
          <div className="lg:col-span-1 space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center text-[#fcf4ff]">
                <Dumbbell className="mr-2 text-[#6437db]" /> Catálogo HIIT
              </h2>
              <div className="space-y-3">
                {existingWorkouts.length === 0 ? (
                  <div className="bg-[#150a25] p-6 rounded-xl border border-[#baa4d3]/10 text-center">
                     <p className="text-[#826f9a] text-sm">Nenhum treino HIIT criado ainda.</p>
                  </div>
                ) : (
                  existingWorkouts.map(w => (
                    <div key={w.id} className={`bg-[#150a25] p-5 rounded-xl border transition-all ${editingId === w.id ? 'border-[#6437db] shadow-[0_0_15px_rgba(100,55,219,0.3)]' : 'border-[#341d5e] hover:border-[#baa4d3]'}`}>
                      <h3 className="font-bold text-white mb-1 truncate" title={w.title}>{w.title}</h3>
                      <p className="text-xs text-[#baa4d3] mb-4">{w.exercises?.length || 0} blocos</p>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <button 
                          onClick={() => handleEdit(w)}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-bold uppercase transition-colors ${editingId === w.id ? 'bg-[#6437db] text-white' : 'bg-[#1a0f2e] text-[#baa4d3] hover:bg-[#341d5e]'}`}
                        >
                          <Edit2 className="w-3 h-3" /> Editar
                        </button>
                        <button 
                          onClick={() => handleDeleteWorkout(w.id)}
                          className="px-2.5 py-1.5 bg-[#b41340]/10 text-[#b41340] rounded hover:bg-[#b41340] hover:text-white transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* MIDDLE / RIGHT COLUMN: BUILDER & EVOLUTION */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* WORKOUT BUILDER */}
            <section className="bg-[#1a0f2e] p-6 rounded-3xl border border-[#baa4d3]/10 relative overflow-hidden">
              {editingId && (
                <div className="absolute top-0 left-0 w-full h-1 bg-[#6437db] animate-pulse"></div>
              )}
              
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center">
                  <Timer className="mr-2 text-[#6437db]" /> Configurar Treino HIIT
                </h2>
                {editingId && (
                  <button onClick={resetForm} className="text-[#826f9a] hover:text-white text-sm uppercase font-bold px-3 py-1 border border-[#341d5e] rounded-lg">
                    Cancelar Edição
                  </button>
                )}
              </div>

              {/* NOME DO TREINO */}
              <div className="mb-6">
                <label className="text-[#baa4d3] text-sm font-semibold uppercase tracking-wider block mb-2">Nome do Treino</label>
                <input 
                  type="text" 
                  placeholder="Ex: Queima Total Tabata"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-[#150a25] border border-[#341d5e] rounded-xl px-4 py-3 focus:outline-none focus:border-[#6437db] text-white font-bold text-lg"
                />
              </div>

              {/* INTENSITY SELECTOR & LEGEND */}
              <div className="mb-6 pb-6 border-b border-[#341d5e]">
                <h3 className="text-[#baa4d3] text-sm font-semibold uppercase tracking-wider mb-3">Intensidade Alvo (Define para todos os próximos blocos)</h3>
                <div className="flex flex-wrap gap-3">
                  {INTENSITIES.map(intensity => (
                    <button
                      key={intensity.id}
                      onClick={() => setSelectedIntensity(intensity.id)}
                      className={`flex items-center px-4 py-2 rounded-xl border transition-all ${
                        selectedIntensity === intensity.id
                          ? 'bg-[#341d5e] border-[#6437db] shadow-[0_0_10px_rgba(100,55,219,0.4)]'
                          : 'bg-[#150a25] border-[#341d5e] hover:bg-[#241541]'
                      }`}
                    >
                      <span className="text-xl mr-2">{intensity.emoji}</span>
                      <span className="text-sm font-medium text-[#fcf4ff]">{intensity.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#826f9a] mt-3">
                  <span className="font-semibold text-[#baa4d3]">Dica:</span> Selecione a intensidade desejada antes de adicionar um exercício, seja pela lista rápida ou pelo formulário manual.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* PRE-DEFINED LIST */}
                <div>
                  <h3 className="text-[#baa4d3] text-sm font-semibold uppercase tracking-wider mb-3">Exercícios Mais Usados</h3>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_HIIT_EXERCISES.map(ex => (
                      <button 
                        key={ex}
                        onClick={() => addExercise(ex)}
                        className="bg-[#241541] hover:bg-[#341d5e] text-[#e1c7ff] text-sm px-3 py-1.5 rounded-full transition-colors border border-[#6437db]/30 flex items-center"
                      >
                        <Plus className="w-3 h-3 mr-1" /> {ex}
                      </button>
                    ))}
                  </div>
                </div>

                {/* MANUAL ENTRY */}
                <div>
                  <h3 className="text-[#baa4d3] text-sm font-semibold uppercase tracking-wider mb-3">Adicionar Personalizado</h3>
                  <form onSubmit={addCustomExercise} className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Nome do Exercício"
                      value={customExercise.name}
                      onChange={(e) => setCustomExercise({...customExercise, name: e.target.value})}
                      className="w-full bg-[#150a25] border border-[#341d5e] rounded-xl px-4 py-2 focus:outline-none focus:border-[#6437db] text-[#fcf4ff]"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-[#826f9a] block mb-1">Ação (s)</label>
                        <input 
                          type="number" 
                          value={customExercise.duration}
                          onChange={(e) => setCustomExercise({...customExercise, duration: Number(e.target.value)})}
                          className="w-full bg-[#150a25] border border-[#341d5e] rounded-xl px-4 py-2 focus:outline-none focus:border-[#6437db] text-[#fcf4ff]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-[#826f9a] block mb-1">Pausa (s)</label>
                        <input 
                          type="number" 
                          value={customExercise.rest}
                          onChange={(e) => setCustomExercise({...customExercise, rest: Number(e.target.value)})}
                          className="w-full bg-[#150a25] border border-[#341d5e] rounded-xl px-4 py-2 focus:outline-none focus:border-[#6437db] text-[#fcf4ff]"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-[#6437db] hover:bg-[#5826cf] text-white py-2 rounded-xl border border-[#a98fff]/20 transition-all shadow-[0_0_15px_rgba(100,55,219,0.3)]"
                    >
                      Adicionar à Série
                    </button>
                  </form>
                </div>
              </div>

              {/* CURRENT SELECTION */}
              <div className="mt-8">
                <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                  <span>Série Programada</span>
                  <span className="text-[#baa4d3] text-sm">{exercises.length} blocos</span>
                </h3>
                <div className="space-y-2">
                  {exercises.length === 0 ? (
                    <p className="text-[#826f9a] text-center py-4 bg-[#150a25] rounded-xl">Nenhum exercício configurado.</p>
                  ) : (
                    exercises.map((ex, idx) => {
                      const exIntensity = INTENSITIES.find(i => i.id === ex.intensity) || INTENSITIES[2];
                      return (
                        <div key={ex.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#150a25] p-3 rounded-xl border border-[#341d5e] gap-4">
                          <div className="flex items-center w-full sm:w-auto">
                            <span className="w-8 h-8 rounded-full bg-[#241541] text-[#a98fff] flex items-center justify-center font-bold mr-3 text-sm shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex flex-col">
                              <div className="flex items-center">
                                <span className="text-lg mr-2" title={exIntensity.label}>{exIntensity.emoji}</span>
                                <span className="font-semibold text-[#fcf4ff]">{ex.name}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* IA Generator Button / Image Preview (HIIT) */}
                          <div className="flex-1 w-full sm:w-auto flex justify-center sm:justify-end">
                            {ex.imageUrl ? (
                               <div className="relative group w-24 h-16 rounded overflow-hidden border border-[#341d5e] hover:border-[#6437db]">
                                 <img src={ex.imageUrl} alt={ex.name} className="w-full h-full object-cover" />
                                 <button disabled={generatingImageId === ex.id} onClick={() => handleGenerateImage(idx)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white font-bold text-xs gap-1">
                                   {generatingImageId === ex.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                 </button>
                               </div>
                            ) : (
                               <button 
                                 onClick={() => handleGenerateImage(idx)}
                                 disabled={generatingImageId === ex.id}
                                 className="text-xs bg-[#241541] text-[#e1c7ff] border border-[#a98fff]/30 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-[#6437db] hover:text-white transition-all disabled:opacity-50"
                                 title="Gerar e salvar ilustração anatômica"
                               >
                                 {generatingImageId === ex.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4 text-[#a98fff]"/>}
                                 {generatingImageId === ex.id ? 'Gerando...' : 'IA 3D'}
                               </button>
                            )}
                          </div>

                          <div className="flex justify-between w-full sm:w-auto items-center gap-4 text-sm text-[#baa4d3] border-t sm:border-t-0 border-[#341d5e] pt-2 sm:pt-0 mt-2 sm:mt-0">
                            <span className="bg-[#1a0f2e] px-2 py-1 rounded-md">
                              <Flame className="w-3 h-3 inline text-[#f74b6d] mr-1" />
                              {ex.duration}s
                            </span>
                            <span className="bg-[#1a0f2e] px-2 py-1 rounded-md">
                              <Timer className="w-3 h-3 inline text-[#826f9a] mr-1" />
                              {ex.rest}s
                            </span>
                            <button onClick={() => removeExercise(ex.id)} className="text-[#b41340] hover:text-[#f74b6d] transition-colors p-1">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                <button 
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full mt-6 bg-gradient-to-r from-[#6437db] to-[#9c3660] text-white font-bold py-4 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(156,54,96,0.3)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Save className="w-5 h-5 mr-3" /> 
                  {loading ? 'Salvando...' : (editingId ? 'Salvar Alterações do Treino' : 'Salvar Novo Treino HIIT')}
                </button>
              </div>
            </section>

            {/* REMOVED: GRAPH EVOLUÇÃO (MOCKADO) -> NOW REPLACED BY RADAR INDIVIDUAL AT TOP */}

          </div>
        </div>

        {/* SECTION: MEUS ALUNOS - ATRIBUIÇÃO */}
        <section className="mt-8 bg-[#1a0f2e] p-6 rounded-3xl border border-[#baa4d3]/10">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <UserPlus className="mr-2 text-[#6437db]" /> Atribuição de Treinos HIIT
          </h2>
          {athletes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#826f9a]">Você ainda não possui alunos vinculados para atribuir treinos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {athletes.map(athlete => (
                <div key={athlete.id} className="bg-[#150a25] p-5 rounded-2xl border border-[#341d5e] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#6437db]/20 flex items-center justify-center text-[#baa4d3] font-bold">
                      {athlete.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#fcf4ff]">{athlete.name}</h4>
                      <p className="text-xs text-[#826f9a]">Aluno desde {new Date(athlete.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setAssigningToAthlete(athlete)}
                    className="p-2 bg-[#6437db] text-white rounded-lg hover:bg-[#5826cf] transition-all"
                    title="Atribuir Treinos HIIT"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* MODAL DE ATRIBUIÇÃO MÚLTIPLA */}
      {assigningToAthlete && (
        <AssignToStudentModal
          athlete={assigningToAthlete}
          coachId={user.id}
          workoutType="hiit"
          onClose={(saved) => {
            if (saved) {
              setSuccess(`Treinos HIIT atribuídos para ${assigningToAthlete.name}!`);
              setTimeout(() => setSuccess(''), 3000);
            }
            setAssigningToAthlete(null);
          }}
        />
      )}

    </div>
  );
}
