import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Check, Phone, Mail, User, ExternalLink, Star, Instagram, Facebook, MessageCircle, Share2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Composant de roue visuelle avec animation
const AnimatedWheel = ({ segments = [], spinning, onSpinEnd, result }) => {
  const [rotation, setRotation] = useState(0);
  
  useEffect(() => {
    if (spinning && result !== null && segments.length > 0) {
      const segmentCount = segments.length;
      const segmentAngle = 360 / segmentCount;
      const targetSegment = result;
      const targetAngle = 360 - (targetSegment * segmentAngle + segmentAngle / 2);
      const spins = 5;
      const finalRotation = spins * 360 + targetAngle;
      
      setRotation(finalRotation);
      
      setTimeout(() => {
        onSpinEnd?.();
      }, 4000);
    }
  }, [spinning, result, segments.length, onSpinEnd]);
  
  const defaultColors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
  
  if (!segments || segments.length === 0) {
    return (
      <div className="w-72 h-72 mx-auto flex items-center justify-center bg-white/5 rounded-full">
        <div className="text-white/50 text-sm">Chargement...</div>
      </div>
    );
  }
  
  const total = segments.length;
  const segmentAngle = 360 / total;
  
  return (
    <div className="relative w-72 h-72 mx-auto">
      {/* Indicateur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
        <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-white drop-shadow-lg" />
      </div>
      
      {/* Fond de roue */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(' + segments.map((s, i) => 
            `${s.color || defaultColors[i % defaultColors.length]} ${i * (360/segments.length)}deg ${(i+1) * (360/segments.length)}deg`
          ).join(', ') + ')',
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}
      />
      
      {/* Labels */}
      <svg 
        viewBox="0 0 100 100" 
        className="absolute inset-0 w-full h-full"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
        }}
      >
        {segments.map((segment, i) => {
          const midAngle = (i * segmentAngle + segmentAngle / 2 - 90) * Math.PI / 180;
          const textX = 50 + 30 * Math.cos(midAngle);
          const textY = 50 + 30 * Math.sin(midAngle);
          const textRotation = i * segmentAngle + segmentAngle / 2;
          
          return (
            <text
              key={i}
              x={textX}
              y={textY}
              fill="white"
              fontSize="5"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${textRotation}, ${textX}, ${textY})`}
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
            >
              {(segment.label || '').substring(0, 7)}
            </text>
          );
        })}
      </svg>
      
      {/* Centre */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
          <Gift className="w-6 h-6 text-primary" />
        </div>
      </div>
    </div>
  );
};

// Icône d'action
const ActionIcon = ({ icon }) => {
  const icons = {
    star: Star,
    instagram: Instagram,
    facebook: Facebook,
    whatsapp: MessageCircle,
    share: Share2,
    default: ExternalLink
  };
  const IconComponent = icons[icon] || icons.default;
  return <IconComponent className="w-5 h-5" />;
};

export default function PublicWheelPage() {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  
  // Formulaire
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [actionsCompleted, setActionsCompleted] = useState([]);
  
  // État du jeu
  const [step, setStep] = useState('form'); // form, spinning, result
  const [spinning, setSpinning] = useState(false);
  const [resultIndex, setResultIndex] = useState(null);
  const [prize, setPrize] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showCgv, setShowCgv] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [code]);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API}/wheel/${code}/public`);
      setConfig(response.data);
    } catch (err) {
      console.error('Wheel fetch error:', err);
      setError(err.response?.data?.detail || 'Cette roue n\'est pas disponible');
    } finally {
      setLoading(false);
    }
  };

  const toggleAction = (key) => {
    if (actionsCompleted.includes(key)) {
      setActionsCompleted(actionsCompleted.filter(k => k !== key));
    } else {
      setActionsCompleted([...actionsCompleted, key]);
    }
  };

  const handleSpinEnd = useCallback(() => {
    setSpinning(false);
    setStep('result');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!gdprAccepted) {
      toast.error('Veuillez accepter les conditions');
      return;
    }
    
    // Vérifier actions requises
    const requiredActions = (config?.actions || []).filter(a => a.required);
    for (const action of requiredActions) {
      if (!actionsCompleted.includes(action.key)) {
        toast.error(`Veuillez compléter: ${action.label}`);
        return;
      }
    }
    
    setSubmitting(true);
    
    try {
      const response = await axios.post(`${API}/wheel/${code}/play`, {
        name,
        phone,
        email,
        gdpr_accepted: gdprAccepted,
        actions_completed: actionsCompleted
      });
      
      // Trouver l'index du segment gagnant
      const winningLabel = response.data.prize;
      const winningIndex = config.segments.findIndex(s => s.label === winningLabel);
      
      setPrize(response.data);
      setResultIndex(winningIndex >= 0 ? winningIndex : 0);
      setStep('spinning');
      setSpinning(true);
      
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la participation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Oops!</h1>
          <p className="text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 py-8 px-4">
      <Toaster position="top-center" richColors />
      
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {config?.logo_url && (
            <img src={config.logo_url} alt={config.business_name} className="w-20 h-20 mx-auto mb-4 rounded-xl object-cover" />
          )}
          <h1 className="text-3xl font-bold text-white mb-2">{config?.title || 'Roue de la Fortune'}</h1>
          <p className="text-white/70">{config?.subtitle}</p>
          {config?.business_name && (
            <p className="text-primary-300 text-sm mt-2">Par {config.business_name}</p>
          )}
        </div>

        {/* Roue */}
        {config?.segments && (
          <div className="mb-8">
            <AnimatedWheel 
              segments={config.segments} 
              spinning={spinning}
              result={resultIndex}
              onSpinEnd={handleSpinEnd}
            />
          </div>
        )}

        {/* Formulaire */}
        {step === 'form' && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-6">
            {/* Actions à accomplir */}
            {config?.actions && config.actions.length > 0 && (
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-yellow-400" />
                  Actions pour participer
                </h3>
                <div className="space-y-2">
                  {config.actions.map((action) => (
                    <div 
                      key={action.key}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleAction(action.key)}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                          actionsCompleted.includes(action.key)
                            ? 'bg-green-500 border-green-500'
                            : 'border-white/30'
                        }`}
                      >
                        {actionsCompleted.includes(action.key) && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </button>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">
                          {action.label}
                          {action.required && <span className="text-red-400 ml-1">*</span>}
                        </p>
                      </div>
                      {action.link && (
                        <a
                          href={action.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                          onClick={() => setTimeout(() => toggleAction(action.key), 500)}
                        >
                          <ActionIcon icon={action.icon} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulaire de contact */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-white/70 text-sm mb-1 block">Votre nom</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="text-white/70 text-sm mb-1 block">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="text-white/70 text-sm mb-1 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jean@exemple.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              {/* RGPD */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gdprAccepted}
                    onChange={(e) => setGdprAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-white/30"
                  />
                  <span className="text-white/70 text-sm">
                    J'accepte les{' '}
                    <button type="button" onClick={() => setShowCgv(true)} className="text-primary-300 underline">
                      conditions générales
                    </button>{' '}
                    et la{' '}
                    <button type="button" onClick={() => setShowRules(true)} className="text-primary-300 underline">
                      règle du jeu
                    </button>
                    . Je consens au traitement de mes données personnelles. *
                  </span>
                </label>
              </div>

              <Button
                type="submit"
                disabled={submitting || !gdprAccepted}
                className="w-full py-4 text-lg rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold"
                data-testid="spin-button"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  <>
                    <Gift className="w-5 h-5 mr-2" />
                    TOURNER LA ROUE
                  </>
                )}
              </Button>
            </form>

            {/* Réseaux sociaux */}
            {config?.social_links && Object.values(config.social_links).some(v => v) && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-white/50 text-sm text-center mb-3">Suivez-nous</p>
                <div className="flex justify-center gap-3">
                  {config.social_links.facebook && (
                    <a href={config.social_links.facebook} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                      <Facebook className="w-5 h-5 text-white" />
                    </a>
                  )}
                  {config.social_links.instagram && (
                    <a href={config.social_links.instagram} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                      <Instagram className="w-5 h-5 text-white" />
                    </a>
                  )}
                  {config.social_links.whatsapp && (
                    <a href={`https://wa.me/${config.social_links.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Spinning */}
        {step === 'spinning' && (
          <div className="text-center">
            <p className="text-white text-xl animate-pulse">Bonne chance !</p>
          </div>
        )}

        {/* Résultat */}
        {step === 'result' && prize && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
              <Gift className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">Félicitations !</h2>
            <p className="text-white/70 mb-4">Vous avez gagné</p>
            
            <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 mb-4">
              <p className="text-3xl font-bold text-yellow-400">{prize.prize}</p>
            </div>
            
            <div className="p-4 rounded-xl bg-white/5 mb-4">
              <p className="text-white/50 text-sm mb-2">Votre code de validation</p>
              <p className="text-2xl font-mono font-bold text-white tracking-wider">{prize.validation_code}</p>
            </div>
            
            <p className="text-white/60 text-sm mb-4">
              Présentez ce code à l'établissement pour récupérer votre lot.
              <br />
              Valide jusqu'au {new Date(prize.expiry_date).toLocaleDateString('fr-FR')}
            </p>
            
            <Button
              onClick={() => {
                navigator.clipboard.writeText(prize.validation_code);
                toast.success('Code copié !');
              }}
              className="w-full rounded-xl"
              variant="outline"
            >
              Copier le code
            </Button>
          </div>
        )}

        {/* Modal CGV */}
        {showCgv && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowCgv(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">Conditions Générales</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{config?.cgv_text || 'Non définies'}</p>
              <Button onClick={() => setShowCgv(false)} className="w-full mt-4 rounded-xl">Fermer</Button>
            </div>
          </div>
        )}

        {/* Modal Règles */}
        {showRules && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowRules(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">Règle du Jeu</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{config?.rules_text || 'Non définies'}</p>
              <Button onClick={() => setShowRules(false)} className="w-full mt-4 rounded-xl">Fermer</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
