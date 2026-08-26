import React, { useEffect, useState } from 'react';
import { MessageSquare, Loader2, Plus, Edit2, Trash2, Zap, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { notifyApiSuccess } from '../context/ToastContext.tsx';

export default function ReplyTemplates() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [ratingTarget, setRatingTarget] = useState('5 Stars');
  const [submitting, setSubmitting] = useState(false);

  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/settings/templates');
      if (res) setData(Array.isArray(res) ? res : [res]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateText('');
    setRatingTarget('5 Stars');
    setShowModal(true);
  };

  const handleOpenEdit = (template: any) => {
    setEditingTemplate(template);
    setTemplateName(template.name || '');
    setTemplateText(template.text || '');
    setRatingTarget(template.ratingTarget || '5 Stars');
    setShowModal(true);
  };

  const handleDelete = async (id: any) => {
    try {
      setData((prev) => prev.filter((t, i) => (t.id || i) !== id));
      notifyApiSuccess({
        method: 'DELETE',
        pathname: '/api/settings/templates',
        title: 'Template Deleted',
        message: 'Reply template removed successfully.'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateText.trim()) return;

    setSubmitting(true);
    try {
      if (editingTemplate) {
        // Edit mode
        const updated = { ...editingTemplate, name: templateName, text: templateText, ratingTarget };
        setData((prev) => prev.map((t) => (t.id === editingTemplate.id ? updated : t)));
        notifyApiSuccess({
          method: 'PUT',
          pathname: '/api/settings/templates',
          title: 'Template Updated',
          message: `Successfully updated template "${templateName}"`
        });
      } else {
        // Create mode
        const newTemp = {
          id: Date.now(),
          name: templateName,
          text: templateText,
          ratingTarget
        };
        setData((prev) => [newTemp, ...prev]);
        notifyApiSuccess({
          method: 'POST',
          pathname: '/api/settings/templates',
          title: 'Template Saved',
          message: `Successfully created template "${templateName}"`
        });
      }

      setShowModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reply Templates</h1>
          <p className="text-muted text-sm mt-1">Manage canned responses for quick manual replies to customer reviews.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-primary/10 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Template
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-card rounded-[2.5rem] border border-border p-20 text-center">
          <div className="w-20 h-20 bg-card-nested rounded-3xl border border-border flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-10 h-10 text-muted opacity-30" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No templates yet</h3>
          <p className="text-muted mb-8 max-w-md mx-auto">Speed up your review management with pre-written responses.</p>
          <button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-primary/10">
            Add Your First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.map((item, i) => (
            <div key={item.id || i} className="bg-card p-8 rounded-[2.5rem] border border-border group hover:border-primary/30 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-bold text-muted bg-card-nested px-2.5 py-1 rounded-lg border border-border uppercase">
                    {item.ratingTarget || '5 Stars'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenEdit(item)} className="p-2 text-muted hover:text-white hover:bg-card-nested rounded-lg transition-all" title="Edit Template">
                    <Edit2 className="w-4 h-4"/>
                  </button>
                  <button onClick={() => handleDelete(item.id || i)} className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all" title="Delete Template">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-white mb-2">{item.name || 'Response Template'}</h3>
              <p className="text-sm text-muted line-clamp-3 italic">"{item.text || 'Sample response text goes here...'}"</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingTemplate ? 'Edit Reply Template' : 'Create Reply Template'}
                  </h3>
                  <p className="text-xs text-muted">Pre-written response for review management</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Template Title</label>
                <input
                  type="text"
                  required
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. 5-Star Thank You Response"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Target Rating</label>
                <select
                  value={ratingTarget}
                  onChange={(e) => setRatingTarget(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="5 Stars">5 Stars Only</option>
                  <option value="4-5 Stars">4 to 5 Stars</option>
                  <option value="3 Stars">3 Stars (Neutral)</option>
                  <option value="1-2 Stars">1 to 2 Stars (Negative)</option>
                  <option value="All Ratings">All Ratings</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Response Text</label>
                <textarea
                  required
                  rows={4}
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                  placeholder="Thank you so much for visiting us! We are thrilled to hear you had a great experience..."
                  className="w-full bg-background border border-border rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-card-nested"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

