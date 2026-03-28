import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabase';
import { createClient } from '@supabase/supabase-js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchProfile(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchProfile(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (authUser) => {
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      // Buscar dados do perfil estendido (role, name, etc)
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      // Se deu erro de linha inexistente (PGRST116) significa que a conta Auth foi criada, mas a RLS bloqueou a criação do profile
      if (error && error.code === 'PGRST116') {
         const isElemesmo = authUser.email === 'elemesmo@kinetic.app';
         const { data: newProfile, error: insertError } = await supabase
           .from('profiles')
           .insert([{
             id: authUser.id,
             username: authUser.email.split('@')[0],
             email: authUser.email,
             name: isElemesmo ? 'Administrador' : 'Usuário',
             role: isElemesmo ? 'admin' : 'athlete'
           }])
           .select()
           .single();
           
         if (!insertError) {
            data = newProfile;
            error = null;
         }
      }

      if (error) throw error;
      
      // Merge do objeto auth com o profile
      setUser({ ...authUser, ...data });
    } catch (error) {
      console.error('Erro ao buscar perfil:', error.message);
      // Se não achar o perfil e for um signup em andamento, não seta role falso, deixa null ou básico
      setUser({ ...authUser });
    } finally {
      setLoading(false);
    }
  };

  const signup = async (username, password, name, role = 'athlete', coachId = null) => {
    try {
      const dummyEmail = `${username.toLowerCase().trim()}@kinetic.app`;
      
      // Criamos um cliente isolado para o cadastro para impedir que o Admin perca sua sessão quando criar um treinador
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const isolatedClient = createClient(url, key, { auth: { persistSession: false } });
      
      const { data: authData, error: authError } = await isolatedClient.auth.signUp({
        email: dummyEmail,
        password,
      });

      if (authError) throw authError;

      const newUser = authData.user;
      
      if (newUser) {
        const { error: profileError } = await isolatedClient
          .from('profiles')
          .insert([
            {
              id: newUser.id,
              username: username.toLowerCase().trim(),
              email: dummyEmail,
              name: name,
              role: role,
              coach_id: coachId
            }
          ]);
        
        if (profileError) throw profileError;
      }

      return { success: true };
    } catch (error) {
       return { success: false, error: error.message };
    }
  };

  const login = async (username, password) => {
    try {
      const dummyEmail = `${username.toLowerCase().trim()}@kinetic.app`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: dummyEmail,
        password,
      });
      if (error) throw error;
      if (data.user) {
        await fetchProfile(data.user);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Usuário ou senha inválidos.' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {!loading ? children : (
        <div className="min-h-screen bg-kinetic-dark flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-kinetic-gray border-t-kinetic-neon rounded-full animate-spin"></div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
