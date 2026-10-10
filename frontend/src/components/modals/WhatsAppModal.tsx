import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, CheckCircle2, X, Phone, User, Globe, AlertCircle } from 'lucide-react';
import { useStore, GridCell } from '../../store/useStore';
import { dispatchWhatsAppAlert } from '../../api/client';
import { translations } from '../../data/translations';

export default function WhatsAppModal({ unit }: { unit: GridCell | undefined }) {
  const setActiveModal = useStore((s) => s.setActiveModal);
  const lang = useStore((s) => s.lang);
  const t = translations[lang];

  const [recipientName, setRecipientName] = useState('Sardar Sukhwinder Singh (ADO)');
  const [recipientPhone, setRecipientPhone] = useState('+91-98765-43210');
  const [msgLang, setMsgLang] = useState<'en' | 'pa'>('en');
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!unit) return null;

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await dispatchWhatsAppAlert({
        unit_id: unit.id,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        language: msgLang,
      });
      setSentResult(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch WhatsApp alert.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0f1117] border border-white/15 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-emerald-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">WhatsApp Nodal Alert Dispatch</h2>
              <p className="text-white/40 text-[11px]">{unit.name} ({unit.id}) • {unit.district}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="text-white/40 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {sentResult ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-white font-semibold text-sm">WhatsApp Alert Dispatched!</h3>
              <p className="text-white/60 text-xs">
                Notification successfully delivered to {recipientName} ({recipientPhone}).
              </p>
              <div className="text-[10px] text-white/40 font-mono pt-1">
                Receipt ID: {sentResult.dispatch?.dispatch_id} • Status: {sentResult.dispatch?.status}
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="mt-3 px-4 py-1.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Officer Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 flex items-center gap-1.5 mb-1">
                    <User className="w-3 h-3 text-cyan-400" />
                    Nodal Officer / BDO Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-white/60 flex items-center gap-1.5 mb-1">
                    <Phone className="w-3 h-3 text-emerald-400" />
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
              </div>

              {/* Message Language Switcher */}
              <div className="flex items-center justify-between bg-white/[0.03] p-2 rounded-lg border border-white/5">
                <span className="text-white/60 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  Message Language
                </span>
                <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-md border border-white/10">
                  <button
                    onClick={() => setMsgLang('en')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      msgLang === 'en' ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setMsgLang('pa')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      msgLang === 'pa' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    ਪੰਜਾਬੀ (Punjabi)
                  </button>
                </div>
              </div>

              {/* Message Preview */}
              <div>
                <label className="text-white/40 uppercase tracking-wider text-[10px] block mb-1.5">
                  Live Dispatch Preview
                </label>
                <div className="bg-black/60 border border-white/10 rounded-xl p-3 font-mono text-[11px] text-white/80 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {msgLang === 'en' ? (
                    <>
                      🚨 *PARALI ALERT: PRE-FIRE INTERVENTION DISPATCH*{'\n'}
                      📍 *Unit:* {unit.name} ({unit.id}){'\n'}
                      🏢 *District:* {unit.district} | *Priority Score:* {(unit.risk_score * 100).toFixed(0)}/100{'\n'}
                      ⚠️ *Category:* {unit.risk_level}{'\n'}
                      🌾 *Residue at Risk:* {unit.unburned_residue_ha || 320} ha{'\n'}
                      🚜 *Recommended Action:* {unit.recommended_action || 'Deploy Super Seeder / Baler'}{'\n'}
                      ⏱️ *Urgency:* {unit.recommended_urgency || 'HIGH'}{'\n'}
                      🗺️ *GPS Link:* https://maps.google.com/?q={unit.centroid[1]},{unit.centroid[0]}
                    </>
                  ) : (
                    <>
                      🚨 *ਪਰਾਲੀ ਅਲਰਟ: ਅੱਗ ਲੱਗਣ ਤੋਂ ਪਹਿਲਾਂ ਰੋਕਥਾਮ ਸੂਚਨਾ*{'\n'}
                      📍 *ਯੂਨਿਟ:* {unit.name} ({unit.id}){'\n'}
                      🏢 *ਜ਼ਿਲ੍ਹਾ:* {unit.district} | *ਤਰਜੀਹ ਸਕੋਰ:* {(unit.risk_score * 100).toFixed(0)}/100{'\n'}
                      ⚠️ *ਸ਼੍ਰੇਣੀ:* {unit.risk_level}{'\n'}
                      🌾 *ਜੋਖਮ ਅਧੀਨ ਰਹਿੰਦ-ਖੂੰਹਦ:* {unit.unburned_residue_ha || 320} ਹੈਕਟੇਅਰ{'\n'}
                      🚜 *ਸਿਫਾਰਸ਼ੀ ਕਾਰਵਾਈ:* ਸੁਪਰ ਸੀਡਰ ਜਾਂ ਬੇਲਰ ਤੁਰੰਤ ਭੇਜੋ{'\n'}
                      ⏱️ *ਜ਼ਰੂਰੀ ਪੱਧਰ:* ਤੁਰੰਤ ਕਾਰਵਾਈ ਲੋੜੀਂਦੀ{'\n'}
                      🗺️ *ਲਾਈਵ ਨਕਸ਼ਾ ਲਿੰਕ:* https://maps.google.com/?q={unit.centroid[1]},{unit.centroid[0]}
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setActiveModal('none')}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Sending...' : 'Dispatch Alert'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
