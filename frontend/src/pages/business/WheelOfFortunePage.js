import React, { useState, useEffect } from 'react';
import { Gift, Settings, Users, BarChart2, Play, Plus, Trash2, Save, ExternalLink, Copy, Check, Percent, Clock, Link, QrCode, FileText, Instagram, Facebook, MessageCircle, Star, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useLang } from '../../context/LangContext';
import BusinessLayout from '../../components/BusinessLayout';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';

// Composant de roue visuelle
const WheelPreview = ({ segments, spinning }) => {
  const total = segments.reduce((sum, s) => sum + (s.probability || 1), 0);
  
  // Calculer les angles cumulatifs
  const segmentsWithAngles = [];
  let cumulativeAngle = 0;
  segments.forEach((segment, i) => {
    const angle = (segment.probability || 1) / total * 360;
    segmentsWithAngles.push({
      ...segment,
      startAngle: cumulativeAngle,
      endAngle: cumulativeAngle + angle
    });
    cumulativeAngle += angle;
  });
  
  const colors = [
    '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#14B8A6', '#F97316'
  ];
  
  return (
    <div className="relative w-64 h-64 mx-auto">
      <svg viewBox="0 0 100 100" className={`w-full h-full ${spinning ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
        {segmentsWithAngles.map((segment, i) => {
          const startRad = (segment.startAngle - 90) * Math.PI / 180;
          const endRad = (segment.endAngle - 90) * Math.PI / 180;
          
          const x1 = 50 + 45 * Math.cos(startRad);
          const y1 = 50 + 45 * Math.sin(startRad);
          const x2 = 50 + 45 * Math.cos(endRad);
          const y2 = 50 + 45 * Math.sin(endRad);
          
          const angle = segment.endAngle - segment.startAngle;
          const largeArc = angle > 180 ? 1 : 0;
          
          return (
            <path
              key={i}
              d={`M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={segment.color || colors[i % colors.length]}
              stroke="white"
              strokeWidth="0.5"
            />
          );
        })}
        <circle cx="50" cy="50" r="8" fill="white" stroke="#374151" strokeWidth="1" />
      </svg>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
        <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[15px] border-t-primary" />
      </div>
    </div>
  );
};

