-- Criação de tipos enum para roles e status
CREATE TYPE user_role AS ENUM ('athlete', 'coach', 'admin');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted');

-- Tabela: profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  role user_role DEFAULT 'athlete',
  coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabela: workouts
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabela: workout_sessions
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  stats JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Tabela: invites
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status invite_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Criar RLS (Row Level Security) opcional aqui, habilitando por default
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: Políticas de Segurança para permitir leitura e escrita!
CREATE POLICY "Permitir leitura de perfis para usuários autenticados" 
ON profiles FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Permitir inserção do próprio perfil" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Permitir atualização do próprio perfil" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Treinador pode deletar alunos" 
ON profiles FOR DELETE 
TO authenticated 
USING (auth.uid() = coach_id);

-- Políticas básicas para workouts e sessions (Treinadores podem criar, atletas ver)
CREATE POLICY "Leitura de treinos" ON workouts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Criar treinos" ON workouts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Leitura de sessões" ON workout_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Criar sessões" ON workout_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = athlete_id);

-- Políticas para invites (Links Únicos)
CREATE POLICY "Leitura publica de convites" ON invites FOR SELECT USING (true);
CREATE POLICY "Criacao de convites por treinador" ON invites FOR INSERT TO authenticated WITH CHECK (auth.uid() = coach_id);
CREATE POLICY "Atualizacao de convites aprovados" ON invites FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Delecao de convites" ON invites FOR DELETE TO authenticated USING (auth.uid() = coach_id);

-- Tabela: workout_assignments (Atribuição de Treinos)
CREATE TABLE workout_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(athlete_id, workout_id)
);

ALTER TABLE workout_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura assignments" ON workout_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inserir assignments" ON workout_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Deletar assignments" ON workout_assignments FOR DELETE TO authenticated USING (true);
