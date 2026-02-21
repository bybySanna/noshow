import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle, Bell, TrendingDown, Star, ArrowRight, Shield, Zap, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { Sun, Moon, Globe } from 'lucide-react';

const HERO_IMG = "https://images.unsplash.com/photo-1721218900531-b95907298494?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwxfHxidXN5JTIwcmVzdGF1cmFudCUyMG93bmVyJTIwdXNpbmclMjBwaG9uZXxlbnwwfHx8fDE3NzE2NzE5MjJ8MA&ixlib=rb-4.1.0&q=85";

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang } = useLang();

  const copy = {
    fr: {
      nav_login: 'Connexion',
      nav_start: 'Commencer gratuitement',
      hero_tag: 'Anti No-Show SaaS',
      hero_title: 'Fini les\ncliants absents.',
      hero_sub: 'Rappels automatiques, confirmation obligatoire. Réduisez vos no-shows de 70% dès le premier mois.',
      hero_cta: 'Essai gratuit 14 jours',
      hero_login: 'Déjà client ?',
      stat1: '-70%', stat1_label: "d'absences",
      stat2: '+2h', stat2_label: 'gagnées/semaine',
      stat3: '150€', stat3_label: '/mois récupérés',
      feat_title: 'Tout ce qu\'il vous faut',
      feat1_title: 'Rappels automatiques',
      feat1_desc: 'Email, WhatsApp et SMS envoyés 24h, 3h et 30min avant le rendez-vous.',
      feat2_title: 'Confirmation en 1 clic',
      feat2_desc: 'Le client confirme, reporte ou annule via un lien. Aucun compte requis.',
      feat3_title: 'Tableau de bord live',
      feat3_desc: 'Suivez vos RDV, confirmations et no-shows en temps réel.',
      feat4_title: 'Dépôt anti-absence',
      feat4_desc: 'Demandez un acompte Stripe pour responsabiliser vos clients.',
      how_title: 'Comment ça marche ?',
      step1: 'Ajoutez un RDV', step1_d: 'En 10 secondes, même depuis votre téléphone.',
      step2: 'Le client est notifié', step2_d: 'Rappels automatiques par email, WhatsApp ou SMS.',
      step3: 'Il confirme ou annule', step3_d: 'Le statut se met à jour en temps réel dans votre dashboard.',
      testimonials_title: 'Ils nous font confiance',
      plan_title: 'Tarifs simples',
      cta_final_title: 'Prêt à éliminer vos no-shows ?',
      cta_final_sub: '14 jours d\'essai gratuit. Aucune carte requise.',
      cta_final_btn: 'Démarrer maintenant',
    },
    en: {
      nav_login: 'Login',
      nav_start: 'Start for free',
      hero_tag: 'Anti No-Show SaaS',
      hero_title: 'Stop losing money\nto no-shows.',
      hero_sub: 'Automatic reminders, mandatory confirmation. Reduce your no-shows by 70% from the first month.',
      hero_cta: '14-day free trial',
      hero_login: 'Already a customer?',
      stat1: '-70%', stat1_label: "no-shows",
      stat2: '+2h', stat2_label: 'saved per week',
      stat3: '€150', stat3_label: '/month recovered',
      feat_title: 'Everything you need',
      feat1_title: 'Automatic reminders',
      feat1_desc: 'Email, WhatsApp and SMS sent 24h, 3h and 30min before the appointment.',
      feat2_title: 'One-click confirmation',
      feat2_desc: 'Client confirms, reschedules or cancels via link. No account needed.',
      feat3_title: 'Live dashboard',
      feat3_desc: 'Track appointments, confirmations and no-shows in real time.',
      feat4_title: 'Anti-no-show deposit',
      feat4_desc: 'Request a Stripe deposit to hold clients accountable.',
      how_title: 'How does it work?',
      step1: 'Add an appointment', step1_d: 'In 10 seconds, even from your phone.',
      step2: 'Client is notified', step2_d: 'Automatic reminders by email, WhatsApp or SMS.',
      step3: 'They confirm or cancel', step3_d: 'Status updates in real time on your dashboard.',
      testimonials_title: 'Trusted by businesses',
      plan_title: 'Simple pricing',
      cta_final_title: 'Ready to eliminate no-shows?',
      cta_final_sub: '14-day free trial. No credit card required.',
      cta_final_btn: 'Start now',
    }
  };

  const c = copy[lang];

  const features = [
    { icon: Bell, title: c.feat1_title, desc: c.feat1_desc, color: 'text-primary' },
    { icon: CheckCircle, title: c.feat2_title, desc: c.feat2_desc, color: 'text-primary' },
    { icon: TrendingDown, title: c.feat3_title, desc: c.feat3_desc, color: 'text-accent' },
    { icon: Shield, title: c.feat4_title, desc: c.feat4_desc, color: 'text-accent' },
  ];

  const testimonials = [
    { name: 'Marco Rossi', role: lang === 'fr' ? 'Restaurant, Paris' : 'Restaurant, Paris', text: lang === 'fr' ? '"Plus de tables vides le midi. Mes no-shows ont chuté de 60% en 2 semaines."' : '"No more empty tables at lunch. My no-shows dropped 60% in 2 weeks."', stars: 5 },
    { name: 'Sophie Martin', role: lang === 'fr' ? 'Salon de coiffure, Lyon' : 'Hair Salon, Lyon', text: lang === 'fr' ? '"Je récupère plus de 200€/mois grâce aux dépôts. Indispensable."' : '"I recover over €200/month through deposits. Indispensable."', stars: 5 },
    { name: 'James Coach', role: lang === 'fr' ? 'Coach fitness, Bordeaux' : 'Fitness Coach, Bordeaux', text: lang === 'fr' ? '"Mes clients confirment toujours maintenant. La paix d\'esprit en 1 clic."' : '"My clients always confirm now. Peace of mind in 1 click."', stars: 5 },
  ];

  const plans = [
    { id: 'solo', name: 'Solo', price: '29€', popular: false, features: lang === 'fr' ? ['100 RDV/mois', 'Email + WhatsApp', 'Tableau de bord', 'Messages personnalisés'] : ['100 appts/month', 'Email + WhatsApp', 'Dashboard', 'Custom messages'] },
    { id: 'pro', name: 'Pro', price: '59€', popular: true, features: lang === 'fr' ? ['500 RDV/mois', 'Email + WhatsApp + SMS', '5 membres équipe', 'Dépôt Stripe', 'Score risque no-show'] : ['500 appts/month', 'Email + WhatsApp + SMS', '5 staff members', 'Stripe deposit', 'No-show risk score'] },
    { id: 'business', name: 'Business', price: '99€', popular: false, features: lang === 'fr' ? ['RDV illimités', 'Tout illimité', 'Support prioritaire', 'API access', 'Marque blanche'] : ['Unlimited appts', 'Everything unlimited', 'Priority support', 'API access', 'White label'] },
  ];

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-800 text-lg text-foreground">NoShowGone</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleLang} className="p-2 rounded-full hover:bg-muted transition-colors" data-testid="lang-toggle">
              <Globe className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-muted transition-colors" data-testid="theme-toggle">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
            <Link to="/login">
              <Button variant="ghost" size="sm" className="rounded-full" data-testid="nav-login">{c.nav_login}</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" data-testid="nav-cta">{c.nav_start}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary font-heading">{c.hero_tag}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-800 leading-[1.1] whitespace-pre-line">
              {c.hero_title}
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-md">
              {c.hero_sub}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link to="/register">
                <Button size="lg" className="w-full sm:w-auto rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700 px-8 h-12" data-testid="hero-cta">
                  {c.hero_cta}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="ghost" className="w-full sm:w-auto rounded-full h-12 text-muted-foreground" data-testid="hero-login">
                  {c.hero_login}
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              {[
                { val: c.stat1, label: c.stat1_label },
                { val: c.stat2, label: c.stat2_label },
                { val: c.stat3, label: c.stat3_label },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl font-heading font-800 text-primary">{s.val}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative hidden md:block">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] card-shadow">
              <img src={HERO_IMG} alt="Restaurant owner" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              {/* Floating card */}
              <div className="absolute bottom-4 left-4 right-4 glass rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-heading font-700 text-white">Marie Dupont - {lang === 'fr' ? 'Confirmé' : 'Confirmed'}</p>
                    <p className="text-xs text-white/70">{lang === 'fr' ? 'Aujourd\'hui à 14h00' : 'Today at 2:00 PM'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-800 text-center mb-12">{c.feat_title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-card rounded-2xl p-6 border border-border/50 card-shadow hover:border-primary/30 transition-all">
                <f.icon className={`w-6 h-6 ${f.color} mb-4`} />
                <h3 className="font-heading font-700 text-base mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-800 text-center mb-12">{c.how_title}</h2>
          <div className="space-y-8">
            {[
              { n: 1, t: c.step1, d: c.step1_d, icon: Calendar },
              { n: 2, t: c.step2, d: c.step2_d, icon: Bell },
              { n: 3, t: c.step3, d: c.step3_d, icon: CheckCircle },
            ].map((step, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0 border border-primary/20">
                  <span className="font-heading font-800 text-primary text-lg">{step.n}</span>
                </div>
                <div className="pt-2">
                  <h3 className="font-heading font-700 text-lg mb-1">{step.t}</h3>
                  <p className="text-muted-foreground">{step.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-800 text-center mb-12">{c.testimonials_title}</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-card rounded-2xl p-6 border border-border/50 card-shadow">
                <div className="flex mb-3">
                  {Array(t.stars).fill(0).map((_, si) => (
                    <Star key={si} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-4">{t.text}</p>
                <div>
                  <p className="font-heading font-700 text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-800 text-center mb-3">{c.plan_title}</h2>
          <p className="text-center text-muted-foreground mb-12">{lang === 'fr' ? 'Essai gratuit 14 jours inclus. Sans carte bancaire.' : '14-day free trial included. No credit card required.'}</p>
          <div className="grid sm:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className={`rounded-2xl p-6 border card-shadow relative ${plan.popular ? 'border-primary bg-primary/5' : 'border-border/50 bg-card'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-heading font-700 px-3 py-1 rounded-full">
                    {lang === 'fr' ? 'Populaire' : 'Popular'}
                  </div>
                )}
                <h3 className="font-heading font-800 text-xl mb-1">{plan.name}</h3>
                <div className="text-3xl font-heading font-800 text-primary mb-1">{plan.price}</div>
                <p className="text-xs text-muted-foreground mb-5">{lang === 'fr' ? '/mois' : '/month'}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register">
                  <Button className={`w-full rounded-full ${plan.popular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'variant-outline border-border'}`} data-testid={`plan-${plan.id}-cta`}>
                    {lang === 'fr' ? 'Commencer' : 'Get started'}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-primary">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-800 text-primary-foreground mb-3">{c.cta_final_title}</h2>
          <p className="text-primary-foreground/80 mb-8">{c.cta_final_sub}</p>
          <Link to="/register">
            <Button size="lg" className="rounded-full bg-white text-primary hover:bg-white/90 font-heading font-700 px-10 h-12" data-testid="final-cta">
              {c.cta_final_btn}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <Calendar className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-heading font-700 text-sm">NoShowGone</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 NoShowGone. {lang === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">{lang === 'fr' ? 'Confidentialité' : 'Privacy'}</a>
            <a href="#" className="hover:text-foreground transition-colors">{lang === 'fr' ? 'Conditions' : 'Terms'}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
