import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserCheck, Send, CheckCircle2, X, Tractor, MapPin, Phone, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { submitFarmerReport, fetchFarmerReports } from '../../api/client';
import { translations } from '../../data/translations';

export default function FarmerReportModal() {
  const setActiveModal = useStore((s) => s.setActiveModal);
  const lang = useStore((s) => s.lang);
  const t = translations[lang];
  const grids = useStore((s) => s.grids);

  const [farmerName, setFarmerName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('Sangrur');
  const [unitId, setUnitId] = useState(grids[0]?.id || 'SAN-01');
  const [village, setVillage] = useState('');
  const [landArea, setLandArea] = useState('8.5');
  const [harvestStatus, setHarvestStatus] = useState('HARVESTED_YESTERDAY');
  const [residueAction, setResidueAction] = useState('SUPER_SEEDER_NEEDED');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFarmerReports()
      .then((res) => setPastReports(res.reports || []))
      .catch(() => {});
  }, [submitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmerName || !phone || !village) {
      setError('Please fill in Farmer Name, Phone Number, and Village.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitFarmerReport({
        farmer_name: farmerName,
        phone,
        district,
        unit_id: unitId,
        village,
        land_area_acres: parseFloat(landArea) || 5.0,
        crop_type: 'Paddy (PR-126)',
        harvest_status: harvestStatus,
        residue_action: residueAction,
        machinery_requested: residueAction.includes('NEEDED') || residueAction.includes('REQUESTED'),
        notes,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0f1117] border border-white/15 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-amber-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Tractor className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">
                {lang === 'pa' ? 'ਕਿਸਾਨ ਸਵੈ-ਰਿਪੋਰਟਿੰਗ ਅਤੇ ਮਸ਼ੀਨਰੀ ਪੋਰਟਲ' : 'Farmer Ground-Truth Reporting Portal'}
              </h2>
              <p className="text-white/40 text-[11px]">
                {lang === 'pa' ? 'ਕਟਾਈ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ ਅਤੇ ਸੀਆਰਐਮ ਮਸ਼ੀਨਰੀ ਦੀ ਮੰਗ ਦਰਜ ਕਰੋ' : 'Validate harvest completion & request CRM machinery'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="text-white/40 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {submitted ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-white font-semibold text-sm">
                {lang === 'pa' ? 'ਰਿਪੋਰਟ ਸਫਲਤਾਪੂਰਵਕ ਦਰਜ ਕੀਤੀ ਗਈ!' : 'Ground-Truth Report Registered!'}
              </h3>
              <p className="text-white/70 text-xs">
                {lang === 'pa'
                  ? 'ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ ਬਲਾਕ ਖੇਤੀਬਾੜੀ ਦਫ਼ਤਰ (ADO) ਨੂੰ ਭੇਜ ਦਿੱਤੀ ਗਈ ਹੈ ਅਤੇ ਉਪਗ੍ਰਹਿ ਡਾਟਾ ਕੈਲੀਬ੍ਰੇਟ ਹੋ ਗਿਆ ਹੈ।'
                  : 'Your ground truth has calibrated the satellite model, and machinery request has been queued for your ADO.'}
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-3 px-4 py-1.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors"
              >
                Submit Another Report
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 mb-1 block">
                    {lang === 'pa' ? 'ਕਿਸਾਨ ਦਾ ਨਾਂ' : 'Farmer Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gurpreet Singh"
                    value={farmerName}
                    onChange={(e) => setFarmerName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-white/60 mb-1 block">
                    {lang === 'pa' ? 'ਫ਼ੋਨ ਨੰਬਰ' : 'Phone Number'} *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 00000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-white/60 mb-1 block">
                    {lang === 'pa' ? 'ਜ਼ਿਲ੍ਹਾ' : 'District'}
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full bg-[#161a22] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Sangrur">Sangrur</option>
                    <option value="Ludhiana">Ludhiana</option>
                    <option value="Bathinda">Bathinda</option>
                    <option value="Tarn Taran">Tarn Taran</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/60 mb-1 block">
                    {lang === 'pa' ? 'ਯੂਨਿਟ' : 'Unit ID'}
                  </label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full bg-[#161a22] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400 font-mono"
                  >
                    {grids.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.id} ({g.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-white/60 mb-1 block">
                    {lang === 'pa' ? 'ਪਿੰਡ' : 'Village'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mehlan"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 mb-1 block">
                    {lang === 'pa' ? 'ਰਕਬਾ (ਏਕੜ)' : 'Land Area (Acres)'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={landArea}
                    onChange={(e) => setLandArea(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-white/60 mb-1 block">
                    {lang === 'pa' ? 'ਕਟਾਈ ਦੀ ਸਥਿਤੀ' : 'Harvest Status'}
                  </label>
                  <select
                    value={harvestStatus}
                    onChange={(e) => setHarvestStatus(e.target.value)}
                    className="w-full bg-[#161a22] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="HARVESTED_YESTERDAY">Harvested Yesterday (ਕੱਲ ਕਟਾਈ ਹੋਈ)</option>
                    <option value="HARVESTED_WITHIN_3D">Harvested 2-3 Days Ago (2-3 ਦਿਨ ਪਹਿਲਾਂ)</option>
                    <option value="HARVEST_TOMORROW">Harvesting in 24-48h (ਕੱਲ ਕਟਾਈ ਹੋਵੇਗੀ)</option>
                    <option value="STANDING_CROP">Still Standing (ਖੜੀ ਫਸਲ)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-white/60 mb-1 block">
                  {lang === 'pa' ? 'ਮਸ਼ੀਨਰੀ / ਰਹਿੰਦ-ਖੂੰਹਦ ਕਾਰਵਾਈ' : 'CRM Machinery Request'}
                </label>
                <select
                  value={residueAction}
                  onChange={(e) => setResidueAction(e.target.value)}
                  className="w-full bg-[#161a22] border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="SUPER_SEEDER_NEEDED">Super Seeder Needed (ਸੁਪਰ ਸੀਡਰ ਚਾਹੀਦਾ ਹੈ)</option>
                  <option value="BALER_REQUESTED">Baler Machine Needed for Ex-situ (ਬੇਲਰ ਚਾਹੀਦਾ ਹੈ)</option>
                  <option value="HAPPY_SEEDER_BOOKED">Happy Seeder Already Booked (ਬੁੱਕ ਕੀਤਾ ਹੋਇਆ ਹੈ)</option>
                  <option value="BIO_DECOMPOSER_SPRAY">Bio-Decomposer Spray Planned (ਸਪਰੇਅ ਯੋਜਨਾ)</option>
                </select>
              </div>

              <div>
                <label className="text-white/60 mb-1 block">
                  {lang === 'pa' ? 'ਵਾਧੂ ਵੇਰਵੇ / ਟਿੱਪਣੀ' : 'Additional Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Urgent machinery dispatch needed before wheat sowing..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal('none')}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Submitting...' : 'Register Report'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Past Community Reports */}
          {pastReports.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <h4 className="text-white/40 uppercase tracking-wider text-[10px] mb-2 flex items-center justify-between">
                <span>Recent Community Ground Truth ({pastReports.length})</span>
                <span className="text-emerald-400 font-mono">ADO VERIFIED</span>
              </h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {pastReports.slice(0, 5).map((r, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/5 rounded-lg p-2 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{r.farmer_name} • {r.village}</div>
                      <div className="text-[10px] text-white/40">{r.district} ({r.unit_id}) • {r.land_area_acres} acres</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                      {r.residue_action.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
