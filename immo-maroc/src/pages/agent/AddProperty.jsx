import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Upload, X, MapPin, Home, FileText, Image, Link2, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CITIES, TYPES } from '../../data/properties';
import { useTranslation } from 'react-i18next';
import { createProperty, updateProperty, getPropertyById, uploadPropertyImage, getImageUrl } from '../../api/properties';
import Spinner from '../../components/common/Spinner';

const FEATURES_LIST = [
  'Piscine', 'Jardin', 'Terrasse', 'Parking', 'Ascenseur', 'Gardien',
  'Climatisation', 'Chauffage central', 'Double vitrage', 'Cuisine équipée',
  'Interphone', 'Digicode', 'Cave', 'Balcon', 'Vue mer', 'Vue montagne',
];

// Backend enums (MAJUSCULES)
const BACKEND_TYPES    = ['APPARTEMENT', 'VILLA', 'RIAD', 'BUREAU', 'COMMERCE', 'TERRAIN', 'MAISON', 'DUPLEX', 'STUDIO'];
const BACKEND_PURPOSES = ['VENTE', 'LOCATION'];
const BACKEND_STATUSES = ['DISPONIBLE', 'VENDU', 'LOUE'];

const SUB_PURPOSES = {
  VENTE:    [{ value: 'NEUF',        label: 'Neuf'        }, { value: 'OCCASION',   label: 'Occasion'    }],
  LOCATION: [{ value: 'COURT_TERME', label: 'Court terme' }, { value: 'LONG_TERME', label: 'Long terme'  }],
};

const defaultForm = {
  title: '', type: '', purpose: 'VENTE', subPurpose: 'NEUF', city: '', neighborhood: '',
  price: '', area: '', rooms: '', bathrooms: '', floor: '',
  parking: false, elevator: false, furnished: false,
  description: '', features: [], imageFiles: [], imageUrls: [], status: 'DISPONIBLE',
};

