import React, { useState, useEffect } from 'react';
import { X, Dumbbell, Check, Save } from 'lucide-react';
import { supabase } from '../supabase';

export default function AssignToStudentModal({ athlete, coachId, workoutType, onClose }) {
  const [workouts, setWorkouts] = useState([]);
  const [assignments, setAssignments] = useState(new Set());
  const [initialAssignments, setInitialAssignments] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [athlete, coachId, workoutType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Buscar treinos do treinador
      const { data: workoutsData, error: wError } = await supabase
        .from('workouts')
        .select('id, title, exercises')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false });
      
      if (wError) throw wError;

      // Filtrar pelo tipo (hiit ou standard)
      const filteredWorkouts = (workoutsData || []).filter(w => {
        const isHiit = w.exercises && w.exercises[0] && w.exercises[0].is_hiit;
        if (workoutType === 'hiit') return isHiit;
        return !isHiit; // standard musculação
      });

      // Buscar atribuições desse aluno para os treinos filtrados
      // Primeiro vamos extrair os IDs dos treinos filtrados para buscar apenas eles
      const workoutIds = filteredWorkouts.map(w => w.id);
      
      let assignData = [];
      if (workoutIds.length > 0) {
          const { data, error: asnError } = await supabase
            .from('workout_assignments')
            .select('workout_id')
            .eq('athlete_id', athlete.id)
            .in('workout_id', workoutIds);
            
          if (asnError) throw asnError;
          assignData = data || [];
      }

      const assignedSet = new Set(assignData.map(a => a.workout_id));
      
      setWorkouts(filteredWorkouts);
      setAssignments(assignedSet);
      setInitialAssignments(new Set(assignedSet));
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar os treinos.');
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkout = (e, workoutId) => {
    e.preventDefault();
    const newAssign = new Set(assignments);
    if (newAssign.has(workoutId)) {
      newAssign.delete(workoutId);
    } else {
      newAssign.add(workoutId);
    }
    setAssignments(newAssign);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const toDelete = [...initialAssignments].filter(id => !assignments.has(id));
      const toAdd = [...assignments].filter(id => !initialAssignments.has(id));

      if (toDelete.length > 0) {
        await supabase
          .from('workout_assignments')
          .delete()
          .eq('athlete_id', athlete.id)
          .in('workout_id', toDelete);
      }

      if (toAdd.length > 0) {
        const insertData = toAdd.map(workout_id => ({
          workout_id: workout_id,
          athlete_id: athlete.id
        }));
        await supabase
          .from('workout_assignments')
          .insert(insertData);
      }

      onClose(true);
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar as atribuições.');
      setSaving(false);
    }
  };

  // Cores dinâmicas baseadas no app
  const isHiit = workoutType === 'hiit';
  const theme = {
    bg: isHiit ? 'bg-[#150a25]' : 'bg-kinetic-black',
    border: isHiit ? 'border-[#baa4d3]/20' : 'border-kinetic-gray',
    headerBg: isHiit ? 'bg-[#1a0f2e]' : 'bg-kinetic-dark',
    headerBorder: isHiit ? 'border-[#341d5e]' : 'border-kinetic-gray',
    textHighlight: isHiit ? 'text-[#6437db]' : 'text-kinetic-neon',
    textMain: isHiit ? 'text-[#fcf4ff]' : 'text-kinetic-white',
    textSub: isHiit ? 'text-[#baa4d3]' : 'text-kinetic-white/50',
    itemBg: isHiit ? 'bg-[#1a0f2e]' : 'bg-kinetic-dark',
    itemBorder: isHiit ? 'border-[#341d5e]' : 'border-kinetic-gray',
    itemSelectedBg: isHiit ? 'bg-[#341d5e]' : 'bg-kinetic-neon/10',
    itemSelectedBorder: isHiit ? 'border-[#6437db]' : 'border-kinetic-neon',
    iconCheckColor: isHiit ? 'bg-[#6437db] border-[#6437db] text-white' : 'bg-kinetic-neon border-kinetic-neon text-kinetic-black',
    btnPrimary: isHiit ? 'bg-[#6437db] hover:bg-[#5826cf] text-white shadow-[0_4px_20px_rgba(100,55,219,0.4)]' : 'bg-kinetic-neon hover:bg-kinetic-white text-kinetic-black',
    btnSecondary: isHiit ? 'border-[#341d5e] text-[#baa4d3] hover:text-white hover:bg-[#241541]' : 'border-kinetic-gray text-kinetic-white/50 hover:text-kinetic-white hover:bg-kinetic-white/10'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className={`${theme.bg} border ${theme.border} w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}>
        
        <div className={`p-5 border-b ${theme.headerBorder} flex items-center justify-between ${theme.headerBg}`}>
          <h2 className={`text-xl font-bold flex items-center ${theme.textMain}`}>
            <Dumbbell className={`mr-3 ${theme.textHighlight}`} /> Treinos para {athlete.name.split(' ')[0]}
          </h2>
          <button onClick={() => onClose()} className={`${theme.textSub} hover:${theme.textMain} transition-colors`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`p-6 overflow-y-auto flex-1 font-sans ${theme.textMain}`}>
          {error && <div className="mb-4 text-sm text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}
          
          {loading ? (
            <div className={`text-center ${theme.textSub} py-8`}>Carregando treinos...</div>
          ) : workouts.length === 0 ? (
            <div className={`text-center ${theme.textSub} py-8`}>
              Você não possui nenhum treino {isHiit ? 'HIIT' : 'de musculação'} salvo. Crie um treino primeiro.
            </div>
          ) : (
            <div className="space-y-2">
              <p className={`text-sm ${theme.textSub} mb-4`}>Quais fichas devem ficar disponíveis para este aluno?</p>
              {workouts.map(w => {
                const isSelected = assignments.has(w.id);
                return (
                  <button
                    key={w.id}
                    onClick={(e) => toggleWorkout(e, w.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      isSelected 
                        ? `${theme.itemSelectedBg} ${theme.itemSelectedBorder}` 
                        : `${theme.itemBg} ${theme.itemBorder}`
                    }`}
                  >
                    <div>
                      <div className={`font-semibold ${theme.textMain}`}>{w.title}</div>
                      <div className={`text-xs ${theme.textSub}`}>{w.exercises ? w.exercises.length : 0} blocos</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                      isSelected ? theme.iconCheckColor : `border-transparent text-transparent`
                    }`}>
                      <Check className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={`p-5 border-t ${theme.headerBorder} ${theme.headerBg} flex gap-3`}>
          <button 
            onClick={() => onClose()}
            className={`flex-1 py-3 rounded-xl font-bold border transition-colors ${theme.btnSecondary}`}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={loading || saving}
            className={`flex-1 py-3 rounded-xl font-bold transition-colors flex items-center justify-center uppercase text-sm ${theme.btnPrimary} disabled:opacity-50`}
          >
            {saving ? 'Salvando...' : <><Save className="w-4 h-4 mr-2" /> Salvar</>}
          </button>
        </div>

      </div>
    </div>
  );
}
