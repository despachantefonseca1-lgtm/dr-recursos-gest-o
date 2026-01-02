
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LOGO_IMAGE } from '../constants';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { UserRole } from '../types';

const Login: React.FC = () => {
  const [email, setEmail] = useState('ifadvogado214437@gmail.com');
  const [password, setPassword] = useState('Lcj133028');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert('Erro ao fazer login: ' + error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // 2. Fetch the detailed profile to get the real Role and Name
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error("Erro ao buscar perfil:", profileError);
          // Don't block login, but fallback strictly to SECRETARIA to be safe
          // unless it matches the known admin email, but better to rely on DB
        }

        // 3. Construct the session user object
        const user = {
          id: data.user.id,
          // Use profile name if available, otherwise email prefix or fallback
          name: profile?.name || data.user.email?.split('@')[0] || 'Usuário',
          email: data.user.email || '',
          password: '',
          // CRITICAL: Use the role from DB, or default to SECRETARIA (least privilege)
          role: (profile?.role as UserRole) || UserRole.SECRETARIA,
          responsavelAcompanhamento: profile?.responsavel_acompanhamento || false
        };

        // 4. Store in localStorage for the app to Read
        localStorage.setItem('dr_recursos_current_user', JSON.stringify(user));

        navigate('/');
      }
    } catch (err) {
      console.error(err);
      alert('Erro inesperado ao tentar entrar.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-white/20">
          <div className="p-8 text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-100">
              <img src={LOGO_IMAGE} alt="Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Bem-vindo</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 italic">Doutor Recursos v1.0</p>
          </div>

          <form onSubmit={handleLogin} className="p-8 pt-0 space-y-6">
            <Input
              label="Conta de Acesso"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-50 text-slate-900 font-bold"
            />
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-50 text-slate-900 font-bold"
            />

            <Button
              type="submit"
              fullWidth
              isLoading={loading}
              className="p-6 text-xs tracking-[0.2em] shadow-indigo-100"
            >
              Entrar no Sistema
            </Button>
          </form>

          <div className="p-8 pt-0 border-t border-slate-50 bg-slate-50/50 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-6">
              Escritório Doutor Recursos - Gestão de Multas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
