import React, { useState, useEffect } from 'react';
import { X, Users, Check, Save } from 'lucide-react';
import { supabase } from '../supabase';

export default function AssignWorkoutModal({ workoutId, coachId, onClose }) {
  const [athletes, setAthletes] = useState([]);
  const [assignments, setAssignments] = useState(new Set());
  const [initialAssignments, setInitialAssignments] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [workoutId, coachId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      // Buscar atletas do treinador
      const { data: athletesData, error: athError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('coach_id', coachId)
        .eq('role', 'athlete');
      
      if (athError) throw athError;
      
      // Buscar quem ja tem esse treino
      const { data: assignData, error: asnError } = await supabase
        .from('workout_assignments')
        .select('athlete_id')
        .eq('workout_id', workoutId);
      
      if (asnError) throw asnError;

      const assignedSet = new Set(assignData.map(a => a.athlete_id));
      
      setAthletes(athletesData || []);
      setAssignments(assignedSet);
      setInitialAssignments(new Set(assignedSet));
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar os dados de atribuição.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAthlete = (e, athleteId) => {
    e.preventDefault(); // Evita scroll do form ou algo assim
    const newAssign = new Set(assignments);
    if (newAssign.has(athleteId)) {
      newAssign.delete(athleteId);
    } else {
      newAssign.add(athleteId);
    }
    setAssignments(newAssign);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Diferenças para deletar
      const toDelete = [...initialAssignments].filter(id => !assignments.has(id));
      // Diferenças para adicionar
      const toAdd = [...assignments].filter(id => !initialAssignments.has(id));

      if (toDelete.length > 0) {
        await supabase
          .from('workout_assignments')
          .delete()
          .eq('workout_id', workoutId)
          .in('athlete_id', toDelete);
      }

      if (toAdd.length > 0) {
        const insertData = toAdd.map(athlete_id => ({
          workout_id: workoutId,
          athlete_id: athlete_id
        }));
        await supabase
          .from('workout_assignments')
          .insert(insertData);
      }

      onClose(true); // Retorna true para dar feedback de sucesso
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar as atribuições.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#150a25] border border-[#baa4d3]/20 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-[#341d5e] flex items-center justify-between bg-[#1a0f2e]">
          <h2 className="text-xl font-bold flex items-center text-[#fcf4ff]">
            <Users className="mr-3 text-[#6437db]" /> Atribuir a Alunos
          </h2>
          <button onClick={() => onClose()} className="text-[#826f9a] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 font-sans text-[#fcf4ff] bg-[#0d0714]">
          {error && <div className="mb-4 text-sm text-[#f74b6d] bg-[#f74b6d]/10 p-3 rounded-lg border border-[#f74b6d]/20">{error}</div>}
          
          {loading ? (
            <div className="text-center text-[#826f9a] py-8">Carregando alunos...</div>
          ) : athletes.length === 0 ? (
            <div className="text-center text-[#826f9a] py-8">
              Você ainda não tem alunos vinculados à sua conta.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-[#baa4d3] mb-4">Selecione os alunos que devem realizar este treino:</p>
              {athletes.map(ath => {
                const isSelected = assignments.has(ath.id);
                return (
                  <button
                    key={ath.id}
                    onClick={(e) => toggleAthlete(e, ath.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      isSelected 
                        ? 'bg-[#341d5e] border-[#6437db] shadow-[0_0_10px_rgba(100,55,219,0.3)]' 
                        : 'bg-[#1a0f2e] border-[#341d5e] hover:border-[#826f9a]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-white">{ath.name}</div>
                      <div className="text-xs text-[#baa4d3]">{ath.email}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                      isSelected ? 'bg-[#6437db] border-[#6437db] text-white' : 'border-[#826f9a] text-transparent'
                    }`}>
                      <Check className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[#341d5e] bg-[#1a0f2e] flex gap-3">
          <button 
            onClick={() => onClose()}
            className="flex-1 py-3 rounded-xl font-bold border border-[#341d5e] text-[#baa4d3] hover:text-white hover:bg-[#241541] transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={loading || saving}
            className="flex-1 py-3 rounded-xl font-bold bg-[#6437db] text-white hover:bg-[#5826cf] disabled:opacity-50 transition-colors flex items-center justify-center shadow-[0_4px_20px_rgba(100,55,219,0.4)]"
          >
            {saving ? 'Salvando...' : <><Save className="w-4 h-4 mr-2" /> Salvar</>}
          </button>
        </div>

      </div>
    </div>
  );
}
