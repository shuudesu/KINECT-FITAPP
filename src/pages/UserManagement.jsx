import React, { useState, useEffect } from 'react';
import { Trash2, Copy, CheckCircle, PlusCircle, Link as LinkIcon, Users, Dumbbell, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';

export default function UserManagement() {
  const { user } = useAuth();
  const [athletes, setAthletes] = useState([]);
  const [invites, setInvites] = useState([]);
  const [coachWorkouts, setCoachWorkouts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [expandedAthleteId, setExpandedAthleteId] = useState(null);
  
  // Rascunho das seleções antes de salvar
  const [draftAssignments, setDraftAssignments] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: athletesData } = await supabase
          .from('profiles')
          .select('*')
          .eq('coach_id', user.id);
        
        const { data: invitesData } = await supabase
          .from('invites')
          .select('*')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false });

        const { data: workoutsData } = await supabase
          .from('workouts')
          .select('*')
          .eq('coach_id', user.id)
          .order('title', { ascending: true });

        const athleteIds = athletesData ? athletesData.map(a => a.id) : [];
        let assignmentsData = [];
        if (athleteIds.length > 0) {
          const { data: allocs } = await supabase
            .from('workout_assignments')
            .select('*')
            .in('athlete_id', athleteIds);
          assignmentsData = allocs || [];
        }

        setAthletes(athletesData || []);
        setInvites(invitesData || []);
        setCoachWorkouts(workoutsData || []);
        setAssignments(assignmentsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.id]);

  const handleGenerateInvite = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase
        .from('invites')
        .insert([{ coach_id: user.id }])
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        setInvites([data, ...invites]);
      }
    } catch (err) {
      console.error('Erro ao gerar link:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = (id) => {
    const link = `${window.location.origin}/login?invite=${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleDeleteInvite = async (id) => {
    try {
      await supabase.from('invites').delete().eq('id', id);
      setInvites(invites.filter(inv => inv.id !== id));
    } catch (err) {
      console.error('Erro ao deletar convite:', err);
    }
  };

  const handleExpandAthlete = (athleteId) => {
    if (expandedAthleteId === athleteId) {
      setExpandedAthleteId(null);
    } else {
      setExpandedAthleteId(athleteId);
      setDraftAssignments(assignments.filter(a => a.athlete_id === athleteId).map(a => a.workout_id));
    }
  };

  const toggleDraft = (workoutId) => {
    if (draftAssignments.includes(workoutId)) {
      setDraftAssignments(draftAssignments.filter(id => id !== workoutId));
    } else {
      setDraftAssignments([...draftAssignments, workoutId]);
    }
  };

  const saveAssignments = async (athleteId) => {
    setSavingAssignments(true);
    try {
      const current = assignments.filter(a => a.athlete_id === athleteId).map(a => a.workout_id);
      const toAdd = draftAssignments.filter(id => !current.includes(id));
      const toRemove = current.filter(id => !draftAssignments.includes(id));
      
      if (toRemove.length > 0) {
        await supabase.from('workout_assignments').delete().eq('athlete_id', athleteId).in('workout_id', toRemove);
      }
      
      if (toAdd.length > 0) {
        const inserts = toAdd.map(wId => ({ athlete_id: athleteId, workout_id: wId }));
        await supabase.from('workout_assignments').insert(inserts);
      }
      
      let updated = [...assignments];
      updated = updated.filter(a => !(a.athlete_id === athleteId && toRemove.includes(a.workout_id)));
      for (const wId of toAdd) {
        updated.push({ id: Date.now() + Math.random(), athlete_id: athleteId, workout_id: wId });
      }
      
      setAssignments(updated);
      setExpandedAthleteId(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar treinos.');
    } finally {
      setSavingAssignments(false);
    }
  };

  const handleRemoveAthlete = async (id) => {
     if (!window.confirm("ATENÇÃO: Deseja realmente remover este aluno? A conta dele será sumariamente deletada do aplicativo.")) return;
     try {
       const { error } = await supabase.from('profiles').delete().eq('id', id).eq('coach_id', user.id);
       if (error) {
          alert("Ocorreu um erro. Certifique-se de avisar ao suporte (verifique seu supabase_schema.sql se a regra de delete está aplicada).");
          console.error(error);
          return;
       }
       setAthletes(athletes.filter(a => a.id !== id));
     } catch (err) {
       console.error(err);
     }
  };

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-kinetic-white uppercase tracking-wide">
            Gestão de Alunos
          </h1>
          <p className="text-kinetic-white/60 mt-1">Gerencie seus atletas, convites e atribua treinos.</p>
        </div>
      </header>

      <div className="bg-kinetic-black border border-kinetic-neon/30 rounded-xl p-4 md:p-6 mb-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 md:gap-4 mb-5 md:mb-6">
          <div>
            <h2 className="text-lg md:text-xl font-display font-bold text-kinetic-white flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-kinetic-neon" /> Gerador de Convites
            </h2>
            <p className="text-kinetic-white/60 text-xs md:text-sm mt-1">
              Cada link gerado só pode ser usado uma vez por um único aluno.
            </p>
          </div>
          <button
            onClick={handleGenerateInvite}
            disabled={generating}
            className="flex items-center justify-center gap-2 bg-kinetic-neon text-kinetic-black font-bold h-[44px] px-5 md:px-6 rounded-lg hover:bg-kinetic-white transition-colors uppercase whitespace-nowrap disabled:opacity-50 text-sm w-full sm:w-auto"
          >
            <PlusCircle className="w-5 h-5" />
            {generating ? 'GERANDO...' : 'GERAR NOVO LINK'}
          </button>
        </div>

        {invites.length === 0 ? (
           <div className="text-kinetic-white/40 text-sm py-4 border-t border-kinetic-gray/50">
             Nenhum link gerado ainda. Clique no botão acima para criar o seu primeiro convite.
           </div>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => (
              <div key={invite.id} className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center bg-kinetic-dark border border-kinetic-gray rounded-lg p-3">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/login?invite=${invite.id}`}
                  className={`flex-1 bg-transparent border-none text-xs sm:text-sm font-mono focus:outline-none w-full min-w-0 truncate ${invite.status === 'accepted' ? 'line-through text-kinetic-white/30' : 'text-kinetic-neon'}`}
                />

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded border ${invite.status === 'accepted' ? 'border-green-500/20 text-green-500 bg-green-500/10' : 'border-yellow-500/20 text-yellow-500 bg-yellow-500/10'}`}>
                    {invite.status === 'accepted' ? 'USADO' : 'PENDENTE'}
                  </span>

                  {invite.status === 'pending' && (
                    <button
                      onClick={() => handleCopyLink(invite.id)}
                      className="flex items-center justify-center gap-1 bg-kinetic-white/10 text-kinetic-white h-[40px] px-3 rounded hover:bg-kinetic-white/20 transition-colors uppercase text-xs font-bold"
                    >
                      {copiedId === invite.id ? <CheckCircle className="w-4 h-4 text-kinetic-neon" /> : <Copy className="w-4 h-4" />}
                      COPIAR
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteInvite(invite.id)}
                    className="p-2.5 text-red-500/50 hover:text-red-500 transition-colors bg-kinetic-white/5 rounded h-[40px] w-[40px] flex items-center justify-center"
                    title="Excluir Convite"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center text-kinetic-white">Carregando alunos...</div>
      ) : (
        <div className="bg-kinetic-black border border-kinetic-gray rounded-xl overflow-hidden">
          <div className="p-6 border-b border-kinetic-gray flex items-center gap-2">
            <Users className="w-5 h-5 text-kinetic-neon" />
            <h2 className="text-xl font-display font-bold text-kinetic-white">Alunos Vinculados e Atribuições</h2>
          </div>
          
          {athletes.length === 0 ? (
            <div className="p-8 text-center text-kinetic-white/50">
              Você ainda não tem alunos. Gere um link e envie para eles se cadastrarem!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-kinetic-dark border-b border-kinetic-gray">
                  <tr>
                    <th className="px-6 py-4 text-sm font-medium text-kinetic-white/70 uppercase">Nome / Usuário</th>
                    <th className="px-6 py-4 text-sm font-medium text-kinetic-white/70 uppercase text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kinetic-gray/50">
                  {athletes.map((athlete) => (
                    <React.Fragment key={athlete.id}>
                      <tr className="hover:bg-kinetic-dark/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-kinetic-gray flex items-center justify-center text-kinetic-white font-bold uppercase shrink-0">
                              {(athlete.name || athlete.email || 'U').charAt(0)}
                            </div>
                            <div className="flex flex-col">
                               <span className="font-bold text-kinetic-white">{athlete.name || 'Sem Nome'}</span>
                               <span className="text-kinetic-white/50 text-xs">{athlete.username}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button 
                              onClick={() => handleExpandAthlete(athlete.id)} 
                              className={`flex items-center gap-2 text-xs font-bold uppercase transition-colors px-4 py-2 rounded border ${expandedAthleteId === athlete.id ? 'bg-kinetic-neon text-kinetic-black border-kinetic-neon' : 'bg-transparent text-kinetic-neon border-kinetic-neon hover:bg-kinetic-neon/10'}`}
                            >
                              <Dumbbell className="w-4 h-4" />
                              Treinos
                            </button>
                            <button 
                              onClick={() => handleRemoveAthlete(athlete.id)} 
                              className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors" 
                              title="Remover Atleta do App"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {expandedAthleteId === athlete.id && (
                        <tr>
                          <td colSpan="2" className="bg-black/40 border-t-0 p-6">
                             <h4 className="text-sm font-display font-bold text-kinetic-white uppercase mb-4 opacity-70">
                               Atribuindo treinos para {athlete.name}:
                             </h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                {coachWorkouts.length === 0 ? (
                                   <span className="text-kinetic-white/40 text-sm col-span-full">Você ainda não criou nenhum treino no Workout Builder. Volte lá e crie um treino primeiro!</span>
                                ) : (
                                   coachWorkouts.map(w => {
                                      const isDrafted = draftAssignments.includes(w.id);
                                      return (
                                        <div 
                                          key={w.id} 
                                          onClick={() => toggleDraft(w.id)} 
                                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer select-none transition-all ${isDrafted ? 'border-kinetic-neon bg-kinetic-neon/10' : 'border-kinetic-gray bg-kinetic-dark hover:border-kinetic-gray/80 hover:bg-kinetic-dark/80'}`}
                                        >
                                           <div className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center transition-colors ${isDrafted ? 'bg-kinetic-neon border-kinetic-neon' : 'bg-transparent border-kinetic-gray'}`}>
                                              {isDrafted && <CheckCircle className="w-3 h-3 text-kinetic-black" />}
                                           </div>
                                           <span className={`text-sm font-medium ${isDrafted ? 'text-kinetic-neon' : 'text-kinetic-white/80'}`}>{w.title}</span>
                                        </div>
                                      )
                                   })
                                )}
                             </div>
                             
                             {coachWorkouts.length > 0 && (
                               <div className="flex justify-end border-t border-kinetic-gray/30 pt-4">
                                  <button 
                                    onClick={() => saveAssignments(athlete.id)}
                                    disabled={savingAssignments}
                                    className="flex items-center gap-2 bg-kinetic-neon text-kinetic-black px-6 py-2 rounded-lg font-bold hover:bg-kinetic-white transition-colors uppercase disabled:opacity-50 text-sm"
                                  >
                                    <Save className="w-4 h-4" />
                                    {savingAssignments ? 'Salvando...' : 'Salvar Alterações'}
                                  </button>
                               </div>
                             )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
