import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { supabase } from '../supabase';

export default function Login() {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite'); // ID do Treinador se for cadastro
  
  const isSignup = !!inviteCode;

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (!isSignup) {
        // Fluxo de Login
        const result = await login(username, password);
        if (result.success) {
          navigate('/dashboard');
        } else {
          setError(result.error || 'Erro ao fazer login.');
        }
      } else {
        // Fluxo de Cadastro de Atleta via Invite Único
        
        // 1. Validar convite no Supabase
        const { data: inviteData, error: inviteError } = await supabase
          .from('invites')
          .select('*')
          .eq('id', inviteCode)
          .single();
          
        if (inviteError || !inviteData || inviteData.status === 'accepted') {
           setError('Este link de convite é inválido ou já foi utilizado. Peça um novo link ao seu treinador.');
           setLoading(false);
           return;
        }

        // 2. Tentar cadastrar com o coach_id real pego do convite
        const result = await signup(username, password, name, 'athlete', inviteData.coach_id);
        
        if (result.success) {
          // 3. Atualizar status do convite para "accepted"
          await supabase.from('invites').update({ status: 'accepted' }).eq('id', inviteCode);
          
          // Faz login imediato
          const loginResult = await login(username, password);
          if (loginResult.success) {
             navigate('/dashboard');
          } else {
             setSuccessMsg('Conta criada! Faça login.');
          }
        } else {
          setError(result.error || 'Erro ao criar conta. Usuário pode já existir.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kinetic-dark flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-kinetic-black border border-kinetic-gray rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8 text-center">
          <Dumbbell className="w-16 h-16 text-kinetic-neon mb-4" />
          <h1 className="text-4xl font-display font-bold tracking-wider text-kinetic-white mb-2">
            KINE<span className="text-kinetic-neon">TIC</span>
          </h1>
          <p className="text-kinetic-white text-sm opacity-70">
            A PERFORMANCE É A NOSSA LINGUAGEM.
          </p>
        </div>

        {isSignup && (
          <div className="mb-6 p-4 bg-kinetic-neon/10 border border-kinetic-neon text-kinetic-neon rounded-lg text-sm text-center font-bold">
            Cadastre-se para conectar ao seu treinador.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 bg-kinetic-neon/10 border border-kinetic-neon text-kinetic-neon rounded-lg text-sm text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-kinetic-white mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-kinetic-dark border border-kinetic-gray rounded-lg px-4 py-3 text-kinetic-white focus:outline-none focus:border-kinetic-neon transition-colors"
                placeholder="Seu nome real"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-kinetic-white mb-1">
              Usuário (Nick)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-kinetic-dark border border-kinetic-gray rounded-lg px-4 py-3 text-kinetic-white focus:outline-none focus:border-kinetic-neon transition-colors"
              placeholder="ex: gui123"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-kinetic-white mb-1">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-kinetic-dark border border-kinetic-gray rounded-lg px-4 py-3 text-kinetic-white focus:outline-none focus:border-kinetic-neon transition-colors"
              placeholder="********"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kinetic-neon text-kinetic-black font-bold py-3 px-4 rounded-lg hover:bg-kinetic-white transition-colors uppercase tracking-wide mt-6 disabled:opacity-50"
          >
            {loading ? 'Aguarde...' : (isSignup ? 'CRIAR CONTA E VINCULAR' : 'ENTRAR NO SISTEMA')}
          </button>
        </form>
      </div>
    </div>
  );
}
