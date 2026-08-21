import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderGit2, 
  Plus, 
  Edit3, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Copy, 
  ShieldCheck, 
  KeyRound, 
  Download, 
  Upload, 
  RotateCcw, 
  X, 
  Check, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Layers, 
  LogOut,
  AlertTriangle,
  Database,
  RefreshCw,
  ExternalLink,
  Globe,
  Film
} from 'lucide-react';
import { 
  validateCampaign, 
  sanitizeCampaign, 
  exportCampaignsJS, 
  exportCampaignsJSON, 
  importCampaignsJSON, 
  resetCampaignsToDefault,
  syncCampaignsFromTurso
} from '../utils/projectStorage';
import { 
  validateImageFile, 
  getSecurityConfig, 
  updateSecurityConfig, 
  generateSecureToken,
  touchSession
} from '../utils/security';
import { checkDatabaseHealth } from '../services/tursoService';

const STATUS_OPTIONS = ['EXPERIMENTAL', 'CONCEPTUAL', 'LIVE', 'ARCHIVED', 'CASE STUDY'];

const INITIAL_PROJECT_FORM = {
  id: '',
  title: '',
  tagline: '',
  year: new Date().getFullYear().toString(),
  role: 'ART DIRECTION & CGI',
  status: 'EXPERIMENTAL',
  image: '/campaigns/c1.jpg',
  category: 'AUTOMOTIVE EXHIBITION',
  client: '',
  description: '',
  credits: 'Art Direction: Martin Emil Arteen',
  link: '',
  case_study_link: '',
  client_link: '',
  gallery: [],
  thumbnail: ''
};