export default function AddProperty() {
  const { user } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const fileInputRef = useRef(null);

  const [form, setForm]         = useState(defaultForm);
  const [step, setStep]         = useState(1);
  const [errors, setErrors]     = useState({});
  const [success, setSuccess]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!id);

  // If editing, load existing property
  useEffect(() => {
    if (!id) return;
    getPropertyById(id)
      .then(data => {
        setForm({
          title: data.title || '',
          type: data.type || '',
          purpose: data.purpose || 'VENTE',
          subPurpose: data.subPurpose || (data.purpose === 'LOCATION' ? 'COURT_TERME' : 'NEUF'),
          city: data.city || '',
          neighborhood: data.neighborhood || '',
          price: data.price || '',
          area: data.area || '',
          rooms: data.rooms || '',
          bathrooms: data.bathrooms || '',
          floor: data.floor || '',
          parking: data.parking || false,
          elevator: data.elevator || false,
          furnished: data.furnished || false,
          description: data.description || '',
          features: data.features || [],
          imageFiles: [],
          imageUrls: Array.isArray(data.images) ? data.images.map(img => img.url || img) : [],
          status: data.status || 'DISPONIBLE',
        });
      })
      .catch(() => { /* ignore, use defaults */ })
      .finally(() => setLoadingExisting(false));
  }, [id]);

  const STEPS = [
    { id: 1, label: t('agent.addProperty.step1Label'), icon: Home },
    { id: 2, label: t('agent.addProperty.step2Label'), icon: MapPin },
    { id: 3, label: t('agent.addProperty.step3Label'), icon: FileText },
    { id: 4, label: t('agent.addProperty.step4Label'), icon: Image },
  ];

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const toggleFeature = (f) => set('features', form.features.includes(f) ? form.features.filter(x => x !== f) : [...form.features, f]);

  // ── Image helpers ─────────────────────────────────────────────
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const addFiles = useCallback((files) => {
    const oversized = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setSubmitError(`Fichier trop volumineux : "${oversized[0].name}". La taille maximale est 10 MB.`);
      return;
    }
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    const total = form.imageFiles.length + form.imageUrls.length;
    const allowed = valid.slice(0, 10 - total);
    setForm(p => ({ ...p, imageFiles: [...p.imageFiles, ...allowed] }));
  }, [form.imageFiles, form.imageUrls]);

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const total = form.imageFiles.length + form.imageUrls.length;
    if (total >= 10) return;
    setForm(p => ({ ...p, imageUrls: [...p.imageUrls, trimmed] }));
    setUrlInput('');
    setShowUrlInput(false);
  };

  const removeFile  = (i) => setForm(p => ({ ...p, imageFiles: p.imageFiles.filter((_, idx) => idx !== i) }));
  const removeUrl   = (i) => setForm(p => ({ ...p, imageUrls: p.imageUrls.filter((_, idx) => idx !== i) }));

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.title) e.title = t('agent.addProperty.errTitle');
      if (!form.type)  e.type  = t('agent.addProperty.errType');
      if (!form.city)  e.city  = t('agent.addProperty.errCity');
    }
    if (step === 2) {
      if (!form.price) e.price = t('agent.addProperty.errPrice');
      if (!form.area)  e.area  = t('agent.addProperty.errArea');
      if (!form.rooms) e.rooms = t('agent.addProperty.errRooms');
    }
    if (step === 3) {
      if (!form.description || form.description.length < 30) e.description = t('agent.addProperty.errDesc');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => { if (validate()) setStep(s => Math.min(s + 1, 4)); };
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      // 1. Upload local image files one by one → get URLs
      const uploadedUrls = [];
      for (const file of form.imageFiles) {
        const res = await uploadPropertyImage(file);
        uploadedUrls.push(res.url);
      }

      // 2. Combine uploaded URLs + URL-based images
      const allUrls = [...uploadedUrls, ...form.imageUrls];
      const images = allUrls.map((url, i) => ({
        url,
        isMain: i === 0,
        displayOrder: i,
      }));

      // 3. Build JSON body
      const body = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        city: form.city,
        neighborhood: form.neighborhood || '',
        area: Number(form.area),
        type: form.type,
        purpose: form.purpose,
        subPurpose: form.subPurpose,
        rooms: Number(form.rooms),
        bathrooms: Number(form.bathrooms) || 1,
        floor: form.floor ? Number(form.floor) : 0,
        parking: form.parking,
        elevator: form.elevator,
        furnished: form.furnished,
        status: form.status,
        features: form.features,
        images,
      };

      if (id) {
        await updateProperty(id, body);
      } else {
        await createProperty(body);
      }
      setSuccess(true);
      setTimeout(() => navigate('/agent/annonces'), 2500);
    } catch (err) {
      setSubmitError(err.message || 'Erreur lors de la publication.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingExisting) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  if (success) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            {id ? t('agent.addProperty.updatedTitle') : t('agent.addProperty.publishedTitle')}
          </h2>
          <p className="text-neutral-500 dark:text-slate-400 text-sm">{t('agent.addProperty.redirecting')}</p>
        </div>
      </div>
    );
  }

  const allImages = [
    ...form.imageFiles.map(f => URL.createObjectURL(f)),
    ...form.imageUrls,
  ];

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-neutral-900">
          {id ? t('agent.addProperty.titleEdit') : t('agent.addProperty.titleAdd')}
        </h1>
        <p className="text-neutral-500 text-sm mt-0.5">{t('agent.addProperty.stepOf', { step })}</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map(({ id: sId, label, icon: Icon }, i) => (
          <div key={sId} className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => step > sId && setStep(sId)}
              className={`flex items-center gap-2 shrink-0 transition-colors ${step === sId ? 'text-primary' : step > sId ? 'text-emerald-600 cursor-pointer' : 'text-neutral-300 dark:text-slate-600'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${step === sId ? 'bg-primary text-white' : step > sId ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-neutral-100 dark:bg-slate-800 text-neutral-400 dark:text-slate-600'}`}>
                {step > sId ? <CheckCircle2 size={14} /> : sId}
              </div>
              <span className="hidden sm:inline text-xs font-medium">{label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${step > sId ? 'bg-emerald-300 dark:bg-emerald-800' : 'bg-neutral-200 dark:bg-slate-700'}`} />}
          </div>
        ))}
      </div>

      {submitError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">{submitError}</div>
      )}

      {/* Form card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card dark:border dark:border-slate-800 p-6 space-y-5">
        {/* Step 1: Basic info */}
        {step === 1 && (
          <>
            <h2 className="font-semibold text-neutral-800">{t('agent.addProperty.step1Title')}</h2>
            <div className="form-group">
              <label className="form-label">{t('agent.addProperty.titleLabel')}</label>
              <input type="text" className="form-input" placeholder={t('agent.addProperty.titlePlaceholder')} value={form.title} onChange={e => set('title', e.target.value)} />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="form-group">
                <label className="form-label">{t('agent.addProperty.typeLabel')}</label>
                <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
                  <option value="">{t('agent.addProperty.typeSelect')}</option>
                  {BACKEND_TYPES.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                </select>
                {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('agent.addProperty.transactionLabel')}</label>
                <div className="flex rounded-xl border border-neutral-200 dark:border-slate-700 overflow-hidden mb-2">
                  {BACKEND_PURPOSES.map(p => (
                    <button key={p} type="button"
                      onClick={() => { set('purpose', p); set('subPurpose', p === 'VENTE' ? 'NEUF' : 'COURT_TERME'); }}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${form.purpose === p ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 text-neutral-500 dark:text-slate-400 hover:bg-neutral-50 dark:hover:bg-slate-700'}`}>
                      {t(`common.purpose.${p}`, p)}
                    </button>
                  ))}
                </div>
                {/* Sub-purpose options */}
                <div className="flex gap-2">
                  {SUB_PURPOSES[form.purpose].map(({ value, label }) => (
                    <button key={value} type="button"
                      onClick={() => set('subPurpose', value)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        form.subPurpose === value
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 text-neutral-500 dark:text-slate-400 hover:border-neutral-300 dark:hover:border-slate-600'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="form-group">
                <label className="form-label">{t('agent.addProperty.cityLabel')}</label>
                <select className="form-select" value={form.city} onChange={e => set('city', e.target.value)}>
                  <option value="">{t('agent.addProperty.typeSelect')}</option>
                  {CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('agent.addProperty.neighborhoodLabel')}</label>
                <input type="text" className="form-input" placeholder={t('agent.addProperty.neighborhoodPlaceholder')} value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('agent.addProperty.statusLabel')}</label>
              <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                {BACKEND_STATUSES.map(s => <option key={s} value={s}>{t(`common.status.${s}`, s)}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <>
            <h2 className="font-semibold text-neutral-800">{t('agent.addProperty.step2Title')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="form-group">
                <label className="form-label">{t('agent.addProperty.priceLabel')}</label>
                <input type="number" className="form-input" placeholder={t('agent.addProperty.pricePlaceholder')} value={form.price} onChange={e => set('price', e.target.value)} />
                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('agent.addProperty.areaLabel')}</label>
                <input type="number" className="form-input" placeholder={t('agent.addProperty.areaPlaceholder')} value={form.area} onChange={e => set('area', e.target.value)} />
                {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">{t('agent.addProperty.roomsLabel')}</label>
                <input type="number" className="form-input" placeholder="3" value={form.rooms} onChange={e => set('rooms', e.target.value)} />
                {errors.rooms && <p className="text-red-500 text-xs mt-1">{errors.rooms}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('agent.addProperty.bathroomsLabel')}</label>
                <input type="number" className="form-input" placeholder="2" value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('agent.addProperty.floorLabel')}</label>
                <input type="number" className="form-input" placeholder="0" value={form.floor} onChange={e => set('floor', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-6">
              {[['parking', t('agent.addProperty.parkingLabel')], ['elevator', t('agent.addProperty.elevatorLabel')], ['furnished', t('agent.addProperty.furnishedLabel')]].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} className="w-4 h-4 rounded text-primary" />
                  <span className="text-sm text-neutral-700">{l}</span>
                </label>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">{t('agent.addProperty.featuresLabel')}</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {FEATURES_LIST.map(f => (
                  <button key={f} type="button" onClick={() => toggleFeature(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.features.includes(f) ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 text-neutral-600 dark:text-slate-400 hover:border-neutral-300 dark:hover:border-slate-600'
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 3: Description */}
        {step === 3 && (
          <>
            <h2 className="font-semibold text-neutral-800">{t('agent.addProperty.step3Title')}</h2>
            <div className="form-group">
              <label className="form-label">{t('agent.addProperty.descLabel')}</label>
              <textarea rows={6} className="form-textarea" placeholder={t('agent.addProperty.descPlaceholder')} value={form.description} onChange={e => set('description', e.target.value)} />
              <div className="flex items-center justify-between mt-1">
                {errors.description ? <p className="text-red-500 text-xs">{errors.description}</p> : <span />}
                <span className="text-xs text-neutral-400">{form.description.length} / 1000</span>
              </div>
            </div>
          </>
        )}

        {/* Step 4: Photos */}
        {step === 4 && (
          <>
            <h2 className="font-semibold text-neutral-800">{t('agent.addProperty.step4Title')}</h2>
            <p className="text-neutral-500 text-sm">Glissez-déposez ou importez depuis votre PC. Max 10 photos · JPG, PNG, WEBP.</p>

            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 sm:p-8 text-center cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-neutral-200 dark:border-slate-700 hover:border-primary hover:bg-neutral-50 dark:hover:bg-slate-800'}`}
            >
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Upload size={24} className="text-primary" />
              </div>
              <p className="font-semibold text-neutral-700 text-sm">{dragging ? 'Déposez ici…' : 'Cliquez ou glissez vos photos ici'}</p>
              <p className="text-neutral-400 text-xs mt-1">JPG, PNG, WEBP — Max 10 photos</p>
              <div className="mt-4 inline-flex items-center gap-2 bg-primary text-white text-xs font-medium px-4 py-2 rounded-full">
                <Upload size={12} /> Choisir depuis le PC
              </div>
            </div>

            {/* URL input */}
            <div>
              {!showUrlInput ? (
                <button type="button" onClick={() => setShowUrlInput(true)} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Link2 size={14} /> Ajouter via URL
                </button>
              ) : (
                <div className="flex gap-2">
                  <input type="url" className="form-input flex-1 text-sm" placeholder="https://..."
                    value={urlInput} onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUrl())} autoFocus />
                  <button type="button" onClick={addUrl} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90">Ajouter</button>
                  <button type="button" onClick={() => { setShowUrlInput(false); setUrlInput(''); }} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-xl"><X size={16} /></button>
                </div>
              )}
            </div>

            {/* Preview grid */}
            {allImages.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 mb-3">{allImages.length} photo{allImages.length > 1 ? 's' : ''} — La première est la photo principale</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {form.imageFiles.map((file, i) => (
                    <div key={`file-${i}`} className={`relative group rounded-xl overflow-hidden aspect-video bg-neutral-100 ${i === 0 && form.imageUrls.length === 0 ? 'ring-2 ring-primary' : ''}`}>
                      <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                      {i === 0 && form.imageUrls.length === 0 && (
                        <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Principal</div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button type="button" onClick={() => removeFile(i)} className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {form.imageUrls.map((url, i) => (
                    <div key={`url-${i}`} className={`relative group rounded-xl overflow-hidden aspect-video bg-neutral-100 ${i === 0 && form.imageFiles.length === 0 ? 'ring-2 ring-primary' : ''}`}>
                      <img src={getImageUrl(url)} alt="" className="w-full h-full object-cover" onError={e => { e.target.src = 'https://placehold.co/300x200'; }} />
                      {i === 0 && form.imageFiles.length === 0 && (
                        <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Principal</div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button type="button" onClick={() => removeUrl(i)} className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {allImages.length < 10 && (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="aspect-video rounded-xl border-2 border-dashed border-neutral-200 hover:border-primary hover:bg-neutral-50 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:text-primary transition-all">
                      <Upload size={18} />
                      <span className="text-xs font-medium">Ajouter</span>
                    </button>
                  )}
                </div>
              </div>
            )}
            {allImages.length === 0 && (
              <p className="text-center text-xs text-neutral-400 italic">Aucune photo ajoutée — une image par défaut sera utilisée</p>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevStep} disabled={step === 1} className="btn-outline text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          {t('agent.addProperty.previous')}
        </button>
        {step < 4 ? (
          <button onClick={nextStep} className="btn-primary text-sm">
            {t('agent.addProperty.next')} <ChevronRight size={15} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm disabled:opacity-60">
            {submitting ? <Spinner size="sm" /> : <><CheckCircle2 size={15} /> {id ? t('agent.addProperty.update') : t('agent.addProperty.publish')}</>}
          </button>
        )}
      </div>
    </div>
  );
}
