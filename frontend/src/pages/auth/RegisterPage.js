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

export default function RegisterPage() {
  const { register } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    if (password.length < 8) {
      toast.error(lang === 'fr' ? 'Mot de passe trop court (min 8 caractères)' : 'Password too short (min 8 chars)');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success(lang === 'fr' ? 'Compte créé ! Configurez votre établissement.' : 'Account created! Set up your business.');
      navigate('/onboarding');
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'fr' ? 'Erreur lors de l\'inscription' : 'Registration error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
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

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-heading font-800 mb-2">{lang === 'fr' ? 'Créer un compte' : 'Create account'}</h1>
            <p className="text-muted-foreground text-sm">
              {lang === 'fr' ? '14 jours gratuits. Aucune carte requise.' : '14 days free. No card required.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="font-heading font-600 text-sm">{t('full_name')}</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={lang === 'fr' ? 'Votre nom complet' : 'Your full name'}
                required
                className="h-12 rounded-xl"
                data-testid="register-name"
              />
            </div>

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
                data-testid="register-email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-heading font-600 text-sm">{t('password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="h-12 rounded-xl pr-12"
                  data-testid="register-password"
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
              data-testid="register-submit"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>{lang === 'fr' ? 'Créer mon compte' : 'Create account'} <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('has_account')}{' '}
            <Link to="/login" className="text-primary font-heading font-700 hover:underline" data-testid="login-link">
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
