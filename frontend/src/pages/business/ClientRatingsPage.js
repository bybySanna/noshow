import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Send, Clock, User, Check, ChevronRight, Award, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useLang } from '../../context/LangContext';
import BusinessLayout from '../../components/BusinessLayout';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

const StarRating = ({ value, onChange, size = 'md' }) => {
  const sizeClass = size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`${sizeClass} ${star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}
          />
        </button>
      ))}
    </div>
  );
};

const RatingModal = ({ appointment, onClose, onSuccess }) => {
  const { lang } = useLang();
  const [punctuality, setPunctuality] = useState(3);
  const [politeness, setPoliteness] = useState(3);
  const [reliability, setReliability] = useState(3);
  const [overall, setOverall] = useState(3);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const submitRating = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/appointments/${appointment.id}/rate-client`, {
        punctuality,
        politeness,
        reliability,
        overall,
        comment
      });
      toast.success(lang === 'fr' ? 'Notation enregistrée !' : 'Rating saved!');
      onSuccess();
    } catch (err) {
      toast.error(lang === 'fr' ? 'Erreur lors de la notation' : 'Error saving rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border">
        <h2 className="text-lg font-heading font-700 mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400" />
          {lang === 'fr' ? 'Noter le client' : 'Rate Client'}
        </h2>
        
        <div className="bg-muted/50 rounded-xl p-4 mb-5">
          <p className="font-heading font-600">{appointment.client_name}</p>
          <p className="text-sm text-muted-foreground">{appointment.date} à {appointment.time}</p>
        </div>
        
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-heading font-600">{lang === 'fr' ? 'Ponctualité' : 'Punctuality'}</span>
            <StarRating value={punctuality} onChange={setPunctuality} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-heading font-600">{lang === 'fr' ? 'Politesse' : 'Politeness'}</span>
            <StarRating value={politeness} onChange={setPoliteness} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-heading font-600">{lang === 'fr' ? 'Fiabilité' : 'Reliability'}</span>
            <StarRating value={reliability} onChange={setReliability} />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-heading font-700">{lang === 'fr' ? 'Note globale' : 'Overall'}</span>
            <StarRating value={overall} onChange={setOverall} size="lg" />
          </div>
        </div>
        
        <div className="mb-5">
          <label className="block text-sm font-heading font-600 mb-2">
            {lang === 'fr' ? 'Commentaire (optionnel)' : 'Comment (optional)'}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={3}
            placeholder={lang === 'fr' ? 'Ajoutez une note...' : 'Add a note...'}
          />
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
            {lang === 'fr' ? 'Annuler' : 'Cancel'}
          </Button>
          <Button onClick={submitRating} disabled={loading} className="flex-1 rounded-xl bg-primary text-primary-foreground">
            {loading ? '...' : (lang === 'fr' ? 'Enregistrer' : 'Save')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function ClientRatingsPage() {
  const { lang } = useLang();
  const [unratedAppts, setUnratedAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState(null);

  useEffect(() => {
    fetchUnratedAppointments();
  }, []);

  const fetchUnratedAppointments = async () => {
    try {
      const res = await axios.get(`${API}/clients/unrated-appointments`);
      setUnratedAppts(res.data);
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BusinessLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800 flex items-center gap-3">
          <Star className="w-6 h-6 text-yellow-400" />
          {lang === 'fr' ? 'Notation Clients' : 'Client Ratings'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === 'fr' 
            ? 'Notez vos clients après leurs rendez-vous pour améliorer les prédictions ML'
            : 'Rate clients after appointments to improve ML predictions'}
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <TrendingUp className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-heading font-600 text-primary">
            {lang === 'fr' ? 'Améliorez vos prédictions' : 'Improve predictions'}
          </p>
          <p className="text-xs text-muted-foreground">
            {lang === 'fr' 
              ? 'Les notes clients sont utilisées par notre IA pour mieux prédire les risques de no-show.'
              : 'Client ratings are used by our AI to better predict no-show risks.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : unratedAppts.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <Check className="w-12 h-12 text-primary mx-auto mb-4" />
          <h3 className="font-heading font-700 text-lg mb-2">
            {lang === 'fr' ? 'Tout est noté !' : 'All rated!'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {lang === 'fr' 
              ? 'Aucun rendez-vous terminé à noter.'
              : 'No completed appointments to rate.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            {unratedAppts.length} {lang === 'fr' ? 'rendez-vous à noter' : 'appointments to rate'}
          </p>
          
          {unratedAppts.map((appt) => (
            <div
              key={appt.id}
              className="bg-card rounded-xl p-4 border border-border hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setSelectedAppt(appt)}
              data-testid={`unrated-appt-${appt.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-heading font-600">{appt.client_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {appt.date} à {appt.time}
                      {appt.service && (
                        <>
                          <span>•</span>
                          <span>{appt.service}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white">
                    <Star className="w-4 h-4 mr-1" />
                    {lang === 'fr' ? 'Noter' : 'Rate'}
                  </Button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedAppt && (
        <RatingModal
          appointment={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onSuccess={() => {
            setSelectedAppt(null);
            fetchUnratedAppointments();
          }}
        />
      )}
    </BusinessLayout>
  );
}
