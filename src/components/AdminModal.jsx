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
  Film,
  Activity
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
import { validateImageFile } from '../utils/security';
import { api } from '../services/api';

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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasskey, setNewPasskey] = useState('');
  const [confirmPasskey, setConfirmPasskey] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [securityNotice, setSecurityNotice] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Turso Database Health & Sync State
  const [dbHealth, setDbHealth] = useState({ ok: true, checking: false, latencyMs: 38, location: 'aws-us-east-2 (Turso Cloud)' });
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const fileInputRef = useRef(null);
  const jsonImportRef = useRef(null);

  // Check Database Health on mount & tab change
  const refreshDbHealth = React.useCallback(async () => {
    setDbHealth(prev => ({ ...prev, checking: true }));
    try {
      const status = await api.getHealth();
      setDbHealth({ 
        ok: status.healthy, 
        checking: false, 
        latencyMs: status.latencyMs || 40,
        campaignsCount: status.campaignsCount
      });
    } catch {
      setDbHealth({ ok: false, checking: false, error: 'Connection failed' });
    }
  }, []);

  // Fetch Audit Logs when Security tab is active
  const fetchAuditLogs = React.useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await api.getAuditLogs();
      if (res && Array.isArray(res.logs)) {
        setAuditLogs(res.logs);
      }
    } catch (err) {
      console.warn('Could not load audit logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshDbHealth();
      if (activeTab === 'security') {
        fetchAuditLogs();
      }
    }
  }, [isOpen, activeTab, refreshDbHealth, fetchAuditLogs]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const handleDuplicate = async (idx) => {
    const source = campaigns[idx];
    const nextId = String(campaigns.length + 1).padStart(2, '0');
    const duplicated = sanitizeCampaign({
      ...source,
      id: nextId,
      title: `${source.title} (COPY)`,
      tagline: source.tagline,
      gallery: Array.isArray(source.gallery) ? [...source.gallery] : []
    }, campaigns.length + 1);

    try {
      await api.createCampaign(duplicated);
      const updated = [...campaigns, duplicated];
      onUpdateCampaigns(updated);
      onShowToast({ type: 'success', title: 'Project Duplicated', message: `Created copy as #${nextId}` });
    } catch (err) {
      onShowToast({ type: 'error', title: 'Duplicate Error', message: err.message });
    }
  };

  const handleDelete = async (idx) => {
    const target = campaigns[idx];
    if (campaigns.length <= 1) {
      onShowToast({ type: 'warning', title: 'Action Prohibited', message: 'You must maintain at least one active project.' });
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${target.title}"?`)) {
      try {
        await api.deleteCampaign(target.id);
        const updated = campaigns.filter((_, i) => i !== idx).map((item, i) => sanitizeCampaign(item, i + 1));
        onUpdateCampaigns(updated);
        onShowToast({ type: 'info', title: 'Project Deleted', message: `Removed "${target.title}"` });
        if (editingIndex === idx) {
          setActiveTab('projects');
          setEditingIndex(null);
        }
      } catch (err) {
        onShowToast({ type: 'error', title: 'Delete Error', message: err.message });
      }
    }
  };

  const handleMove = async (idx, direction) => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= campaigns.length) return;

    const updated = [...campaigns];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    const reindexed = updated.map((item, i) => sanitizeCampaign({ ...item, id: String(i + 1).padStart(2, '0') }, i + 1));
    onUpdateCampaigns(reindexed);

    try {
      await api.reorderCampaigns(reindexed.map(c => Number(c.id)));
      onShowToast({ type: 'success', title: 'Order Updated', message: `Moved "${temp.title}" ${direction}` });
    } catch (err) {
      onShowToast({ type: 'error', title: 'Reorder Sync Error', message: err.message });
    }
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
        { id: `g_${Date.now()}`, url: url.trim(), caption: caption.trim() }
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

  const handleSaveProject = async (e) => {
    e.preventDefault();
    const validation = validateCampaign(formData);
    if (!validation.valid) {
      onShowToast({ type: 'error', title: 'Validation Error', message: validation.error });
      return;
    }

    try {
      let updatedList;
      if (editingIndex !== null) {
        // Update existing via Server API
        const sanitized = sanitizeCampaign(formData, editingIndex + 1);
        await api.updateCampaign(sanitized);
        updatedList = [...campaigns];
        updatedList[editingIndex] = sanitized;
        onShowToast({ type: 'success', title: 'Project Updated', message: `Saved changes to "${formData.title}"` });
      } else {
        // Add new via Server API
        const nextId = String(campaigns.length + 1).padStart(2, '0');
        const sanitized = sanitizeCampaign({ ...formData, id: nextId }, campaigns.length + 1);
        await api.createCampaign(sanitized);
        updatedList = [...campaigns, sanitized];
        onShowToast({ type: 'success', title: 'Project Created', message: `Added "${formData.title}"` });
      }

      onUpdateCampaigns(updatedList);
      setActiveTab('projects');
      setEditingIndex(null);
    } catch (err) {
      onShowToast({ type: 'error', title: 'Save Error', message: err.message });
    }
  };

  // -------------------------------------------------------------
  // SECURITY & ACCESS TOKEN HANDLERS
  // -------------------------------------------------------------
  const handleGenerateAccessLink = async () => {
    try {
      const res = await api.generateAccessLink();
      if (res.success && res.token) {
        const origin = window.location.origin;
        const pathname = window.location.pathname.replace(/\/admin\/?$/, '') || '/';
        const link = `${origin}${pathname}?access_token=${encodeURIComponent(res.token)}`;
        setGeneratedLink(link);
        onShowToast({ 
          type: 'success', 
          title: 'Single-Use Link Generated', 
          message: 'Valid for 10 minutes. Single-use cryptographic access token.' 
        });
      }
    } catch (err) {
      onShowToast({ type: 'error', title: 'Generation Failed', message: err.message });
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      onShowToast({ type: 'info', title: 'Link Copied', message: 'Single-use admin link copied to clipboard.' });
    });
  };

  const handleChangePasskey = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setSecurityNotice('Please enter your current administrator password.');
      return;
    }
    if (!newPasskey || newPasskey.length < 12) {
      setSecurityNotice('New password must be at least 12 characters long.');
      return;
    }
    if (newPasskey !== confirmPasskey) {
      setSecurityNotice('Confirmation password does not match.');
      return;
    }

    try {
      const result = await api.changePassword(currentPassword, newPasskey);
      if (result.success) {
        setCurrentPassword('');
        setNewPasskey('');
        setConfirmPasskey('');
        setSecurityNotice('');
        onShowToast({ 
          type: 'success', 
          title: 'Password Updated', 
          message: 'Server-side administrator credentials updated with PBKDF2 hashing.' 
        });
        fetchAuditLogs();
      }
    } catch (err) {
      setSecurityNotice(err.message || 'Failed to update password.');
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

  const handleImportJSONFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = await importCampaignsJSON(event.target.result);
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
      refreshDbHealth();
    } catch (err) {
      onShowToast({ type: 'error', title: 'Sync Error', message: err.message });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div 
        className="admin-dashboard-container" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dashboard-title"
      >
        {/* Top Header Bar */}
        <header className="admin-modal-topbar">
          <div className="admin-modal-brand-wrap">
            <div className="admin-brand-pill">ADMIN</div>
            <h1 id="admin-dashboard-title" className="admin-brand-heading">
              MARTIN EMIL ARTEEN — PORTFOLIO CONTROL
            </h1>
            <div 
              className="admin-turso-topbar-pill" 
              onClick={refreshDbHealth}
              title="Click to check Server & Turso DB Connection"
              style={{ cursor: 'pointer' }}
            >
              <span className={`turso-status-dot ${dbHealth.checking ? 'checking' : dbHealth.ok ? 'online' : 'offline'}`} />
              <span>{dbHealth.checking ? 'TURSO: CHECKING...' : dbHealth.ok ? `TURSO: ONLINE (${dbHealth.latencyMs || 40}ms)` : 'TURSO: OFFLINE'}</span>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <button 
              type="button" 
              className="admin-revoke-btn" 
              onClick={onRevokeSession}
              title="Log out and revoke current HttpOnly server session"
            >
              <LogOut size={14} />
              <span>LOGOUT</span>
            </button>
            <button 
              type="button" 
              className="admin-modal-close-btn" 
              onClick={onClose} 
              aria-label="Close dashboard"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="admin-tabs-bar" role="tablist">
          <button 
            type="button"
            className={`admin-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
            role="tab"
            aria-selected={activeTab === 'projects'}
          >
            <FolderGit2 size={16} />
            <span>CAMPAIGNS ({campaigns.length})</span>
          </button>
          <button 
            type="button"
            className={`admin-tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => {
              if (editingIndex === null) handleAddNew();
              else setActiveTab('editor');
            }}
            role="tab"
            aria-selected={activeTab === 'editor'}
          >
            <Edit3 size={16} />
            <span>{editingIndex !== null ? `EDIT: #${formData.id}` : 'ADD NEW PROJECT'}</span>
          </button>
          <button 
            type="button"
            className={`admin-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
            role="tab"
            aria-selected={activeTab === 'security'}
          >
            <KeyRound size={16} />
            <span>SECURITY & ACCESS LINKS</span>
          </button>
          <button 
            type="button"
            className={`admin-tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
            role="tab"
            aria-selected={activeTab === 'sync'}
          >
            <RefreshCw size={16} />
            <span>SYNC & EXPORT</span>
          </button>
        </nav>

        {/* Tab Content Panes */}
        <div className="admin-modal-body">
          {/* TAB 1: CAMPAIGNS OVERVIEW */}
          {activeTab === 'projects' && (
            <section className="admin-tab-pane">
              <div className="admin-section-header-row">
                <div>
                  <h2 className="admin-pane-title">LIVE EXHIBITION PROJECTS</h2>
                  <p className="admin-pane-desc">Manage, reorder, duplicate, or edit campaign slides currently showcased in the exhibition.</p>
                </div>
                <button type="button" className="admin-btn-primary" onClick={handleAddNew}>
                  <Plus size={16} />
                  <span>NEW CAMPAIGN</span>
                </button>
              </div>

              <div className="admin-projects-grid">
                {campaigns.map((c, idx) => (
                  <article key={c.id || idx} className="admin-project-card">
                    <div className="admin-card-thumb-wrap">
                      <img src={c.image} alt={c.title} className="admin-card-thumb" />
                      <div className="admin-card-idx-badge">#{c.id}</div>
                      <div className={`admin-card-status-badge status-${(c.status || 'experimental').toLowerCase().replace(' ', '-')}`}>
                        {c.status}
                      </div>
                    </div>

                    <div className="admin-card-details">
                      <div className="admin-card-cat">{c.category} · {c.year}</div>
                      <h3 className="admin-card-title">{c.title}</h3>
                      <p className="admin-card-tagline">{c.tagline}</p>
                      <div className="admin-card-role">{c.role}</div>
                    </div>

                    <div className="admin-card-footer-actions">
                      <div className="admin-order-controls">
                        <button 
                          type="button" 
                          className="admin-icon-btn" 
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, 'up')}
                          title="Move project up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button 
                          type="button" 
                          className="admin-icon-btn" 
                          disabled={idx === campaigns.length - 1}
                          onClick={() => handleMove(idx, 'down')}
                          title="Move project down"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      <div className="admin-crud-actions">
                        <button 
                          type="button" 
                          className="admin-icon-btn" 
                          onClick={() => handleDuplicate(idx)}
                          title="Duplicate project"
                        >
                          <Copy size={14} />
                        </button>
                        <button 
                          type="button" 
                          className="admin-icon-btn primary" 
                          onClick={() => handleEdit(idx)}
                          title="Edit project"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          type="button" 
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

          {/* TAB 2: PROJECT EDITOR */}
          {activeTab === 'editor' && (
            <section className="admin-tab-pane">
              <div className="admin-section-header-row">
                <div>
                  <h2 className="admin-pane-title">
                    {editingIndex !== null ? `EDIT PROJECT — ${formData.title || 'UNTITLED'}` : 'CREATE NEW CAMPAIGN'}
                  </h2>
                  <p className="admin-pane-desc">Configure typography, cover media, multi-photo gallery carousels, and case study destinations.</p>
                </div>
                <div className="admin-editor-actions">
                  <button type="button" className="admin-btn-secondary" onClick={() => setActiveTab('projects')}>
                    CANCEL
                  </button>
                  <button type="button" className="admin-btn-primary" onClick={handleSaveProject}>
                    <Check size={16} />
                    <span>{editingIndex !== null ? 'SAVE CHANGES' : 'CREATE CAMPAIGN'}</span>
                  </button>
                </div>
              </div>

              <div className="admin-editor-layout">
                <form onSubmit={handleSaveProject} className="admin-editor-form">
                  <div className="admin-form-section-title">CORE IDENTITY & TYPOGRAPHY</div>
                  <div className="admin-form-row two-cols">
                    <div className="admin-input-group">
                      <label className="admin-input-label">PROJECT ID (SEQUENTIAL)</label>
                      <input 
                        type="text" 
                        value={formData.id} 
                        onChange={(e) => handleInputChange('id', e.target.value)}
                        className="admin-text-input"
                        placeholder="e.g. 01"
                      />
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-input-label">EXHIBITION STATUS</label>
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
                  </div>

                  <div className="admin-form-row">
                    <div className="admin-input-group" style={{ flex: 1 }}>
                      <label className="admin-input-label">HERO CAMPAIGN TITLE</label>
                      <input 
                        type="text" 
                        value={formData.title} 
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        className="admin-text-input"
                        placeholder="e.g. AETHER — MONOLITH AUTOMOTIVE"
                      />
                    </div>
                  </div>

                  <div className="admin-form-row">
                    <div className="admin-input-group" style={{ flex: 1 }}>
                      <label className="admin-input-label">EDITORIAL TAGLINE</label>
                      <input 
                        type="text" 
                        value={formData.tagline} 
                        onChange={(e) => handleInputChange('tagline', e.target.value)}
                        className="admin-text-input"
                        placeholder="e.g. CINEMATIC PRODUCT LAUNCH FILM & VISUAL SYSTEM"
                      />
                    </div>
                  </div>

                  <div className="admin-form-row three-cols">
                    <div className="admin-input-group">
                      <label className="admin-input-label">PRODUCTION YEAR</label>
                      <input 
                        type="text" 
                        value={formData.year} 
                        onChange={(e) => handleInputChange('year', e.target.value)}
                        className="admin-text-input"
                        placeholder="2026"
                      />
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-input-label">CREATIVE ROLE</label>
                      <input 
                        type="text" 
                        value={formData.role} 
                        onChange={(e) => handleInputChange('role', e.target.value)}
                        className="admin-text-input"
                        placeholder="ART DIRECTION & CGI"
                      />
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-input-label">DISCIPLINE CATEGORY</label>
                      <input 
                        type="text" 
                        value={formData.category} 
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className="admin-text-input"
                        placeholder="AUTOMOTIVE EXHIBITION"
                      />
                    </div>
                  </div>

                  <div className="admin-form-section-title" style={{ marginTop: '1.5rem' }}>
                    EDITORIAL NARRATIVE & CREDITS
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-input-group" style={{ flex: 1 }}>
                      <label className="admin-input-label">EXHIBITION PLAQUE DESCRIPTION</label>
                      <textarea 
                        value={formData.description} 
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        className="admin-text-input textarea"
                        rows={4}
                        placeholder="Detailed curatorial narrative of the campaign design..."
                      />
                    </div>
                  </div>

                  <div className="admin-form-row two-cols">
                    <div className="admin-input-group">
                      <label className="admin-input-label">CLIENT / COMMISSIONER</label>
                      <input 
                        type="text" 
                        value={formData.client} 
                        onChange={(e) => handleInputChange('client', e.target.value)}
                        className="admin-text-input"
                        placeholder="e.g. MONOLITH AUTOMOTIVE GROUP"
                      />
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-input-label">PROJECT CREDITS</label>
                      <input 
                        type="text" 
                        value={formData.credits} 
                        onChange={(e) => handleInputChange('credits', e.target.value)}
                        className="admin-text-input"
                        placeholder="Art Direction: Martin Emil Arteen"
                      />
                    </div>
                  </div>

                  <div className="admin-form-section-title" style={{ marginTop: '1.5rem' }}>
                    HERO COVER MEDIA (IMAGE / CGI RENDER)
                  </div>
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
                      style={{ display: 'none' }}
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e.target.files[0])}
                    />
                    <ImageIcon size={32} className="dropzone-icon" />
                    <div className="dropzone-text">
                      <strong>DRAG & DROP COVER IMAGE HERE</strong>
                      <span>or click to browse local files (JPG, PNG, WebP, SVG up to 10MB)</span>
                    </div>
                    {isUploading && <div className="dropzone-loading">PROCESSING MEDIA ASSET...</div>}
                  </div>

                  <div className="admin-url-fallback-row">
                    <span className="admin-url-label">or media URL:</span>
                    <input 
                      type="text"
                      value={formData.image}
                      onChange={(e) => handleInputChange('image', e.target.value)}
                      className="admin-text-input inline"
                      placeholder="https://... or /campaigns/c1.jpg"
                    />
                  </div>

                  {/* Multi-Photo Gallery Showcase Section */}
                  <div className="admin-form-section-title" style={{ marginTop: '1.5rem' }}>
                    MULTI-PHOTO EXHIBITION GALLERY CAROUSEL
                  </div>
                  <div className="admin-gallery-manager-box">
                    <div className="admin-gallery-header">
                      <div className="admin-gallery-title-wrap">
                        <Layers size={16} />
                        <strong>GALLERY PHOTOS ({Array.isArray(formData.gallery) ? formData.gallery.length : 0})</strong>
                      </div>
                      <button 
                        type="button" 
                        className="admin-btn-secondary mini"
                        onClick={() => galleryFileInputRef.current?.click()}
                      >
                        <Upload size={13} />
                        <span>UPLOAD TO GALLERY</span>
                      </button>
                      <input 
                        type="file" 
                        ref={galleryFileInputRef} 
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={(e) => handleGalleryFileUpload(e.target.files[0])}
                      />
                    </div>

                    <div className="admin-gallery-add-row">
                      <input 
                        type="text"
                        value={newGalleryUrl}
                        onChange={(e) => setNewGalleryUrl(e.target.value)}
                        placeholder="Paste image URL (https://... or /campaigns/...)"
                        className="admin-text-input inline"
                        style={{ flex: 2 }}
                      />
                      <input 
                        type="text"
                        value={newGalleryCaption}
                        onChange={(e) => setNewGalleryCaption(e.target.value)}
                        placeholder="Caption (optional)"
                        className="admin-text-input inline"
                        style={{ flex: 1 }}
                      />
                      <button 
                        type="button"
                        className="admin-btn-primary mini"
                        disabled={!newGalleryUrl.trim()}
                        onClick={() => handleAddGalleryPhoto(newGalleryUrl, newGalleryCaption)}
                      >
                        <Plus size={13} />
                        <span>ADD PHOTO</span>
                      </button>
                    </div>

                    {Array.isArray(formData.gallery) && formData.gallery.length > 0 ? (
                      <div className="admin-gallery-grid">
                        {formData.gallery.map((photo, pIdx) => (
                          <div key={photo.id || pIdx} className="admin-gallery-card">
                            <img src={photo.url} alt={`Gallery #${pIdx + 1}`} className="admin-gallery-thumb-img" />
                            <div className="admin-gallery-card-overlay">
                              <div className="admin-gallery-order-btns">
                                <button 
                                  type="button" 
                                  disabled={pIdx === 0}
                                  onClick={() => handleMoveGalleryPhoto(pIdx, 'left')}
                                  title="Move Left"
                                >
                                  ←
                                </button>
                                <button 
                                  type="button" 
                                  disabled={pIdx === formData.gallery.length - 1}
                                  onClick={() => handleMoveGalleryPhoto(pIdx, 'right')}
                                  title="Move Right"
                                >
                                  →
                                </button>
                              </div>
                              <button 
                                type="button" 
                                className="admin-gallery-del-btn"
                                onClick={() => handleRemoveGalleryPhoto(pIdx)}
                                title="Remove photo"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {photo.caption && (
                              <div className="admin-gallery-caption-preview">{photo.caption}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="admin-gallery-empty">
                        No supplementary gallery photos added yet. Use the fields above to add secondary showcase perspectives.
                      </div>
                    )}
                  </div>

                  {/* External Destination Links */}
                  <div className="admin-form-section-title" style={{ marginTop: '1.5rem' }}>
                    EXTERNAL CASE STUDY & DESTINATION HYPERLINKS
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-input-group" style={{ flex: 1 }}>
                      <label className="admin-input-label">FULL CASE STUDY URL (BEHANCE / ARTSTATION / WEB)</label>
                      <div className="admin-link-input-row">
                        <ExternalLink size={15} className="admin-link-input-icon" />
                        <input 
                          type="text" 
                          value={formData.case_study_link || formData.caseStudyLink || ''} 
                          onChange={(e) => {
                            handleInputChange('case_study_link', e.target.value);
                            handleInputChange('caseStudyLink', e.target.value);
                          }}
                          className="admin-text-input with-icon"
                          placeholder="https://behance.net/gallery/... or https://artstation.com/..."
                        />
                        {(formData.case_study_link || formData.caseStudyLink) && (
                          <a 
                            href={formData.case_study_link || formData.caseStudyLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="admin-test-link-btn"
                          >
                            <span>TEST</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="admin-form-row two-cols">
                    <div className="admin-input-group">
                      <label className="admin-input-label">PRIMARY PROJECT LINK</label>
                      <div className="admin-link-input-row">
                        <Film size={15} className="admin-link-input-icon" />
                        <input 
                          type="text" 
                          value={formData.link || ''} 
                          onChange={(e) => handleInputChange('link', e.target.value)}
                          className="admin-text-input with-icon"
                          placeholder="https://vimeo.com/... or live URL"
                        />
                      </div>
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-input-label">CLIENT OFFICIAL WEBSITE</label>
                      <div className="admin-link-input-row">
                        <Globe size={15} className="admin-link-input-icon" />
                        <input 
                          type="text" 
                          value={formData.client_link || formData.clientLink || ''} 
                          onChange={(e) => {
                            handleInputChange('client_link', e.target.value);
                            handleInputChange('clientLink', e.target.value);
                          }}
                          className="admin-text-input with-icon"
                          placeholder="https://brand.com"
                        />
                      </div>
                    </div>
                  </div>
                </form>

                {/* Live Plaque Preview Column */}
                <aside className="admin-preview-column">
                  <div className="admin-preview-header">LIVE EXHIBITION PREVIEW</div>
                  <div className="admin-live-preview-card">
                    <div className="admin-preview-img-wrap">
                      <img src={formData.image || '/campaigns/c1.jpg'} alt="Preview" />
                      <div className="admin-preview-status-tag">{formData.status}</div>
                    </div>
                    <div className="admin-preview-body">
                      <div className="admin-preview-category">{formData.category} · {formData.year}</div>
                      <h3 className="admin-preview-title">{formData.title || 'CAMPAIGN TITLE'}</h3>
                      <div className="admin-preview-tagline">{formData.tagline || 'Editorial tagline goes here...'}</div>
                      <div className="admin-preview-desc">{formData.description || 'Campaign narrative description...'}</div>
                      <div className="admin-preview-credits">{formData.credits}</div>

                      {Array.isArray(formData.gallery) && formData.gallery.length > 0 && (
                        <div className="admin-preview-gallery-row">
                          <div className="admin-preview-sub-label">GALLERY CAROUSEL ({formData.gallery.length} PHOTOS)</div>
                          <div className="admin-preview-gallery-thumbs">
                            {formData.gallery.slice(0, 4).map((p, idx) => (
                              <img key={p.id || idx} src={p.url} alt="Thumb" className="admin-preview-mini-thumb" />
                            ))}
                            {formData.gallery.length > 4 && (
                              <span style={{ fontSize: '0.65rem', alignSelf: 'center', color: 'var(--text-muted)' }}>
                                +{formData.gallery.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {(formData.case_study_link || formData.link || formData.client_link) && (
                        <div className="admin-preview-links-row">
                          <div className="admin-preview-sub-label">DESTINATIONS</div>
                          <div className="admin-preview-links-chips">
                            {(formData.case_study_link || formData.caseStudyLink) && <span className="admin-preview-chip">CASE STUDY ↗</span>}
                            {formData.link && <span className="admin-preview-chip">PROJECT LINK ↗</span>}
                            {(formData.client_link || formData.clientLink) && <span className="admin-preview-chip">CLIENT ↗</span>}
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
                  <h2 className="admin-pane-title">SECURITY & ACCESS CONTROL</h2>
                  <p className="admin-pane-desc">Generate single-use cryptographic access links, update administrator credentials, and inspect security audit logs.</p>
                </div>
              </div>

              <div className="admin-security-grid">
                {/* Single-Use Access Link Card */}
                <div className="admin-security-card">
                  <div className="admin-security-card-header">
                    <LinkIcon size={18} />
                    <h3>SINGLE-USE CRYPTOGRAPHIC ACCESS LINK</h3>
                  </div>
                  <p className="admin-security-card-desc">
                    Generate an ephemeral, single-use access link valid for 10 minutes. Upon access, the link is immediately burned and an authenticated session cookie is created.
                  </p>

                  <div className="admin-token-actions">
                    <button 
                      type="button" 
                      className="admin-btn-primary"
                      onClick={handleGenerateAccessLink}
                    >
                      <KeyRound size={14} />
                      <span>GENERATE 10-MIN ACCESS LINK</span>
                    </button>
                  </div>

                  {generatedLink ? (
                    <div className="admin-link-box" style={{ marginTop: '1rem' }}>
                      <code className="admin-link-code">{generatedLink}</code>
                      <button 
                        type="button" 
                        className={`admin-copy-btn ${copiedLink ? 'copied' : ''}`}
                        onClick={handleCopyLink}
                      >
                        {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedLink ? 'COPIED' : 'COPY'}</span>
                      </button>
                    </div>
                  ) : null}

                  <div className="admin-security-tip">
                    <ShieldCheck size={16} />
                    <span>Tokens are stored as SHA-256 hashes server-side and automatically invalidated after 10 minutes or upon first use.</span>
                  </div>
                </div>

                {/* Change Master Passkey Card */}
                <div className="admin-security-card">
                  <div className="admin-security-card-header">
                    <KeyRound size={18} />
                    <h3>CHANGE ADMINISTRATOR PASSWORD</h3>
                  </div>
                  <p className="admin-security-card-desc">
                    Update the administrator password. Stored using salted PBKDF2 hashing with 100,000 rounds.
                  </p>

                  <form onSubmit={handleChangePasskey} className="admin-passkey-change-form">
                    <div className="admin-input-group">
                      <label className="admin-input-label">CURRENT PASSWORD</label>
                      <input 
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password..."
                        className="admin-text-input"
                        autoComplete="current-password"
                      />
                    </div>

                    <div className="admin-input-group">
                      <label className="admin-input-label">NEW PASSWORD (MIN 12 CHARACTERS)</label>
                      <input 
                        type="password"
                        value={newPasskey}
                        onChange={(e) => setNewPasskey(e.target.value)}
                        placeholder="At least 12 characters..."
                        className="admin-text-input"
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="admin-input-group">
                      <label className="admin-input-label">CONFIRM NEW PASSWORD</label>
                      <input 
                        type="password"
                        value={confirmPasskey}
                        onChange={(e) => setConfirmPasskey(e.target.value)}
                        placeholder="Re-enter new password..."
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
                      disabled={!currentPassword || !newPasskey || newPasskey.length < 12 || newPasskey !== confirmPasskey}
                      className="admin-btn-primary"
                    >
                      UPDATE PASSWORD
                    </button>
                  </form>
                </div>

                {/* Security Posture Summary */}
                <div className="admin-security-card full-width">
                  <div className="admin-security-card-header">
                    <ShieldCheck size={18} />
                    <h3>SERVER-SIDE SECURITY POSTURE</h3>
                  </div>

                  <div className="admin-security-metrics-row">
                    <div className="admin-metric-badge">
                      <span className="metric-label">AUTHENTICATION</span>
                      <span className="metric-value">PBKDF2 SHA-256 + HttpOnly</span>
                    </div>
                    <div className="admin-metric-badge">
                      <span className="metric-label">BRUTE FORCE SHIELD</span>
                      <span className="metric-value">5 Attempts / 15-min Lockout</span>
                    </div>
                    <div className="admin-metric-badge">
                      <span className="metric-label">SESSION LIFETIME</span>
                      <span className="metric-value">30m Idle / 8h Absolute</span>
                    </div>
                    <div className="admin-metric-badge">
                      <span className="metric-label">DATABASE ACCESS</span>
                      <span className="metric-value">Serverless Edge API Only</span>
                    </div>
                  </div>
                </div>

                {/* Server Audit Log Table */}
                <div className="admin-security-card full-width">
                  <div className="admin-security-card-header">
                    <Activity size={18} />
                    <h3>SECURITY AUDIT TRAIL</h3>
                    <button 
                      type="button" 
                      className="admin-btn-secondary mini"
                      onClick={fetchAuditLogs}
                      style={{ marginLeft: 'auto' }}
                    >
                      <RefreshCw size={12} className={isLoadingLogs ? 'spin-icon' : ''} />
                      <span>REFRESH AUDIT LOG</span>
                    </button>
                  </div>

                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    {auditLogs.length > 0 ? (
                      <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.5rem' }}>TIME</th>
                            <th style={{ padding: '0.5rem' }}>EVENT</th>
                            <th style={{ padding: '0.5rem' }}>ACTOR</th>
                            <th style={{ padding: '0.5rem' }}>IP</th>
                            <th style={{ padding: '0.5rem' }}>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.slice(0, 25).map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace' }}>
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </td>
                              <td style={{ padding: '0.4rem 0.5rem', fontWeight: 700 }}>{log.eventType}</td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{log.actor}</td>
                              <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace' }}>{log.ip}</td>
                              <td style={{ padding: '0.4rem 0.5rem', color: log.success ? '#10B981' : 'var(--accent-red)' }}>
                                {log.success ? 'SUCCESS' : 'FAILED'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        {isLoadingLogs ? 'Loading audit records...' : 'No security events recorded yet.'}
                      </div>
                    )}
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
                    <button 
                      type="button"
                      className={`admin-turso-status-pill ${dbHealth.checking ? 'checking' : dbHealth.ok ? 'online' : 'offline'}`}
                      onClick={refreshDbHealth}
                      title="Click to re-ping Turso Edge Database via Server"
                      style={{ cursor: 'pointer', border: 'none' }}
                    >
                      <span className="turso-ping-dot" />
                      <span>{dbHealth.checking ? 'CHECKING...' : dbHealth.ok ? `ONLINE (${dbHealth.latencyMs || 40}ms)` : 'OFFLINE (CLICK TO RETRY)'}</span>
                    </button>
                  </div>
                  <p>
                    Serverless API connection to Turso Edge database. The browser communicates exclusively with authenticated server endpoints.
                  </p>
                  <button 
                    type="button" 
                    className="admin-btn-primary" 
                    onClick={handleManualCloudSync}
                    disabled={isSyncingCloud}
                  >
                    <RefreshCw size={14} className={isSyncingCloud ? 'spin-icon' : ''} />
                    <span>{isSyncingCloud ? 'SYNCHRONIZING...' : 'FORCE RE-SYNC WITH TURSO'}</span>
                  </button>
                </div>

                {/* Git Repository Source Code Export */}
                <div className="admin-sync-card highlight">
                  <div className="admin-sync-icon">
                    <FolderGit2 size={24} />
                  </div>
                  <h3>EXPORT REPOSITORY CODE</h3>
                  <p>
                    Download a formatted <code>campaignsData.js</code> file to replace <code>src/data/campaignsData.js</code> in your git repository.
                  </p>
                  <button type="button" className="admin-btn-primary" onClick={handleExportJS}>
                    <Download size={14} />
                    <span>DOWNLOAD CAMPAIGNSDATA.JS</span>
                  </button>
                </div>

                {/* JSON Data Backup */}
                <div className="admin-sync-card">
                  <div className="admin-sync-icon">
                    <Download size={24} />
                  </div>
                  <h3>FULL DATA BACKUP (JSON)</h3>
                  <p>
                    Download complete snapshot containing all {campaigns.length} campaigns with metadata and multi-photo galleries.
                  </p>
                  <button type="button" className="admin-btn-secondary" onClick={handleExportJSON}>
                    <Download size={14} />
                    <span>EXPORT JSON ARCHIVE</span>
                  </button>
                </div>

                {/* JSON Restore / Import */}
                <div className="admin-sync-card">
                  <div className="admin-sync-icon">
                    <Upload size={24} />
                  </div>
                  <h3>RESTORE ARCHIVE (JSON)</h3>
                  <p>
                    Upload a previously exported <code>.json</code> backup to restore campaign dataset atomically.
                  </p>
                  <input 
                    type="file" 
                    ref={jsonImportRef} 
                    style={{ display: 'none' }}
                    accept=".json"
                    onChange={handleImportJSONFile}
                  />
                  <button 
                    type="button" 
                    className="admin-btn-secondary" 
                    onClick={() => jsonImportRef.current?.click()}
                  >
                    <Upload size={14} />
                    <span>SELECT JSON ARCHIVE</span>
                  </button>
                </div>

                {/* Reset to Factory Defaults */}
                <div className="admin-sync-card danger-zone">
                  <div className="admin-sync-icon danger">
                    <RotateCcw size={24} />
                  </div>
                  <h3>RESET TO FACTORY DEFAULTS</h3>
                  <p>
                    Wipes custom additions and restores the 6 original factory default campaigns atomically.
                  </p>
                  <button type="button" className="admin-btn-danger" onClick={handleResetDefaults}>
                    <RotateCcw size={14} />
                    <span>RESTORE FACTORY EXHIBITIONS</span>
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
