import React, { useState, useEffect } from 'react';
import { Brain, AlertTriangle, CheckCircle, TrendingUp, Shield, Users, RefreshCw, ChevronRight, Calendar, Phone, Zap } from 'lucide-react';
import { Button } from '../../components/ui/button';
import BusinessLayout from '../../components/BusinessLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const RISK_COLORS = {
  very_low: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', hex: '#15803d' },
  low: { bg: 'bg-green-50 dark:bg-green-900/10', text: 'text-green-500', hex: '#22c55e' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', hex: '#f59e0b' },
  high: { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', hex: '#ea580c' },
  very_high: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', hex: '#ef4444' },
};

const RISK_LABELS = {
  very_low: { fr: 'Très fiable', en: 'Very reliable' },
  low: { fr: 'Fiable', en: 'Reliable' },
  medium: { fr: 'Modéré', en: 'Moderate' },
  high: { fr: 'Risqué', en: 'Risky' },
  very_high: { fr: 'Très risqué', en: 'Very risky' },
};

export default function MLScoringPage() {
  const { lang } = useLang();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [apptScore, setApptScore] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);

  useEffect(() => { fetchOverview(); }, []);

  const fetchOverview = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await axios.get(`${API}/ml/risk-overview`);
      setOverview(res.data);
    } catch (err) {
      toast.error('Erreur chargement données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadApptScore = async (appt) => {
    setSelectedAppt(appt);
    setLoadingScore(true);
    try {
      const res = await axios.post(`${API}/ml/score-appointment/${appt.appointment_id}`);
      setApptScore(res.data);
    } catch {
      toast.error('Erreur');
    } finally {
      setLoadingScore(false);
    }
  };

  const getRiskDistributionPercent = (level) => {
    if (!overview || overview.total_upcoming === 0) return 0;
    return Math.round((overview.risk_distribution[level] / overview.total_upcoming) * 100);
  };

  return (
    <BusinessLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-heading font-800 flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            {lang === 'fr' ? 'Scoring ML' : 'ML Scoring'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === 'fr' 
              ? 'Prédiction des no-shows basée sur l\'historique client' 
              : 'No-show prediction based on client history'}
          </p>
        </div>
        <Button 
          onClick={() => fetchOverview(true)}
          disabled={refreshing}
          variant="outline"
          className="rounded-full h-9 px-4 font-heading font-700"
          data-testid="refresh-scoring"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
          {lang === 'fr' ? 'Actualiser' : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : overview ? (
        <div className="space-y-6">
          {/* Main stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              icon={Calendar}
              label={lang === 'fr' ? 'RDV à venir' : 'Upcoming'}
              value={overview.total_upcoming}
              color="text-primary"
            />
            <StatCard 
              icon={Brain}
              label={lang === 'fr' ? 'Score moyen' : 'Avg score'}
              value={`${overview.average_risk_score}%`}
              color={overview.average_risk_score > 50 ? 'text-orange-500' : 'text-green-500'}
            />
            <StatCard 
              icon={AlertTriangle}
              label={lang === 'fr' ? 'À risque' : 'At risk'}
              value={overview.high_risk_count}
              color="text-red-500"
            />
            <StatCard 
              icon={Shield}
              label={lang === 'fr' ? 'Fiables' : 'Reliable'}
              value={overview.risk_distribution.very_low + overview.risk_distribution.low}
              color="text-green-500"
            />
          </div>

          {/* Risk distribution */}
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <h2 className="font-heading font-700 text-sm mb-4">
              {lang === 'fr' ? 'Répartition des risques' : 'Risk distribution'}
            </h2>
            
            <div className="space-y-3">
              {Object.entries(overview.risk_distribution).map(([level, count]) => {
                const percent = getRiskDistributionPercent(level);
                const colors = RISK_COLORS[level];
                const label = RISK_LABELS[level]?.[lang] || level;
                
                return (
                  <div key={level} className="flex items-center gap-3">
                    <div className={cn("w-20 text-xs font-heading font-600", colors.text)}>
                      {label}
                    </div>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%`, background: colors.hex }}
                      />
                    </div>
                    <div className="w-12 text-right text-xs font-mono text-muted-foreground">
                      {count} ({percent}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* High risk appointments */}
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                {lang === 'fr' ? 'RDV à risque élevé' : 'High risk appointments'}
              </h2>
              <span className="text-xs text-muted-foreground">
                {overview.high_risk_appointments.length} {lang === 'fr' ? 'clients' : 'clients'}
              </span>
            </div>

            {overview.high_risk_appointments.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {lang === 'fr' ? 'Aucun RDV à risque élevé' : 'No high risk appointments'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {overview.high_risk_appointments.map((appt, idx) => {
                  const colors = RISK_COLORS[appt.risk_level];
                  
                  return (
                    <div 
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl hover:bg-muted/50 cursor-pointer transition-all"
                      onClick={() => loadApptScore(appt)}
                      data-testid={`risk-appt-${idx}`}
                    >
                      <div 
                        className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", colors.bg)}
                      >
                        <span className={cn("font-heading font-800 text-sm", colors.text)}>
                          {Math.round(appt.risk_score)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-700 text-sm truncate">{appt.client_name}</p>
                        <p className="text-xs text-muted-foreground">{appt.date} à {appt.time}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={cn("text-xs font-heading font-700", colors.text)}>
                          {RISK_LABELS[appt.risk_level]?.[lang]}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ML Explanation */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading font-800 text-sm mb-1">
                  {lang === 'fr' ? 'Comment fonctionne le scoring ML ?' : 'How does ML scoring work?'}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === 'fr' 
                    ? 'Notre algorithme analyse l\'historique de chaque client : taux de no-shows passés, délai de confirmation, récence des RDV honorés, et patterns de réservation. Un score élevé suggère d\'exiger un dépôt ou d\'activer des rappels supplémentaires.'
                    : 'Our algorithm analyzes each client\'s history: past no-show rate, confirmation delay, recency of honored appointments, and booking patterns. A high score suggests requiring a deposit or activating additional reminders.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {lang === 'fr' ? 'Aucune donnée disponible' : 'No data available'}
          </p>
        </div>
      )}

      {/* Score detail modal */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedAppt(null)}>
          <div 
            className="bg-card rounded-2xl w-full max-w-md p-5 shadow-xl animate-slide-up max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            data-testid="score-detail-modal"
          >
            {loadingScore ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : apptScore ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading font-800 text-lg">{lang === 'fr' ? 'Analyse de risque' : 'Risk analysis'}</h2>
                  <button onClick={() => setSelectedAppt(null)} className="p-1 rounded-full hover:bg-muted text-muted-foreground">✕</button>
                </div>

                {/* Client info */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded-xl">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-heading font-700">{selectedAppt.client_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {selectedAppt.client_phone}
                    </p>
                  </div>
                </div>

                {/* Score gauge */}
                <div className="text-center mb-5">
                  <div 
                    className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-2", RISK_COLORS[apptScore.risk_level]?.bg)}
                    style={{ border: `4px solid ${RISK_COLORS[apptScore.risk_level]?.hex}` }}
                  >
                    <span className={cn("font-heading font-800 text-2xl", RISK_COLORS[apptScore.risk_level]?.text)}>
                      {Math.round(apptScore.score)}
                    </span>
                  </div>
                  <p className={cn("font-heading font-700", RISK_COLORS[apptScore.risk_level]?.text)}>
                    {apptScore.risk_label}
                  </p>
                </div>

                {/* Factors */}
                {apptScore.factors && (
                  <div className="mb-4">
                    <h3 className="font-heading font-600 text-xs text-muted-foreground mb-2">
                      {lang === 'fr' ? 'Facteurs analysés' : 'Analyzed factors'}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <FactorBox label={lang === 'fr' ? 'Total RDV' : 'Total appts'} value={apptScore.factors.total_appointments} />
                      <FactorBox label="No-shows" value={apptScore.factors.no_shows} alert={apptScore.factors.no_shows > 0} />
                      <FactorBox label={lang === 'fr' ? 'Taux confirm.' : 'Confirm rate'} value={`${apptScore.factors.confirmation_rate}%`} />
                      <FactorBox label={lang === 'fr' ? 'Taux no-show' : 'No-show rate'} value={`${apptScore.factors.no_show_rate}%`} alert={apptScore.factors.no_show_rate > 20} />
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {apptScore.recommendations?.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-heading font-600 text-xs text-muted-foreground mb-2">
                      {lang === 'fr' ? 'Recommandations' : 'Recommendations'}
                    </h3>
                    <ul className="space-y-1">
                      {apptScore.recommendations.map((rec, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="mt-0.5">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested actions */}
                {apptScore.suggested_actions?.length > 0 && (
                  <div className="space-y-2">
                    {apptScore.suggested_actions.filter(a => a.priority !== 'normal').map((action, i) => (
                      <Button 
                        key={i}
                        variant={action.priority === 'high' ? 'default' : 'outline'}
                        className={cn(
                          "w-full rounded-full h-10 text-xs font-heading font-700",
                          action.priority === 'high' && "bg-orange-500 hover:bg-orange-600 text-white"
                        )}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </BusinessLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={cn("text-2xl font-heading font-800", color)}>{value}</div>
    </div>
  );
}

function FactorBox({ label, value, alert }) {
  return (
    <div className={cn("p-2 rounded-lg text-center", alert ? "bg-red-100 dark:bg-red-900/20" : "bg-muted/50")}>
      <div className={cn("font-heading font-700 text-sm", alert && "text-red-500")}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
