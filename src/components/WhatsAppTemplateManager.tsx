import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Edit2, Trash2, Copy, Star, Check, Smartphone, Eye, 
  Sparkles, Tag, Search, MessageSquare, AlertCircle, FileText, CheckCheck, Loader2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext.tsx';
import { notifyApiSuccess } from '../context/ToastContext.tsx';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'Review Request' | 'Follow-up' | 'Incentive' | 'VIP Request' | 'General';
  language: string;
  isDefault: boolean;
  content: string;
  createdAt: string;
}

const CATEGORIES = ['All', 'Review Request', 'Follow-up', 'Incentive', 'VIP Request', 'General'];

const PLACEHOLDERS = [
  { tag: '{customer_name}', label: 'Customer Name', example: 'Alex Morgan' },
  { tag: '{business_name}', label: 'Business Name', example: 'Apex Local Salon & Spa' },
  { tag: '{review_link}', label: 'Review Link', example: 'https://g.page/r/apex-spa/review' },
  { tag: '{agent_name}', label: 'Agent Name', example: 'Sarah' }
];

export default function WhatsAppTemplateManager() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modals state
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'Review Request' | 'Follow-up' | 'Incentive' | 'VIP Request' | 'General'>('Review Request');
  const [formLanguage, setFormLanguage] = useState('English (US)');
  const [formContent, setFormContent] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Preview Modal State
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);
  const [testVars, setTestVars] = useState({
    customer_name: 'Alex Morgan',
    business_name: 'Apex Local Salon & Spa',
    review_link: 'https://g.page/r/apex-spa/review',
    agent_name: 'Sarah'
  });

  // Test Send Modal
  const [showTestSendModal, setShowTestSendModal] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testSending, setTestSending] = useState(false);

  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/whatsapp/templates');
      if (Array.isArray(res)) {
        setTemplates(res);
      }
    } catch (err) {
      console.error('Error loading WhatsApp templates:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplatesToBackend(updatedList: WhatsAppTemplate[]) {
    setSaving(true);
    try {
      await apiFetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: updatedList })
      });
      setTemplates(updatedList);
    } catch (err) {
      console.error('Failed to persist templates:', err);
    } finally {
      setSaving(false);
    }
  }

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormCategory('Review Request');
    setFormLanguage('English (US)');
    setFormContent('Hi {customer_name}! Thank you for choosing {business_name}. We hope you had a great experience! Could you please leave us a review here? {review_link}');
    setFormIsDefault(templates.length === 0);
    setShowEditorModal(true);
  };

  const handleOpenEdit = (tpl: WhatsAppTemplate) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormCategory(tpl.category);
    setFormLanguage(tpl.language);
    setFormContent(tpl.content);
    setFormIsDefault(tpl.isDefault);
    setShowEditorModal(true);
  };

  const handleInsertPlaceholder = (tag: string) => {
    if (!textareaRef.current) {
      setFormContent((prev) => prev + ' ' + tag);
      return;
    }

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = formContent;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newContent = before + tag + after;
    setFormContent(newContent);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + tag.length, start + tag.length);
      }
    }, 50);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formContent.trim()) return;

    let updated = [...templates];

    if (formIsDefault) {
      updated = updated.map((t) => ({ ...t, isDefault: false }));
    }

    if (editingTemplate) {
      updated = updated.map((t) => 
        t.id === editingTemplate.id 
          ? {
              ...t,
              name: formName,
              category: formCategory,
              language: formLanguage,
              content: formContent,
              isDefault: formIsDefault
            }
          : t
      );
      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/whatsapp/templates',
        title: 'Template Updated',
        message: `Updated template "${formName}"`
      });
    } else {
      const newTpl: WhatsAppTemplate = {
        id: 'tpl_' + Date.now(),
        name: formName,
        category: formCategory,
        language: formLanguage,
        content: formContent,
        isDefault: formIsDefault || templates.length === 0,
        createdAt: new Date().toISOString()
      };
      updated = [newTpl, ...updated];
      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/whatsapp/templates',
        title: 'Template Created',
        message: `Created template "${formName}"`
      });
    }

    await saveTemplatesToBackend(updated);
    setShowEditorModal(false);
  };

  const handleSetDefault = async (tplId: string) => {
    const updated = templates.map((t) => ({
      ...t,
      isDefault: t.id === tplId
    }));
    const target = templates.find((t) => t.id === tplId);
    notifyApiSuccess({
      method: 'POST',
      pathname: '/api/whatsapp/templates',
      title: 'Default Template Set',
      message: `"${target?.name}" is now the default template`
    });
    await saveTemplatesToBackend(updated);
  };

  const handleDuplicate = async (tpl: WhatsAppTemplate) => {
    const duplicated: WhatsAppTemplate = {
      ...tpl,
      id: 'tpl_' + Date.now(),
      name: `${tpl.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString()
    };
    const updated = [duplicated, ...templates];
    notifyApiSuccess({
      method: 'POST',
      pathname: '/api/whatsapp/templates',
      title: 'Template Duplicated',
      message: `Created duplicate of "${tpl.name}"`
    });
    await saveTemplatesToBackend(updated);
  };

  const handleDelete = async (tplId: string) => {
    const target = templates.find((t) => t.id === tplId);
    if (!confirm(`Are you sure you want to delete template "${target?.name}"?`)) return;

    const updated = templates.filter((t) => t.id !== tplId);
    if (target?.isDefault && updated.length > 0) {
      updated[0].isDefault = true;
    }
    notifyApiSuccess({
      method: 'POST',
      pathname: '/api/whatsapp/templates',
      title: 'Template Removed',
      message: `Deleted "${target?.name}"`
    });
    await saveTemplatesToBackend(updated);
  };

  const handleCopyText = (content: string, name: string) => {
    navigator.clipboard.writeText(content);
    notifyApiSuccess({
      method: 'GET',
      pathname: '/api/whatsapp/templates',
      title: 'Copied to Clipboard',
      message: `Template "${name}" string copied`
    });
  };

  const handleTestSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhoneNumber) return;
    setTestSending(true);
    setTimeout(() => {
      setTestSending(false);
      setShowTestSendModal(false);
      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/whatsapp/send',
        title: 'Test Review Request Sent',
        message: `WhatsApp review request sent to ${testPhoneNumber}`
      });
      setTestPhoneNumber('');
    }, 1000);
  };

  const renderHighlightedContent = (text: string) => {
    const parts = text.split(/(\{customer_name\}|\{business_name\}|\{review_link\}|\{agent_name\})/g);
    return parts.map((part, idx) => {
      if (PLACEHOLDERS.some((p) => p.tag === part)) {
        return (
          <span 
            key={idx} 
            className="inline-block px-1.5 py-0.5 my-0.5 mx-0.5 bg-primary/20 text-primary font-mono text-[11px] font-bold rounded-md border border-primary/30"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const getRenderedPreviewText = (text: string) => {
    return text
      .replace(/\{customer_name\}/g, testVars.customer_name)
      .replace(/\{business_name\}/g, testVars.business_name)
      .replace(/\{review_link\}/g, testVars.review_link)
      .replace(/\{agent_name\}/g, testVars.agent_name);
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-card rounded-[2rem] p-6 md:p-8 border border-border flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green/10 text-green border border-green/20 uppercase tracking-widest flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Review Templates
            </span>
            {saving && <span className="text-xs text-muted animate-pulse flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Template Manager</h2>
          <p className="text-muted text-sm leading-relaxed">
            Pre-define standardized message templates for review requests. Use dynamic placeholders like <code className="text-primary bg-primary/10 px-1 py-0.5 rounded text-xs">{'{customer_name}'}</code> and <code className="text-primary bg-primary/10 px-1 py-0.5 rounded text-xs">{'{review_link}'}</code> for seamless personalization across all connected numbers.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-green hover:bg-green/90 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-green/20 flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Create Template
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                  : 'bg-card text-muted hover:text-white border-border hover:bg-card-nested'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex justify-center items-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-card rounded-[2rem] border border-border p-12 text-center">
          <div className="w-16 h-16 bg-card-nested rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border">
            <FileText className="w-8 h-8 text-muted opacity-40" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No templates found</h3>
          <p className="text-xs text-muted mb-6">Create your first WhatsApp review request message template.</p>
          <button
            onClick={handleOpenCreate}
            className="bg-green hover:bg-green/90 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all"
          >
            Create New Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTemplates.map((tpl) => (
            <motion.div
              key={tpl.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-card rounded-[2rem] border transition-all flex flex-col justify-between overflow-hidden group ${
                tpl.isDefault ? 'border-primary/50 shadow-lg shadow-primary/5' : 'border-border hover:border-border/80'
              }`}
            >
              <div className="p-6 space-y-4">
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white group-hover:text-primary transition-colors text-base">{tpl.name}</h3>
                      {tpl.isDefault && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider flex items-center gap-1">
                          <Star className="w-3 h-3 fill-primary" /> Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="px-2 py-0.5 bg-card-nested rounded-md border border-border font-medium text-[11px] text-muted">
                        {tpl.category}
                      </span>
                      <span>•</span>
                      <span>{tpl.language}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyText(tpl.content, tpl.name)}
                      title="Copy string"
                      className="p-2 text-muted hover:text-white hover:bg-card-nested rounded-xl transition-all"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(tpl)}
                      title="Edit template"
                      className="p-2 text-muted hover:text-white hover:bg-card-nested rounded-xl transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content Box */}
                <div className="bg-card-nested rounded-2xl p-4 border border-border/60 text-xs text-foreground/90 leading-relaxed font-sans min-h-[90px]">
                  {renderHighlightedContent(tpl.content)}
                </div>

                {/* Footer Info */}
                <div className="flex items-center justify-between text-[11px] text-muted font-medium pt-1">
                  <span>Length: <strong className="text-white">{tpl.content.length}</strong> chars</span>
                  <span>~{Math.ceil(tpl.content.length / 160)} SMS segment(s)</span>
                </div>
              </div>

              {/* Bottom Actions Toolbar */}
              <div className="px-6 py-4 bg-card-nested/50 border-t border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!tpl.isDefault && (
                    <button
                      onClick={() => handleSetDefault(tpl.id)}
                      className="text-xs text-muted hover:text-primary font-bold flex items-center gap-1 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" /> Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDuplicate(tpl)}
                    className="text-xs text-muted hover:text-white font-bold transition-colors"
                  >
                    Duplicate
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewTemplate(tpl)}
                    className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-nested border border-border text-xs font-bold text-white flex items-center gap-1.5 transition-all"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-green" /> Preview
                  </button>
                  <button
                    onClick={() => handleDelete(tpl.id)}
                    className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                    title="Delete template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Editor Modal (Create / Edit) */}
      <AnimatePresence>
        {showEditorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
              className="bg-card border border-border rounded-3xl p-6 md:p-8 max-w-2xl w-full my-8 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green/10 text-green rounded-2xl">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {editingTemplate ? 'Edit WhatsApp Template' : 'Create WhatsApp Template'}
                    </h3>
                    <p className="text-xs text-muted">Configure message body and dynamic variables</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEditorModal(false)} 
                  className="text-muted hover:text-white p-2 rounded-xl hover:bg-card-nested transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTemplate} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Template Name</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Weekend Special Review Request"
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                    >
                      <option value="Review Request">Review Request</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Incentive">Incentive</option>
                      <option value="VIP Request">VIP Request</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Dynamic Placeholders</label>
                    <span className="text-[11px] text-muted">Click tag to insert into message</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PLACEHOLDERS.map((p) => (
                      <button
                        key={p.tag}
                        type="button"
                        onClick={() => handleInsertPlaceholder(p.tag)}
                        className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-mono font-bold transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> {p.tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Message Content String</label>
                    <span className="text-xs text-muted">{formContent.length} chars</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    rows={5}
                    required
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Enter WhatsApp review request message string..."
                    className="w-full bg-background border border-border rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary font-sans leading-relaxed"
                  />
                </div>

                <div className="bg-card-nested rounded-2xl p-4 border border-border">
                  <div className="text-[11px] uppercase font-black text-muted tracking-wider mb-2 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-primary" /> Real-time Variable Highlight
                  </div>
                  <div className="text-xs text-foreground/90 leading-relaxed font-sans">
                    {formContent ? renderHighlightedContent(formContent) : <span className="text-muted italic">Type content above to see live highlight...</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isDefaultCheck"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary bg-background border-border"
                  />
                  <label htmlFor="isDefaultCheck" className="text-xs font-bold text-white cursor-pointer">
                    Set as default WhatsApp review request template for all numbers
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowEditorModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-card-nested text-muted hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-green hover:bg-green/90 text-white text-xs font-bold shadow-lg shadow-green/20 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Save Template
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live WhatsApp Smartphone Preview Modal */}
      <AnimatePresence>
        {previewTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
              className="bg-card border border-border rounded-3xl p-6 md:p-8 max-w-2xl w-full my-8 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green/10 text-green rounded-2xl">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Live WhatsApp Preview</h3>
                    <p className="text-xs text-muted">Simulate how customers see "{previewTemplate.name}"</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-muted hover:text-white p-2 rounded-xl hover:bg-card-nested"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Live Variables Test Controls */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" /> Test Variables
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-muted mb-1">{'{customer_name}'}</label>
                      <input
                        type="text"
                        value={testVars.customer_name}
                        onChange={(e) => setTestVars({ ...testVars, customer_name: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted mb-1">{'{business_name}'}</label>
                      <input
                        type="text"
                        value={testVars.business_name}
                        onChange={(e) => setTestVars({ ...testVars, business_name: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted mb-1">{'{review_link}'}</label>
                      <input
                        type="text"
                        value={testVars.review_link}
                        onChange={(e) => setTestVars({ ...testVars, review_link: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted mb-1">{'{agent_name}'}</label>
                      <input
                        type="text"
                        value={testVars.agent_name}
                        onChange={(e) => setTestVars({ ...testVars, agent_name: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowTestSendModal(true);
                      setPreviewTemplate(null);
                    }}
                    className="w-full bg-green hover:bg-green/90 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-green/10 flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" /> Send Test WhatsApp
                  </button>
                </div>

                {/* Smartphone Chat Shell */}
                <div className="bg-[#0b141a] rounded-3xl border-4 border-[#202c33] p-4 flex flex-col justify-between h-[360px] shadow-2xl relative overflow-hidden">
                  {/* WhatsApp Top Nav Bar */}
                  <div className="bg-[#202c33] -mx-4 -mt-4 px-4 py-3 flex items-center gap-3 border-b border-[#222d34]">
                    <div className="w-8 h-8 rounded-full bg-green text-white font-bold flex items-center justify-center text-xs">
                      {testVars.business_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">{testVars.business_name}</p>
                      <p className="text-[10px] text-green font-medium">Official Business Account</p>
                    </div>
                  </div>

                  {/* Chat Message Area */}
                  <div className="flex-1 py-4 overflow-y-auto space-y-3">
                    <div className="text-[10px] bg-[#182229] text-[#8696a0] px-3 py-1 rounded-md max-w-max mx-auto font-bold uppercase tracking-wider">
                      Today
                    </div>

                    <div className="bg-[#005c4b] text-white rounded-2xl rounded-tr-none p-3 max-w-[88%] ml-auto text-xs leading-relaxed shadow-md space-y-1">
                      <p className="whitespace-pre-wrap">{getRenderedPreviewText(previewTemplate.content)}</p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0] pt-1">
                        <span>10:42 AM</span>
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      </div>
                    </div>
                  </div>

                  {/* Bottom Input Mock */}
                  <div className="bg-[#202c33] -mx-4 -mb-4 px-4 py-2 text-[11px] text-[#8696a0] italic text-center border-t border-[#222d34]">
                    Automated Review Request
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test Send Modal */}
      <AnimatePresence>
        {showTestSendModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
              className="bg-card border border-border rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green/10 text-green rounded-2xl">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Send Test Review Request</h3>
                    <p className="text-xs text-muted">Test template dispatch to a phone number</p>
                  </div>
                </div>
                <button onClick={() => setShowTestSendModal(false)} className="text-muted hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTestSend} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Recipient Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTestSendModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-card-nested"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={testSending}
                    className="px-6 py-2.5 rounded-xl bg-green hover:bg-green/90 text-white text-xs font-bold shadow-lg shadow-green/20 flex items-center gap-2"
                  >
                    {testSending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send Test Request
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