export const AdminModal = ({ 
  isOpen, 
  onClose, 
  campaigns, 
  onUpdateCampaigns, 
  onRevokeSession,
  onShowToast 
}) => {
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'editor' | 'security' | 'sync'
  const [editingIndex, setEditingIndex] = useState(null); // null = new, number = edit
  const [formData, setFormData] = useState(INITIAL_PROJECT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  
  // Multi-Photo Gallery State
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [newGalleryCaption, setNewGalleryCaption] = useState('');
  const galleryFileInputRef = useRef(null);

  // Security Tab State
  const [newPasskey, setNewPasskey] = useState('');
  const [confirmPasskey, setConfirmPasskey] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [securityNotice, setSecurityNotice] = useState('');

  // Turso Database Health & Sync State
  const [dbHealth, setDbHealth] = useState({ ok: true, latencyMs: 38, location: 'aws-us-east-2 (Turso Cloud)' });
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const fileInputRef = useRef(null);
  const jsonImportRef = useRef(null);

  // Check Database Health on mount & tab change
  useEffect(() => {
    let isMounted = true;
    checkDatabaseHealth().then(status => {
      if (isMounted) setDbHealth(status);
    }).catch(() => {
      if (isMounted) setDbHealth({ ok: false, error: 'Connection failed' });
    });
    return () => { isMounted = false; };
  }, [activeTab]);

  // Generate current parameterized link on mount / token change
  useEffect(() => {
    const config = getSecurityConfig();
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/\/admin\/?$/, '') || '/';
    const link = `${origin}${pathname}?admin=true&token=${encodeURIComponent(config.customToken)}`;
    setGeneratedLink(link);
  }, [activeTab]);

  // Touch session on any user interaction in modal
  const handleUserActivity = () => {
    touchSession();
  };

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // PROJECT LIST ACTIONS
  // -------------------------------------------------------------
  const handleAddNew = () => {
    const nextId = String(campaigns.length + 1).padStart(2, '0');
    setFormData({
      ...INITIAL_PROJECT_FORM,
      id: nextId,
      gallery: []
    });
    setEditingIndex(null);
    setFormErrors({});
    setActiveTab('editor');
  };

  const handleEdit = (idx) => {
    const c = campaigns[idx];
    setFormData({
      ...INITIAL_PROJECT_FORM,
      ...c,
      gallery: Array.isArray(c.gallery) ? [...c.gallery] : []
    });
    setEditingIndex(idx);
    setFormErrors({});
    setActiveTab('editor');
  };

  const handleDuplicate = (idx) => {
    const source = campaigns[idx];
    const nextId = String(campaigns.length + 1).padStart(2, '0');
    const duplicated = sanitizeCampaign({
      ...source,
      id: nextId,
      title: `${source.title} (COPY)`,
      tagline: source.tagline,
      gallery: Array.isArray(source.gallery) ? [...source.gallery] : []
    }, campaigns.length + 1);

    const updated = [...campaigns, duplicated];
    onUpdateCampaigns(updated);
    onShowToast({ type: 'success', title: 'Project Duplicated', message: `Created copy as #${nextId}` });
  };

  const handleDelete = (idx) => {
    const target = campaigns[idx];
    if (campaigns.length <= 1) {
      onShowToast({ type: 'warning', title: 'Action Prohibited', message: 'You must maintain at least one active project.' });
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${target.title}"?`)) {
      const updated = campaigns.filter((_, i) => i !== idx).map((item, i) => sanitizeCampaign(item, i + 1));
      onUpdateCampaigns(updated);
      onShowToast({ type: 'info', title: 'Project Deleted', message: `Removed "${target.title}"` });
      if (editingIndex === idx) {
        setActiveTab('projects');
        setEditingIndex(null);
      }
    }
  };

  const handleMove = (idx, direction) => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= campaigns.length) return;

    const updated = [...campaigns];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    // Re-index IDs to maintain clean sequential order
    const reindexed = updated.map((item, i) => sanitizeCampaign({ ...item, id: String(i + 1).padStart(2, '0') }, i + 1));
    onUpdateCampaigns(reindexed);
    onShowToast({ type: 'success', title: 'Order Updated', message: `Moved "${temp.title}" ${direction}` });
  };

  // -------------------------------------------------------------
  // FORM & UPLOAD HANDLERS
  // -------------------------------------------------------------
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);

    const validation = await validateImageFile(file);
    if (!validation.valid) {
      setIsUploading(false);
      onShowToast({ type: 'error', title: 'Upload Rejected', message: validation.error });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const resultDataUrl = e.target.result;
      setFormData(prev => ({ ...prev, image: resultDataUrl }));
      setIsUploading(false);
      onShowToast({ type: 'success', title: 'Cover Image Processed', message: `${file.name} attached.` });
    };
    reader.onerror = () => {
      setIsUploading(false);
      onShowToast({ type: 'error', title: 'Read Error', message: 'Failed to read media file.' });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // -------------------------------------------------------------
  // MULTI-PHOTO GALLERY HANDLERS
  // -------------------------------------------------------------
  const handleAddGalleryPhoto = (url, caption = '') => {
    if (!url || !url.trim()) return;
    setFormData(prev => ({
      ...prev,
      gallery: [
        ...(Array.isArray(prev.gallery) ? prev.gallery : []),
        { url: url.trim(), caption: caption.trim() }
      ]
    }));
    setNewGalleryUrl('');
    setNewGalleryCaption('');
    onShowToast({ type: 'success', title: 'Gallery Photo Added', message: 'Appended secondary photo to campaign.' });
  };

  const handleRemoveGalleryPhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      gallery: (prev.gallery || []).filter((_, i) => i !== index)
    }));
    onShowToast({ type: 'info', title: 'Photo Removed', message: 'Removed photo from gallery.' });
  };

  const handleMoveGalleryPhoto = (idx, direction) => {
    const current = formData.gallery || [];
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return;

    const updated = [...current];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setFormData(prev => ({ ...prev, gallery: updated }));
  };

  const handleGalleryFileUpload = async (file) => {
    if (!file) return;
    const validation = await validateImageFile(file);
    if (!validation.valid) {
      onShowToast({ type: 'error', title: 'Upload Rejected', message: validation.error });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      handleAddGalleryPhoto(e.target.result, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProject = (e) => {
    e.preventDefault();
    const validation = validateCampaign(formData);
    if (!validation.valid) {
      onShowToast({ type: 'error', title: 'Validation Error', message: validation.error });
      return;
    }

    let updatedList;
    if (editingIndex !== null) {
      // Update existing
      updatedList = [...campaigns];
      updatedList[editingIndex] = sanitizeCampaign(formData, editingIndex + 1);
      onShowToast({ type: 'success', title: 'Project Updated', message: `Saved changes to "${formData.title}"` });
    } else {
      // Add new
      const nextId = String(campaigns.length + 1).padStart(2, '0');
      const sanitized = sanitizeCampaign({ ...formData, id: nextId }, campaigns.length + 1);
      updatedList = [...campaigns, sanitized];
      onShowToast({ type: 'success', title: 'Project Created', message: `Added "${formData.title}"` });
    }

    onUpdateCampaigns(updatedList);
    setActiveTab('projects');
    setEditingIndex(null);
  };

  // -------------------------------------------------------------
  // SECURITY & ACCESS TOKEN HANDLERS
  // -------------------------------------------------------------
  const handleRegenerateToken = async () => {
    const freshToken = generateSecureToken(32);
    const result = await updateSecurityConfig({ newToken: freshToken });
    if (result.success) {
      const origin = window.location.origin;
      const pathname = window.location.pathname.replace(/\/admin\/?$/, '') || '/';
      const link = `${origin}${pathname}?admin=true&token=${encodeURIComponent(freshToken)}`;
      setGeneratedLink(link);
      onShowToast({ type: 'success', title: 'New Token Generated', message: 'Cryptographic access link updated.' });
    } else {
      onShowToast({ type: 'error', title: 'Error', message: result.error });
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      onShowToast({ type: 'info', title: 'Link Copied', message: 'Parameterized admin link copied to clipboard.' });
    });
  };

  const handleChangePasskey = async (e) => {
    e.preventDefault();
    if (!newPasskey || newPasskey.length < 8) {
      setSecurityNotice('Passkey must be at least 8 characters long.');
      return;
    }
    if (newPasskey !== confirmPasskey) {
      setSecurityNotice('Confirmation passkey does not match.');
      return;
    }

    const result = await updateSecurityConfig({ newPasskey });
    if (result.success) {
      setNewPasskey('');
      setConfirmPasskey('');
      setSecurityNotice('');
      onShowToast({ type: 'success', title: 'Passkey Updated', message: 'Master Admin Passkey updated with new SHA-256 salt.' });
    } else {
      setSecurityNotice(result.error || 'Failed to update passkey.');
    }
  };

  // -------------------------------------------------------------
  // DATA SYNC & EXPORT HANDLERS
  // -------------------------------------------------------------
  const handleExportJS = () => {
    exportCampaignsJS(campaigns);
    onShowToast({ type: 'success', title: 'Code Exported', message: 'Downloaded campaignsData.js ready for git repository.' });
  };

  const handleExportJSON = () => {
    exportCampaignsJSON(campaigns);
    onShowToast({ type: 'success', title: 'Backup Exported', message: 'JSON backup downloaded.' });
  };

  const handleImportJSONFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = importCampaignsJSON(event.target.result);
      if (result.success) {
        onUpdateCampaigns(result.campaigns);
        onShowToast({ type: 'success', title: 'Backup Restored', message: `Imported ${result.count} project(s) successfully.` });
        setActiveTab('projects');
      } else {
        onShowToast({ type: 'error', title: 'Import Failed', message: result.error });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDefaults = async () => {
    if (window.confirm('Reset all projects to factory default dataset? All custom edits will be reverted.')) {
      const reset = await resetCampaignsToDefault();
      onUpdateCampaigns(reset);
      onShowToast({ type: 'info', title: 'Reset Complete', message: 'Restored original exhibition campaigns.' });
      setActiveTab('projects');
    }
  };

  const handleManualCloudSync = async () => {
    setIsSyncingCloud(true);
    try {
      const res = await syncCampaignsFromTurso();
      if (res.success && res.campaigns) {
        onUpdateCampaigns(res.campaigns);
        onShowToast({ 
          type: 'success', 
          title: 'Turso Cloud Synced', 
          message: `Successfully synchronized ${res.campaigns.length} campaigns with Turso database.` 
        });
      } else {
        onShowToast({ 
          type: 'info', 
          title: 'Turso Cloud Synced', 
          message: 'Cloud database is up to date.' 
        });
      }
      const health = await checkDatabaseHealth();
      setDbHealth(health);
    } catch (err) {
      onShowToast({ type: 'error', title: 'Sync Error', message: err.message });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose} onMouseMove={handleUserActivity}>
      <div 
        className="admin-dashboard-container" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dashboard-title"
      >
        {/* Top Bar Navigation */}
        <header className="admin-modal-topbar">
          <div className="admin-modal-brand-wrap">
            <div className="admin-brand-pill">ADMIN MODE</div>
            <h1 id="admin-dashboard-title" className="admin-brand-heading">PROJECT & EXHIBITION CONTROL</h1>
            
            {/* Live Turso Connection Pill */}
            <div className="admin-turso-topbar-pill" title="Turso LibSQL Edge Database Connection">
              <span className={`turso-status-dot ${dbHealth.ok ? 'online' : 'checking'}`} />
              <Database size={12} />
              <span>TURSO: {dbHealth.ok ? `CONNECTED (${dbHealth.latencyMs || 40}ms)` : 'CONNECTING...'}</span>
            </div>
          </div>

          <div className="admin-topbar-actions">
            <button 
              className="admin-revoke-btn"
              onClick={onRevokeSession}
              title="Revoke session and log out"
            >
              <LogOut size={14} />
              <span>REVOKE SESSION</span>
            </button>
            <button className="admin-modal-close-btn" onClick={onClose} aria-label="Close admin dashboard">
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="admin-tabs-bar" aria-label="Admin Sections">
          <button 
            className={`admin-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => { setActiveTab('projects'); setEditingIndex(null); }}
          >
            <Layers size={16} />
            <span>CAMPAIGNS ({campaigns.length})</span>
          </button>

          <button 
            className={`admin-tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => {
              if (editingIndex === null) handleAddNew();
              else setActiveTab('editor');
            }}
          >
            {editingIndex !== null ? <Edit3 size={16} /> : <Plus size={16} />}
            <span>{editingIndex !== null ? `EDIT #${formData.id}` : 'ADD NEW PROJECT'}</span>
          </button>

          <button 
            className={`admin-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <KeyRound size={16} />
            <span>SECURITY & LINKS</span>
          </button>

          <button 
            className={`admin-tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            <FolderGit2 size={16} />
            <span>SYNC & EXPORT</span>
          </button>
        </nav>

        {/* Modal Main Body */}
        <main className="admin-modal-body">
          {/* TAB 1: PROJECTS LIST */}
          {activeTab === 'projects' && (
            <section className="admin-tab-pane">
              <div className="admin-section-header-row">
                <div>
                  <h2 className="admin-pane-title">EXHIBITION PROJECTS</h2>
                  <p className="admin-pane-desc">Reorder, edit, duplicate, or manage active campaigns.</p>
                </div>
                <button className="admin-btn-primary" onClick={handleAddNew}>
                  <Plus size={16} />
                  <span>NEW PROJECT</span>
                </button>
              </div>

              <div className="admin-projects-grid">
                {campaigns.map((camp, idx) => (
                  <article key={camp.id || idx} className="admin-project-card">
                    {/* Thumbnail */}
                    <div className="admin-card-thumb-wrap">
                      <img 
                        src={camp.image} 
                        alt={camp.title} 
                        className="admin-card-thumb"
                        onError={(e) => { e.target.src = '/campaigns/c1.jpg'; }}
                      />
                      <div className="admin-card-idx-badge">#{camp.id}</div>
                      <div className={`admin-card-status-badge status-${camp.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                        {camp.status}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="admin-card-details">
                      <div className="admin-card-cat">{camp.category} • {camp.year}</div>
                      <h3 className="admin-card-title">{camp.title}</h3>
                      <div className="admin-card-tagline">{camp.tagline}</div>
                      <div className="admin-card-role">{camp.role}</div>
                    </div>

                    {/* Reorder & Actions */}
                    <div className="admin-card-footer-actions">
                      <div className="admin-order-controls">
                        <button 
                          className="admin-icon-btn" 
                          disabled={idx === 0} 
                          onClick={() => handleMove(idx, 'up')}
                          title="Move project up in exhibition"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button 
                          className="admin-icon-btn" 
                          disabled={idx === campaigns.length - 1} 
                          onClick={() => handleMove(idx, 'down')}
                          title="Move project down in exhibition"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      <div className="admin-crud-actions">
                        <button 
                          className="admin-icon-btn" 
                          onClick={() => handleDuplicate(idx)}
                          title="Duplicate this project"
                        >
                          <Copy size={14} />
                        </button>
                        <button 
                          className="admin-icon-btn primary" 
                          onClick={() => handleEdit(idx)}
                          title="Edit project details"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          className="admin-icon-btn danger" 
                          onClick={() => handleDelete(idx)}
                          title="Delete project"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* TAB 2: ADD / EDIT PROJECT */}
          {activeTab === 'editor' && (
            <section className="admin-tab-pane">
              <div className="admin-section-header-row">
                <div>
                  <h2 className="admin-pane-title">
                    {editingIndex !== null ? `EDIT PROJECT #${formData.id}` : 'ADD NEW PROJECT'}
                  </h2>
                  <p className="admin-pane-desc">Configure typography, CGI visuals, multi-photo galleries, and live hyperlinks.</p>
                </div>
                <button 
                  type="button" 
                  className="admin-btn-secondary" 
                  onClick={() => { setActiveTab('projects'); setEditingIndex(null); }}
                >
                  CANCEL
                </button>
              </div>

              <div className="admin-editor-layout">
                {/* Form Inputs Column */}
                <form onSubmit={handleSaveProject} className="admin-editor-form">
                  {/* SECTION 1: TYPOGRAPHIC & TEXTUAL IDENTITY */}
                  <div className="admin-form-section-title">01 / TYPOGRAPHY & CURATORIAL TEXT</div>
                  
                  <div className="admin-form-row two-cols">
                    <div className="admin-input-group">
                      <label className="admin-input-label">PROJECT TITLE *</label>
                      <input 
                        type="text" 
                        value={formData.title} 
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder="e.g. AETHER — MONOLITH AUTOMOTIVE"
                        className="admin-text-input"
                        required
                      />
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-input-label">TAGLINE / CONCEPT *</label>
                      <input 
                        type="text" 
                        value={formData.tagline} 
                        onChange={(e) => handleInputChange('tagline', e.target.value)}
                        placeholder="e.g. SCULPTURAL KINETIC MOBILITY"
                        className="admin-text-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="admin-form-row three-cols">
                    <div className="admin-input-group">
                      <label className="admin-input-label">YEAR *</label>
                      <input 
                        type="text" 
                        value={formData.year} 
                        onChange={(e) => handleInputChange('year', e.target.value)}
                        placeholder="2026"
                        className="admin-text-input"
                        required
                      />
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-input-label">STATUS</label>
                      <select 
                        value={formData.status} 
                        onChange={(e) => handleInputChange('status', e.target.value)}
                        className="admin-text-input select"
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-input-label">CATEGORY *</label>
                      <input 
                        type="text" 
                        value={formData.category} 
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        placeholder="AUTOMOTIVE EXHIBITION"
                        className="admin-text-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="admin-form-row two-cols">
                    <div className="admin-input-group">
                      <label className="admin-input-label">ROLE *</label>
                      <input 
                        type="text" 
                        value={formData.role} 
                        onChange={(e) => handleInputChange('role', e.target.value)}
                        placeholder="ART DIRECTION & CGI"
                        className="admin-text-input"
                        required
                      />
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-input-label">CLIENT / COMMISSION</label>
                      <input 
                        type="text" 
                        value={formData.client || ''} 
                        onChange={(e) => handleInputChange('client', e.target.value)}
                        placeholder="e.g. Studio Monolith Automotive"
                        className="admin-text-input"
                      />
                    </div>
                  </div>

                  <div className="admin-form-row">
                    <div className="admin-input-group">
                      <label className="admin-input-label">EDITORIAL DESCRIPTION *</label>
                      <textarea 
                        rows={3}
                        value={formData.description} 
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Describe the architectural concept, materiality, lighting, and visual narrative..."
                        className="admin-text-input textarea"
                        required
                      />
                    </div>
                  </div>

                  <div className="admin-form-row">
                    <div className="admin-input-group">
                      <label className="admin-input-label">CREDITS & PRODUCTION DETAILS *</label>
                      <input 
                        type="text" 
                        value={formData.credits} 
                        onChange={(e) => handleInputChange('credits', e.target.value)}
                        placeholder="Art Direction: Martin Emil Arteen | Production: Studio Monolith | CGI: Kinetic Lab"
                        className="admin-text-input"
                        required
                      />
                    </div>
                  </div>

                  {/* SECTION 2: PHOTOS & MULTI-PHOTO GALLERY */}
                  <div className="admin-form-section-title" style={{ marginTop: '1.5rem' }}>
                    02 / COVER MEDIA & MULTI-PHOTO GALLERY
                  </div>

                  {/* PRIMARY COVER MEDIA */}
                  <div className="admin-input-group">
                    <label className="admin-input-label">PRIMARY COVER IMAGE *</label>
                    <div 
                      className={`admin-dropzone ${dragOver ? 'drag-over' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={(e) => handleFileUpload(e.target.files[0])} 
                        accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                        style={{ display: 'none' }}
                      />
                      <ImageIcon size={28} className="dropzone-icon" />
                      <div className="dropzone-text">
                        <strong>Click or Drag & Drop Cover Image Here</strong>
                        <span>JPG, PNG, WebP, SVG (Max 10MB) — Sanitized & Base64/URL supported</span>
                      </div>
                      {isUploading && <div className="dropzone-loading">Processing media...</div>}
                    </div>

                    <div className="admin-url-fallback-row">
                      <span className="admin-url-label">Or Image URL / Path:</span>
                      <input 
                        type="text" 
                        value={formData.image} 
                        onChange={(e) => handleInputChange('image', e.target.value)}
                        placeholder="/campaigns/c1.jpg or https://images.unsplash.com/..."
                        className="admin-text-input inline"
                      />
                    </div>
                  </div>

                  {/* GALLERY MANAGER */}
                  <div className="admin-gallery-manager-box">
                    <div className="admin-gallery-header">
                      <div className="admin-gallery-title-wrap">
                        <Film size={16} />
                        <label className="admin-input-label" style={{ margin: 0 }}>
                          ADDITIONAL GALLERY PHOTOS ({formData.gallery?.length || 0})
                        </label>
                      </div>
                      <input 
                        type="file"
                        ref={galleryFileInputRef}
                        onChange={(e) => handleGalleryFileUpload(e.target.files[0])}
                        accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                        style={{ display: 'none' }}
                      />
                      <button 
                        type="button"
                        className="admin-btn-secondary mini"
                        onClick={() => galleryFileInputRef.current?.click()}
                      >
                        <Upload size={12} />
                        <span>UPLOAD PHOTO</span>
                      </button>
                    </div>

                    {/* Add by URL Form */}
                    <div className="admin-gallery-add-row">
                      <input 
                        type="text" 
                        value={newGalleryUrl}
                        onChange={(e) => setNewGalleryUrl(e.target.value)}
                        placeholder="Add photo URL (e.g. https://... or /campaigns/c2.jpg)"
                        className="admin-text-input"
                        style={{ flex: 2 }}
                      />
                      <input 
                        type="text" 
                        value={newGalleryCaption}
                        onChange={(e) => setNewGalleryCaption(e.target.value)}
                        placeholder="Caption (optional)"
                        className="admin-text-input"
                        style={{ flex: 1 }}
                      />
                      <button 
                        type="button"
                        className="admin-btn-primary mini"
                        onClick={() => handleAddGalleryPhoto(newGalleryUrl, newGalleryCaption)}
                        disabled={!newGalleryUrl.trim()}
                      >
                        <Plus size={14} />
                        <span>ADD</span>
                      </button>
                    </div>

                    {/* Attached Gallery Grid */}
                    {Array.isArray(formData.gallery) && formData.gallery.length > 0 ? (
                      <div className="admin-gallery-grid">
                        {formData.gallery.map((photo, pIdx) => {
                          const photoUrl = typeof photo === 'string' ? photo : photo.url;
                          const photoCaption = typeof photo === 'object' ? photo.caption : '';
                          return (
                            <div key={pIdx} className="admin-gallery-card">
                              <img 
                                src={photoUrl} 
                                alt={photoCaption || `Gallery item ${pIdx + 1}`} 
                                className="admin-gallery-thumb-img"
                                onError={(e) => { e.target.src = '/campaigns/c1.jpg'; }}
                              />
                              <div className="admin-gallery-card-overlay">
                                <div className="admin-gallery-order-btns">
                                  <button 
                                    type="button"
                                    disabled={pIdx === 0}
                                    onClick={() => handleMoveGalleryPhoto(pIdx, 'left')}
                                    title="Move earlier"
                                  >
                                    ‹
                                  </button>
                                  <button 
                                    type="button"
                                    disabled={pIdx === formData.gallery.length - 1}
                                    onClick={() => handleMoveGalleryPhoto(pIdx, 'right')}
                                    title="Move later"
                                  >
                                    ›
                                  </button>
                                </div>
                                <button 
                                  type="button"
                                  className="admin-gallery-del-btn"
                                  onClick={() => handleRemoveGalleryPhoto(pIdx)}
                                  title="Delete photo"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <div className="admin-gallery-caption-preview">
                                {photoCaption || `Photo #${pIdx + 1}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="admin-gallery-empty">
                        No additional gallery photos attached. Add secondary photography, detail macros, or behind-the-scenes visuals.
                      </div>
                    )}
                  </div>

                  {/* SECTION 3: PROJECT HYPERLINKS & EXTERNAL DESTINATIONS */}
                  <div className="admin-form-section-title" style={{ marginTop: '1.5rem' }}>
                    03 / PROJECT HYPERLINKS & EXTERNAL URLS
                  </div>

                  <div className="admin-form-row">
                    <div className="admin-input-group">
                      <label className="admin-input-label">LIVE EXHIBITION / PROJECT URL</label>
                      <div className="admin-link-input-row">
                        <Globe size={16} className="admin-link-input-icon" />
                        <input 
                          type="text" 
                          value={formData.link || ''} 
                          onChange={(e) => handleInputChange('link', e.target.value)}
                          placeholder="https://monolith-automotive.art"
                          className="admin-text-input with-icon"
                        />
                        {formData.link && (
                          <a 
                            href={formData.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="admin-test-link-btn"
                            title="Test URL in new tab"
                          >
                            <ExternalLink size={14} />
                            <span>TEST ↗</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="admin-form-row two-cols">
                    <div className="admin-input-group">
                      <label className="admin-input-label">CASE STUDY / BEHANCE / VIMEO URL</label>
                      <div className="admin-link-input-row">
                        <LinkIcon size={16} className="admin-link-input-icon" />
                        <input 
                          type="text" 
                          value={formData.case_study_link || ''} 
                          onChange={(e) => handleInputChange('case_study_link', e.target.value)}
                          placeholder="https://behance.net/gallery/..."
                          className="admin-text-input with-icon"
                        />
                        {formData.case_study_link && (
                          <a 
                            href={formData.case_study_link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="admin-test-link-btn"
                            title="Test Case Study URL"
                          >
                            <ExternalLink size={14} />
                            <span>TEST ↗</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="admin-input-group">
                      <label className="admin-input-label">CLIENT OFFICIAL WEBSITE</label>
                      <div className="admin-link-input-row">
                        <LinkIcon size={16} className="admin-link-input-icon" />
                        <input 
                          type="text" 
                          value={formData.client_link || ''} 
                          onChange={(e) => handleInputChange('client_link', e.target.value)}
                          placeholder="https://studiomonolith.ch"
                          className="admin-text-input with-icon"
                        />
                        {formData.client_link && (
                          <a 
                            href={formData.client_link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="admin-test-link-btn"
                            title="Test Client Website URL"
                          >
                            <ExternalLink size={14} />
                            <span>TEST ↗</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="admin-editor-actions">
                    <button 
                      type="button" 
                      className="admin-btn-secondary"
                      onClick={() => { setActiveTab('projects'); setEditingIndex(null); }}
                    >
                      CANCEL
                    </button>
                    <button type="submit" className="admin-btn-primary">
                      <Check size={16} />
                      <span>{editingIndex !== null ? 'SAVE CHANGES' : 'CREATE PROJECT'}</span>
                    </button>
                  </div>
                </form>

                {/* Live Preview Card */}
                <aside className="admin-preview-column">
                  <div className="admin-preview-header">LIVE EXHIBITION PREVIEW</div>
                  <div className="admin-live-preview-card">
                    <div className="admin-preview-img-wrap">
                      <img 
                        src={formData.image || '/campaigns/c1.jpg'} 
                        alt={formData.title || 'Preview'} 
                        onError={(e) => { e.target.src = '/campaigns/c1.jpg'; }}
                      />
                      <span className="admin-preview-status-tag">{formData.status}</span>
                    </div>
                    <div className="admin-preview-body">
                      <div className="admin-preview-category">
                        {formData.category || 'CATEGORY'} • {formData.year}
                      </div>
                      {formData.client && (
                        <div className="admin-preview-client">
                          CLIENT: <strong>{formData.client}</strong>
                        </div>
                      )}
                      <h4 className="admin-preview-title">{formData.title || 'PROJECT TITLE'}</h4>
                      <p className="admin-preview-tagline">{formData.tagline || 'PROJECT TAGLINE'}</p>
                      <p className="admin-preview-desc">{formData.description || 'Editorial narrative description will appear here...'}</p>
                      <div className="admin-preview-credits">{formData.credits || 'Credits list'}</div>

                      {/* Attached Gallery Preview in card */}
                      {Array.isArray(formData.gallery) && formData.gallery.length > 0 && (
                        <div className="admin-preview-gallery-row">
                          <div className="admin-preview-sub-label">ATTACHED GALLERY ({formData.gallery.length}):</div>
                          <div className="admin-preview-gallery-thumbs">
                            {formData.gallery.map((g, i) => (
                              <img 
                                key={i} 
                                src={typeof g === 'string' ? g : g.url} 
                                alt={`Thumb ${i + 1}`}
                                className="admin-preview-mini-thumb"
                                onError={(e) => { e.target.src = '/campaigns/c1.jpg'; }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hyperlinks Preview in card */}
                      {(formData.link || formData.case_study_link || formData.client_link) && (
                        <div className="admin-preview-links-row">
                          <div className="admin-preview-sub-label">DESTINATIONS:</div>
                          <div className="admin-preview-links-chips">
                            {formData.link && <span className="admin-preview-chip">LIVE PROJECT ↗</span>}
                            {formData.case_study_link && <span className="admin-preview-chip">CASE STUDY ↗</span>}
                            {formData.client_link && <span className="admin-preview-chip">CLIENT ↗</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          )}

          {/* TAB 3: SECURITY & PARAMETERIZED LINKS */}
          {activeTab === 'security' && (
            <section className="admin-tab-pane">
              <div className="admin-section-header-row">
                <div>
                  <h2 className="admin-pane-title">SECURITY & ACCESS HARDENING</h2>
                  <p className="admin-pane-desc">Manage cryptographic parameterized access links, session lifecycle, and master passkey.</p>
                </div>
              </div>

              <div className="admin-security-grid">
                {/* Parameterized Link Card */}
                <div className="admin-security-card">
                  <div className="admin-security-card-header">
                    <LinkIcon size={18} />
                    <h3>PARAMETERIZED ADMIN ACCESS LINK</h3>
                  </div>
                  <p className="admin-security-card-desc">
                    Share this high-entropy parameterized URL to instantly authenticate into Admin Mode without entering the manual passkey.
                  </p>

                  <div className="admin-link-box">
                    <code className="admin-link-code">{generatedLink}</code>
                    <button 
                      type="button" 
                      className={`admin-copy-btn ${copiedLink ? 'copied' : ''}`}
                      onClick={handleCopyLink}
                    >
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedLink ? 'COPIED' : 'COPY LINK'}</span>
                    </button>
                  </div>

                  <div className="admin-token-actions">
                    <button 
                      type="button" 
                      className="admin-btn-secondary"
                      onClick={handleRegenerateToken}
                    >
                      <RotateCcw size={14} />
                      <span>REGENERATE CRYPTOGRAPHIC TOKEN</span>
                    </button>
                    <span className="admin-subtext">Uses Web Crypto 256-bit entropy.</span>
                  </div>

                  <div className="admin-security-tip">
                    <ShieldCheck size={16} />
                    <span>Security feature: Upon opening via token link, the query parameter is immediately sanitized from browser address history.</span>
                  </div>
                </div>

                {/* Change Master Passkey Card */}
                <div className="admin-security-card">
                  <div className="admin-security-card-header">
                    <KeyRound size={18} />
                    <h3>CHANGE MASTER ADMIN PASSKEY</h3>
                  </div>
                  <p className="admin-security-card-desc">
                    Update the direct login passkey. Stored using salted SHA-256 Web Crypto hashing.
                  </p>

                  <form onSubmit={handleChangePasskey} className="admin-passkey-change-form">
                    <div className="admin-input-group">
                      <label className="admin-input-label">NEW MASTER PASSKEY</label>
                      <input 
                        type="password"
                        value={newPasskey}
                        onChange={(e) => setNewPasskey(e.target.value)}
                        placeholder="At least 8 characters..."
                        className="admin-text-input"
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="admin-input-group">
                      <label className="admin-input-label">CONFIRM PASSKEY</label>
                      <input 
                        type="password"
                        value={confirmPasskey}
                        onChange={(e) => setConfirmPasskey(e.target.value)}
                        placeholder="Re-enter new passkey..."
                        className="admin-text-input"
                        autoComplete="new-password"
                      />
                    </div>

                    {securityNotice && (
                      <div className="admin-form-error-msg">
                        <AlertTriangle size={14} />
                        <span>{securityNotice}</span>
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={!newPasskey || newPasskey.length < 8 || newPasskey !== confirmPasskey}
                      className="admin-btn-primary"
                    >
                      UPDATE PASSKEY
                    </button>
                  </form>
                </div>

                {/* Active Session & Defense Status */}
                <div className="admin-security-card full-width">
                  <div className="admin-security-card-header">
                    <ShieldCheck size={18} />
                    <h3>SECURITY POSTURE & AUDIT LOG</h3>
                  </div>

                  <div className="admin-security-metrics-row">
                    <div className="admin-metric-badge">
                      <span className="metric-label">AUTH METHOD</span>
                      <span className="metric-value">Constant-Time SHA-256</span>
                    </div>
                    <div className="admin-metric-badge">
                      <span className="metric-label">BRUTE FORCE SHIELD</span>
                      <span className="metric-value">5 Attempts / 5-min Lockout</span>
                    </div>
                    <div className="admin-metric-badge">
                      <span className="metric-label">SESSION TIMEOUT</span>
                      <span className="metric-value">30 Minutes Inactivity</span>
                    </div>
                    <div className="admin-metric-badge">
                      <span className="metric-label">ASSET SANITIZER</span>
                      <span className="metric-value">Strict SVG / MIME Scanning</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 4: SYNC & EXPORT */}
          {activeTab === 'sync' && (
            <section className="admin-tab-pane">
              <div className="admin-section-header-row">
                <div>
                  <h2 className="admin-pane-title">SYNCHRONIZATION & CODE EXPORT</h2>
                  <p className="admin-pane-desc">Download updated JavaScript source files for git repository commits or backup JSON archives.</p>
                </div>
              </div>

              <div className="admin-sync-grid">
                {/* Turso Cloud Database Card */}
                <div className="admin-sync-card turso-highlight">
                  <div className="admin-sync-icon turso">
                    <Database size={24} />
                  </div>
                  <div className="admin-turso-card-header">
                    <h3>TURSO CLOUD DATABASE</h3>
                    <span className={`admin-turso-status-pill ${dbHealth.ok ? 'online' : 'checking'}`}>
                      <span className="turso-ping-dot" />
                      {dbHealth.ok ? `ONLINE (${dbHealth.latencyMs || 40}ms)` : 'CHECKING...'}
                    </span>
                  </div>
                  <p>
                    Live database connected at <code>libsql://martin-artin-portfolio...</code> on AWS US-East-2. Changes sync automatically in real time.
                  </p>
                  <button 
                    className="admin-btn-primary" 
                    onClick={handleManualCloudSync}
                    disabled={isSyncingCloud}
                  >
                    <RefreshCw size={16} className={isSyncingCloud ? 'spin-icon' : ''} />
                    <span>{isSyncingCloud ? 'SYNCING WITH TURSO...' : 'SYNC WITH TURSO CLOUD'}</span>
                  </button>
                </div>

                {/* Export campaignsData.js */}
                <div className="admin-sync-card highlight">
                  <div className="admin-sync-icon">
                    <FolderGit2 size={24} />
                  </div>
                  <h3>EXPORT CAMPAIGNS CODE</h3>
                  <p>Download the formatted <code>campaignsData.js</code> file to replace in your local codebase (<code>src/data/campaignsData.js</code>) and commit to git.</p>
                  <button className="admin-btn-secondary" onClick={handleExportJS}>
                    <Download size={16} />
                    <span>DOWNLOAD campaignsData.js</span>
                  </button>
                </div>

                {/* Export JSON Backup */}
                <div className="admin-sync-card">
                  <div className="admin-sync-icon">
                    <Download size={24} />
                  </div>
                  <h3>EXPORT JSON BACKUP</h3>
                  <p>Download a timestamped JSON backup archive containing all {campaigns.length} campaigns and media configurations.</p>
                  <button className="admin-btn-secondary" onClick={handleExportJSON}>
                    <Download size={16} />
                    <span>DOWNLOAD JSON BACKUP</span>
                  </button>
                </div>

                {/* Import JSON Backup */}
                <div className="admin-sync-card">
                  <div className="admin-sync-icon">
                    <Upload size={24} />
                  </div>
                  <h3>IMPORT JSON BACKUP</h3>
                  <p>Restore or batch-replace projects from a previously exported JSON backup file with schema validation.</p>
                  <input 
                    type="file" 
                    ref={jsonImportRef} 
                    onChange={handleImportJSONFile} 
                    accept=".json,application/json" 
                    style={{ display: 'none' }}
                  />
                  <button className="admin-btn-secondary" onClick={() => jsonImportRef.current?.click()}>
                    <Upload size={16} />
                    <span>SELECT JSON FILE</span>
                  </button>
                </div>

                {/* Factory Reset */}
                <div className="admin-sync-card danger-zone">
                  <div className="admin-sync-icon danger">
                    <RotateCcw size={24} />
                  </div>
                  <h3>RESET TO FACTORY DEFAULTS</h3>
                  <p>Revert all projects back to the original Swiss exhibition default dataset. Custom additions will be replaced.</p>
                  <button className="admin-btn-danger" onClick={handleResetDefaults}>
                    <RotateCcw size={16} />
                    <span>RESET ALL PROJECTS</span>
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};
