import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ChangePasswordModal() {
  const { changePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setSaving(true);
    const result = await changePassword(password);
    if (!result.success) {
      setError(result.error || 'Erro ao alterar senha. Tente novamente.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-kinetic-black border border-kinetic-neon/40 rounded-2xl p-8 shadow-[0_0_60px_rgba(204,255,0,0.15)]">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-full bg-kinetic-neon/10 border border-kinetic-neon/30 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-kinetic-neon" />
          </div>
          <h1 className="text-2xl font-display font-bold text-kinetic-white uppercase tracking-wide mb-2">
            Primeiro Acesso
          </h1>
          <p className="text-kinetic-white/50 text-sm">
            Defina uma senha pessoal para continuar. Você não poderá usar o sistema sem completar este passo.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/40 text-red-400 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-kinetic-white mb-1 uppercase tracking-wide">
              Nova Senha
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-kinetic-dark border border-kinetic-gray rounded-lg px-4 py-3 pr-11 text-kinetic-white focus:outline-none focus:border-kinetic-neon transition-colors"
                placeholder="Mínimo 8 caracteres"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-kinetic-white/40 hover:text-kinetic-white transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-kinetic-white mb-1 uppercase tracking-wide">
              Confirmar Senha
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-kinetic-dark border border-kinetic-gray rounded-lg px-4 py-3 text-kinetic-white focus:outline-none focus:border-kinetic-neon transition-colors"
              placeholder="Repita a senha"
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-kinetic-neon text-kinetic-black font-bold py-4 rounded-xl uppercase tracking-widest hover:bg-kinetic-white transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Definir Minha Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
