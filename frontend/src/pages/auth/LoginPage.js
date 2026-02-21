import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'sonner';
import { Sun, Moon } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(lang === 'fr' ? 'Connexion réussie !' : 'Logged in!');
      if (user.role === 'super_admin') navigate('/admin');
      else if (user.role === 'staff') navigate('/staff-dashboard');
      else if (!user.business_id) navigate('/onboarding');
      else navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'fr' ? 'Email ou mot de passe incorrect' : 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-heading font-800 text-lg">NoShowGone</span>
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={toggleLang} className="text-xs font-heading font-700 text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full hover:bg-muted">
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
          <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-muted transition-colors">
            {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-heading font-800 mb-2">{t('login')}</h1>
            <p className="text-muted-foreground text-sm">
              {lang === 'fr' ? 'Bienvenue ! Entrez vos identifiants.' : 'Welcome back! Enter your credentials.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-heading font-600 text-sm">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-12 rounded-xl"
                data-testid="login-email"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-heading font-600 text-sm">{t('password')}</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">{t('forgot_password')}</Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-12 rounded-xl pr-12"
                  data-testid="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700"
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>{t('login')} <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border/50">
            <p className="text-xs font-heading font-700 text-muted-foreground mb-2">{lang === 'fr' ? 'Comptes de démo :' : 'Demo accounts:'}</p>
            <div className="space-y-1 text-xs font-mono text-muted-foreground">
              <p>Admin: admin@noshow.com / admin123456</p>
              <p>Business: demo@bellanapoli.com / demo123456</p>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('no_account')}{' '}
            <Link to="/register" className="text-primary font-heading font-700 hover:underline" data-testid="register-link">
              {t('register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
