import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Cliente admin — tem poderes de service role, nunca expor essa chave no frontend
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verificar o JWT do usuário que chamou a função
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Token de autorização ausente.');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) throw new Error('Token inválido.');

    // Confirmar que quem chamou é admin
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerProfile?.role !== 'admin') {
      throw new Error('Acesso negado: apenas administradores podem excluir usuários.');
    }

    // Ler o user_id alvo do body
    const { user_id } = await req.json();
    if (!user_id) throw new Error('user_id é obrigatório.');

    // Impedir auto-exclusão
    if (user_id === caller.id) {
      throw new Error('Você não pode excluir sua própria conta.');
    }

    // Confirmar que o alvo não é admin (camada extra de proteção)
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user_id)
      .single();

    if (targetProfile?.role === 'admin') {
      throw new Error('Não é possível excluir uma conta de administrador.');
    }

    // Excluir da autenticação — profiles em cascata (se FK configurada) ou deletamos abaixo
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteAuthError) throw deleteAuthError;

    // Garantia: excluir o profile caso a FK não tenha CASCADE configurado
    await supabaseAdmin.from('profiles').delete().eq('id', user_id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