// Configuration d'un segment
const SegmentEditor = ({ segment, index, onUpdate, onDelete }) => {
  const { lang } = useLang();
  const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
  
  return (
    <div className="p-4 bg-muted/50 rounded-xl border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
            style={{ backgroundColor: segment.color || colors[index % colors.length] }}
          />
          <span className="font-heading font-600">
            {lang === 'fr' ? `Segment ${index + 1}` : `Segment ${index + 1}`}
          </span>
        </div>
        <button
          onClick={() => onDelete(index)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {lang === 'fr' ? 'Récompense' : 'Reward'}
          </label>
          <input
            type="text"
            value={segment.label || ''}
            onChange={(e) => onUpdate(index, { ...segment, label: e.target.value })}
            placeholder={lang === 'fr' ? 'Ex: -10%, Café offert...' : 'Ex: 10% off, Free coffee...'}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {lang === 'fr' ? 'Probabilité (%)' : 'Probability (%)'}
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={segment.probability || 10}
              onChange={(e) => onUpdate(index, { ...segment, probability: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {lang === 'fr' ? 'Couleur' : 'Color'}
            </label>
            <div className="flex gap-1">
              {colors.slice(0, 4).map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate(index, { ...segment, color: c })}
                  className={`w-8 h-8 rounded-lg transition-transform ${segment.color === c ? 'scale-110 ring-2 ring-primary' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {lang === 'fr' ? 'Code promo (optionnel)' : 'Promo code (optional)'}
          </label>
          <input
            type="text"
            value={segment.promo_code || ''}
            onChange={(e) => onUpdate(index, { ...segment, promo_code: e.target.value })}
            placeholder="ROUE10"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono"
          />
        </div>
      </div>
    </div>
  );
};

export default function WheelOfFortunePage() {
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState('config');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    enabled: false,
    title: lang === 'fr' ? 'Roue de la Fortune' : 'Wheel of Fortune',
    subtitle: lang === 'fr' ? 'Tentez votre chance !' : 'Try your luck!',
    segments: [
      { label: '-10%', probability: 30, color: '#10B981', promo_code: 'ROUE10' },
      { label: '-20%', probability: 15, color: '#3B82F6', promo_code: 'ROUE20' },
      { label: 'Cadeau', probability: 10, color: '#F59E0B', promo_code: 'GIFT' },
      { label: '-5%', probability: 45, color: '#8B5CF6', promo_code: 'ROUE5' },
    ],
    actions: [],
    social_links: { facebook: '', instagram: '', tiktok: '', whatsapp: '' },
    google_review_link: '',
    cgv_text: '',
    rules_text: '',
    require_gdpr: true,
    expiry_days: 30,
    max_spins_per_client: 1,
  });
  const [stats, setStats] = useState({ total_spins: 0, redemptions: 0, conversion_rate: 0 });
  const [wheelUrl, setWheelUrl] = useState('');
  const [uniqueCode, setUniqueCode] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [redemptions, setRedemptions] = useState([]);
  const [redemptionFilter, setRedemptionFilter] = useState('pending');

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'validations') {
      fetchRedemptions();
    }
  }, [activeTab, redemptionFilter]);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API}/wheel/config`);
      if (response.data) {
        setConfig({ ...config, ...response.data });
        if (response.data.unique_code) {
          setUniqueCode(response.data.unique_code);
          setWheelUrl(`${window.location.origin}/play/${response.data.unique_code}`);
        }
      }
      
      const statsRes = await axios.get(`${API}/wheel/stats`);
      setStats(statsRes.data);
      
      // Récupérer le lien
      try {
        const linkRes = await axios.get(`${API}/wheel/link-info`);
        if (linkRes.data.unique_code) {
          setUniqueCode(linkRes.data.unique_code);
          setWheelUrl(`${window.location.origin}/play/${linkRes.data.unique_code}`);
        }
      } catch (e) {}
    } catch (err) {
      // Configuration par défaut
    } finally {
      setLoading(false);
    }
  };

  const fetchRedemptions = async () => {
    try {
      const response = await axios.get(`${API}/wheel/redemptions?status=${redemptionFilter}`);
      setRedemptions(response.data.redemptions || []);
    } catch (err) {
      console.error(err);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const response = await axios.put(`${API}/wheel/config`, config);
      if (response.data.unique_code) {
        setUniqueCode(response.data.unique_code);
        setWheelUrl(`${window.location.origin}/play/${response.data.unique_code}`);
      }
      toast.success(lang === 'fr' ? 'Configuration sauvegardée !' : 'Configuration saved!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const validateRedemption = async (validationCode) => {
    try {
      await axios.post(`${API}/wheel/redeem`, { validation_code: validationCode });
      toast.success(lang === 'fr' ? 'Gain validé !' : 'Prize validated!');
      fetchRedemptions();
      fetchConfig(); // Refresh stats
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const updateSegment = (index, newSegment) => {
    const newSegments = [...config.segments];
    newSegments[index] = newSegment;
    setConfig({ ...config, segments: newSegments });
  };

  const deleteSegment = (index) => {
    if (config.segments.length <= 2) {
      toast.error(lang === 'fr' ? 'Minimum 2 segments requis' : 'Minimum 2 segments required');
      return;
    }
    const newSegments = config.segments.filter((_, i) => i !== index);
    setConfig({ ...config, segments: newSegments });
  };

  const addSegment = () => {
    if (config.segments.length >= 8) {
      toast.error(lang === 'fr' ? 'Maximum 8 segments' : 'Maximum 8 segments');
      return;
    }
    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    setConfig({
      ...config,
      segments: [
        ...config.segments,
        { label: lang === 'fr' ? 'Nouveau' : 'New', probability: 10, color: colors[config.segments.length % colors.length] }
      ]
    });
  };

  const testSpin = () => {
    setSpinning(true);
    setTimeout(() => {
      setSpinning(false);
      const total = config.segments.reduce((sum, s) => sum + (s.probability || 1), 0);
      let rand = Math.random() * total;
      let winner = config.segments[0];
      for (const seg of config.segments) {
        rand -= (seg.probability || 1);
        if (rand <= 0) {
          winner = seg;
          break;
        }
      }
      toast.success(`🎉 ${winner.label}`);
    }, 3000);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(wheelUrl);
    setCopied(true);
    toast.success(lang === 'fr' ? 'Lien copié !' : 'Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const addAction = () => {
    const actions = config.actions || [];
    setConfig({
      ...config,
      actions: [
        ...actions,
        { key: `action_${Date.now()}`, label: '', link: '', required: false, icon: 'star' }
      ]
    });
  };

  const updateAction = (index, newAction) => {
    const actions = [...(config.actions || [])];
    actions[index] = newAction;
    setConfig({ ...config, actions });
  };

  const deleteAction = (index) => {
    const actions = (config.actions || []).filter((_, i) => i !== index);
    setConfig({ ...config, actions });
  };

  const actionIcons = [
    { key: 'star', label: 'Avis', Icon: Star },
    { key: 'instagram', label: 'Instagram', Icon: Instagram },
    { key: 'facebook', label: 'Facebook', Icon: Facebook },
    { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
    { key: 'link', label: 'Lien', Icon: ExternalLink },
  ];

  return (
    <BusinessLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800 flex items-center gap-3">
          <Gift className="w-6 h-6 text-primary" />
          {lang === 'fr' ? 'Roue de la Fortune' : 'Wheel of Fortune'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === 'fr' 
            ? 'Créez une roue interactive pour récompenser vos clients'
            : 'Create an interactive wheel to reward your customers'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'config', icon: Settings, label_fr: 'Segments', label_en: 'Segments' },
          { key: 'actions', icon: CheckCircle, label_fr: 'Actions', label_en: 'Actions' },
          { key: 'link', icon: QrCode, label_fr: 'Lien & QR', label_en: 'Link & QR' },
          { key: 'legal', icon: FileText, label_fr: 'CGV & Règles', label_en: 'Terms & Rules' },
          { key: 'validations', icon: Check, label_fr: 'Validations', label_en: 'Validations' },
          { key: 'stats', icon: BarChart2, label_fr: 'Stats', label_en: 'Stats' },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.key)}
            className="rounded-full whitespace-nowrap"
            data-testid={`tab-${tab.key}`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {lang === 'fr' ? tab.label_fr : tab.label_en}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'config' && (
            <div className="space-y-6">
              {/* Enable toggle */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-700 flex items-center gap-2">
                      <Gift className="w-5 h-5 text-primary" />
                      {lang === 'fr' ? 'Activer la Roue' : 'Enable Wheel'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {lang === 'fr' 
                        ? 'Rendez votre roue accessible aux clients'
                        : 'Make your wheel accessible to customers'}
                    </p>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      config.enabled ? 'bg-primary' : 'bg-muted'
                    }`}
                    data-testid="toggle-wheel"
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      config.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                {config.enabled && wheelUrl && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-xl flex items-center gap-3">
                    <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      value={wheelUrl}
                      readOnly
                      className="flex-1 bg-transparent text-sm font-mono truncate"
                    />
                    <button
                      onClick={copyUrl}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Title & Subtitle */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Personnalisation' : 'Customization'}
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      {lang === 'fr' ? 'Titre' : 'Title'}
                    </label>
                    <input
                      type="text"
                      value={config.title}
                      onChange={(e) => setConfig({ ...config, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      {lang === 'fr' ? 'Sous-titre' : 'Subtitle'}
                    </label>
                    <input
                      type="text"
                      value={config.subtitle}
                      onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border"
                    />
                  </div>
                </div>
              </div>

              {/* Segments */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-700">
                    {lang === 'fr' ? 'Segments de la Roue' : 'Wheel Segments'}
                  </h3>
                  <Button onClick={addSegment} size="sm" className="rounded-xl">
                    <Plus className="w-4 h-4 mr-1" />
                    {lang === 'fr' ? 'Ajouter' : 'Add'}
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {config.segments.map((segment, index) => (
                    <SegmentEditor
                      key={index}
                      segment={segment}
                      index={index}
                      onUpdate={updateSegment}
                      onDelete={deleteSegment}
                    />
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Paramètres' : 'Settings'}
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {lang === 'fr' ? 'Validité des gains (jours)' : 'Prize validity (days)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={config.expiry_days}
                      onChange={(e) => setConfig({ ...config, expiry_days: parseInt(e.target.value) || 30 })}
                      className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {lang === 'fr' ? 'Participations max par client' : 'Max plays per client'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={config.max_spins_per_client}
                      onChange={(e) => setConfig({ ...config, max_spins_per_client: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border"
                    />
                  </div>
                </div>
              </div>

              {/* Preview wheel */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4 text-center">
                  {lang === 'fr' ? 'Aperçu' : 'Preview'}
                </h3>
                <WheelPreview segments={config.segments} spinning={spinning} />
                <div className="mt-4 text-center">
                  <Button onClick={testSpin} disabled={spinning} className="rounded-xl" data-testid="test-spin">
                    <Play className="w-4 h-4 mr-2" />
                    {lang === 'fr' ? 'Tester' : 'Test'}
                  </Button>
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end">
                <Button onClick={saveConfig} disabled={saving} className="rounded-xl" data-testid="save-config">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
                </Button>
              </div>
            </div>
          )}

          {/* ACTIONS TAB */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-heading font-700">
                      {lang === 'fr' ? 'Actions à accomplir' : 'Actions to complete'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'fr' 
                        ? 'Définissez les actions que vos clients doivent accomplir avant de jouer'
                        : 'Define actions your customers must complete before playing'}
                    </p>
                  </div>
                  <Button onClick={addAction} size="sm" className="rounded-xl">
                    <Plus className="w-4 h-4 mr-1" />
                    {lang === 'fr' ? 'Ajouter' : 'Add'}
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {(config.actions || []).map((action, index) => (
                    <div key={index} className="p-4 bg-muted/50 rounded-xl border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-heading font-600">Action {index + 1}</span>
                        <button onClick={() => deleteAction(index)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            {lang === 'fr' ? 'Libellé' : 'Label'}
                          </label>
                          <input
                            type="text"
                            value={action.label || ''}
                            onChange={(e) => updateAction(index, { ...action, label: e.target.value })}
                            placeholder={lang === 'fr' ? 'Ex: Laisser un avis Google' : 'Ex: Leave a Google review'}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            {lang === 'fr' ? 'Lien (optionnel)' : 'Link (optional)'}
                          </label>
                          <input
                            type="url"
                            value={action.link || ''}
                            onChange={(e) => updateAction(index, { ...action, link: e.target.value })}
                            placeholder="https://..."
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={action.required || false}
                            onChange={(e) => updateAction(index, { ...action, required: e.target.checked })}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm">{lang === 'fr' ? 'Obligatoire' : 'Required'}</span>
                        </label>
                        <div className="flex gap-2 ml-auto">
                          {actionIcons.map((iconDef) => (
                            <button
                              key={iconDef.key}
                              onClick={() => updateAction(index, { ...action, icon: iconDef.key })}
                              className={`p-2 rounded-lg transition-colors ${action.icon === iconDef.key ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'}`}
                              title={iconDef.label}
                            >
                              <iconDef.Icon className="w-4 h-4" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(config.actions || []).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>{lang === 'fr' ? 'Aucune action définie' : 'No actions defined'}</p>
                      <p className="text-sm">{lang === 'fr' ? 'Les clients pourront jouer directement' : 'Customers can play directly'}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Social links */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Liens réseaux sociaux' : 'Social media links'}
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { key: 'facebook', icon: Facebook, label: 'Facebook' },
                    { key: 'instagram', icon: Instagram, label: 'Instagram' },
                    { key: 'tiktok', icon: Play, label: 'TikTok' },
                    { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp' },
                  ].map((social) => (
                    <div key={social.key}>
                      <label className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                        <social.icon className="w-4 h-4" />
                        {social.label}
                      </label>
                      <input
                        type="text"
                        value={config.social_links?.[social.key] || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          social_links: { ...(config.social_links || {}), [social.key]: e.target.value }
                        })}
                        placeholder={social.key === 'whatsapp' ? '+33612345678' : `https://${social.key}.com/...`}
                        className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Google Review Link */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  {lang === 'fr' ? 'Lien Avis Google' : 'Google Review Link'}
                </h3>
                <input
                  type="url"
                  value={config.google_review_link || ''}
                  onChange={(e) => setConfig({ ...config, google_review_link: e.target.value })}
                  placeholder="https://g.page/r/..."
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {lang === 'fr' 
                    ? 'Ce lien sera utilisé pour l\'action "Laisser un avis Google"'
                    : 'This link will be used for the "Leave a Google review" action'}
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveConfig} disabled={saving} className="rounded-xl">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
                </Button>
              </div>
            </div>
          )}

          {/* LINK & QR TAB */}
          {activeTab === 'link' && (
            <div className="space-y-6">
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-heading font-700 flex items-center gap-2">
                      <Gift className="w-5 h-5 text-primary" />
                      {lang === 'fr' ? 'Activer la Roue' : 'Enable Wheel'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {config.enabled 
                        ? (lang === 'fr' ? 'Votre roue est accessible aux clients' : 'Your wheel is accessible to customers')
                        : (lang === 'fr' ? 'Activez pour rendre la roue accessible' : 'Enable to make the wheel accessible')}
                    </p>
                  </div>
                  <button
                    onClick={() => { setConfig({ ...config, enabled: !config.enabled }); }}
                    className={`w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-primary' : 'bg-muted'}`}
                    data-testid="toggle-wheel"
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* URL unique */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4 flex items-center gap-2">
                  <Link className="w-5 h-5 text-primary" />
                  {lang === 'fr' ? 'Lien unique de votre roue' : 'Your unique wheel link'}
                </h3>
                <div className="p-3 bg-muted/50 rounded-xl flex items-center gap-3">
                  <input
                    type="text"
                    value={wheelUrl || `${window.location.origin}/play/${uniqueCode || '...'}`}
                    readOnly
                    className="flex-1 bg-transparent text-sm font-mono truncate"
                  />
                  <button onClick={copyUrl} className="p-2 rounded-lg hover:bg-muted transition-colors">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a href={wheelUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {lang === 'fr' 
                    ? 'Partagez ce lien avec vos clients ou dans vos messages automatiques'
                    : 'Share this link with your customers or in your automated messages'}
                </p>
              </div>

              {/* QR Code */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-primary" />
                  {lang === 'fr' ? 'QR Code' : 'QR Code'}
                </h3>
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-xl">
                    {wheelUrl && <QRCode value={wheelUrl} size={200} />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    {lang === 'fr' 
                      ? 'Imprimez ce QR code et affichez-le dans votre établissement'
                      : 'Print this QR code and display it in your establishment'}
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4 rounded-xl"
                    onClick={() => {
                      const svg = document.querySelector('.bg-white svg');
                      if (svg) {
                        const svgData = new XMLSerializer().serializeToString(svg);
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const img = new Image();
                        img.onload = () => {
                          canvas.width = img.width;
                          canvas.height = img.height;
                          ctx.fillStyle = 'white';
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.drawImage(img, 0, 0);
                          const a = document.createElement('a');
                          a.download = 'qr-code-roue.png';
                          a.href = canvas.toDataURL('image/png');
                          a.click();
                        };
                        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                      }
                    }}
                  >
                    {lang === 'fr' ? 'Télécharger le QR Code' : 'Download QR Code'}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveConfig} disabled={saving} className="rounded-xl">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
                </Button>
              </div>
            </div>
          )}

          {/* LEGAL TAB */}
          {activeTab === 'legal' && (
            <div className="space-y-6">
              {/* CGV */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Conditions Générales' : 'Terms & Conditions'}
                </h3>
                <textarea
                  value={config.cgv_text || ''}
                  onChange={(e) => setConfig({ ...config, cgv_text: e.target.value })}
                  placeholder={lang === 'fr' 
                    ? 'En participant à ce jeu, vous acceptez nos conditions générales...'
                    : 'By participating in this game, you accept our terms and conditions...'}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border resize-none"
                />
              </div>

              {/* Règles du jeu */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Règles du Jeu' : 'Game Rules'}
                </h3>
                <textarea
                  value={config.rules_text || ''}
                  onChange={(e) => setConfig({ ...config, rules_text: e.target.value })}
                  placeholder={lang === 'fr' 
                    ? '1. Une seule participation par personne et par jour\n2. Le lot doit être récupéré sur présentation du code\n3. Validité de 30 jours...'
                    : '1. One entry per person per day\n2. Prize must be collected with the code\n3. Valid for 30 days...'}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border resize-none"
                />
              </div>

              {/* RGPD */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-700">
                      {lang === 'fr' ? 'Case RGPD obligatoire' : 'Required GDPR checkbox'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'fr' 
                        ? 'Les clients doivent accepter les CGV et la politique RGPD pour jouer'
                        : 'Customers must accept terms and GDPR policy to play'}
                    </p>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, require_gdpr: !config.require_gdpr })}
                    className={`w-12 h-6 rounded-full transition-colors ${config.require_gdpr ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${config.require_gdpr ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveConfig} disabled={saving} className="rounded-xl">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
                </Button>
              </div>
            </div>
          )}

          {/* VALIDATIONS TAB */}
          {activeTab === 'validations' && (
            <div className="space-y-6">
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Gains à valider' : 'Prizes to validate'}
                </h3>
                
                {/* Filtres */}
                <div className="flex gap-2 mb-4">
                  {['pending', 'validated', 'expired'].map((status) => (
                    <Button
                      key={status}
                      variant={redemptionFilter === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRedemptionFilter(status)}
                      className="rounded-full"
                    >
                      {status === 'pending' && (lang === 'fr' ? 'En attente' : 'Pending')}
                      {status === 'validated' && (lang === 'fr' ? 'Validés' : 'Validated')}
                      {status === 'expired' && (lang === 'fr' ? 'Expirés' : 'Expired')}
                    </Button>
                  ))}
                </div>

                {/* Liste */}
                <div className="space-y-3">
                  {redemptions.map((redemption) => (
                    <div key={redemption.id} className="p-4 bg-muted/50 rounded-xl border border-border">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-heading font-600">{redemption.client_name || 'Client'}</p>
                          <p className="text-sm text-muted-foreground">{redemption.client_phone} • {redemption.client_email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {redemption.prize_label}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {redemption.validation_code}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(redemption.created_at).toLocaleDateString('fr-FR', { 
                              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {redemption.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => validateRedemption(redemption.validation_code)}
                              className="rounded-xl"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {lang === 'fr' ? 'Valider' : 'Validate'}
                            </Button>
                          )}
                          {redemption.status === 'validated' && (
                            <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 text-xs font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {lang === 'fr' ? 'Validé' : 'Validated'}
                            </span>
                          )}
                          {redemption.status === 'expired' && (
                            <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 text-xs font-medium flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              {lang === 'fr' ? 'Expiré' : 'Expired'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {redemptions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>{lang === 'fr' ? 'Aucun gain' : 'No prizes'} {redemptionFilter === 'pending' ? (lang === 'fr' ? 'en attente' : 'pending') : ''}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-card rounded-xl p-5 border border-border">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Play className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-heading font-800">{stats.total_spins}</p>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'fr' ? 'Participations' : 'Total plays'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-card rounded-xl p-5 border border-border">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-heading font-800">{stats.redemptions}</p>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'fr' ? 'Gains validés' : 'Prizes validated'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-card rounded-xl p-5 border border-border">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Percent className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-heading font-800">{stats.conversion_rate}%</p>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'fr' ? 'Taux de validation' : 'Validation rate'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl p-5 border border-primary/20">
                <h3 className="font-heading font-700 mb-2">
                  {lang === 'fr' ? 'Comment utiliser la Roue de la Fortune ?' : 'How to use the Wheel of Fortune?'}
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>1. {lang === 'fr' ? 'Configurez vos segments et leurs probabilités' : 'Configure your segments and their probabilities'}</li>
                  <li>2. {lang === 'fr' ? 'Définissez les actions à accomplir (avis Google, follow réseaux...)' : 'Define actions to complete (Google review, social follow...)'}</li>
                  <li>3. {lang === 'fr' ? 'Partagez le lien ou QR code avec vos clients' : 'Share the link or QR code with your customers'}</li>
                  <li>4. {lang === 'fr' ? 'Validez les gains présentés par les clients' : 'Validate prizes presented by customers'}</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </BusinessLayout>
  );
}
