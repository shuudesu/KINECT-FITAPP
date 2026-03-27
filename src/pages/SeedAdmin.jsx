import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function SeedAdmin() {
  const { signup, login, user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Criando administrador supremo...');

  useEffect(() => {
    const seed = async () => {
      // Tenta fazer o signup. Se já existir, vai dar erro, então tentamos login.
      const res = await signup('elemesmo', '4499Abc!', 'Administrador', 'admin', null);
      if (res.success) {
        setStatus('Conta criada com sucesso! Redirecionando...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setStatus('Erro ao criar ou Admin já existe (' + res.error + '). Vá para /login e entre.');
      }
    };
    seed();
  }, [signup, navigate]);

  return (
    <div className="min-h-screen bg-kinetic-dark flex items-center justify-center text-kinetic-neon font-display text-2xl">
      {status}
    </div>
  );
}
