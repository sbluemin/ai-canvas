import { useState } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../api';
import { parseShareBundle } from '../utils/workspace';
import './ExportModal.css';

export function ExportModal() {
  const { 
    isExportModalOpen, 
    closeExportModal, 
    projectPath, 
    canvasContent,
    addToast,
    conversations,
    activeConversationId,
    canvasFiles,
    autosaveStatus,
    restoreState
  } = useStore();
  
  const [processing, setProcessing] = useState(false);

  const handleExportDocument = async (format: 'html' | 'pdf' | 'docx') => {
    if (!projectPath) return;
    setProcessing(true);
    try {
      const result = await api.exportDocument(projectPath, format, canvasContent);
      if (result.success) {
        addToast('success', `${format.toUpperCase()} export complete`);
        closeExportModal();
      } else if (result.error !== 'User cancelled the export.') {
        addToast('error', `Export failed: ${result.error}`);
      }
    } catch (error) {
      addToast('error', `Export error: ${String(error)}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExportBundle = async () => {
    if (!projectPath) return;
    setProcessing(true);
    try {
      const bundle = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        conversations,
        activeConversationId,
        canvasFiles,
        canvasContent, // 현재 캔버스 내용도 포함 (선택적)
        autosaveStatus
      };
      
      const result = await api.exportShareBundle(projectPath, bundle);
      if (result.success) {
        addToast('success', 'Share bundle exported');
        closeExportModal();
      } else if (result.error !== 'User cancelled the export.') {
        addToast('error', `Bundle export failed: ${result.error}`);
      }
    } catch (error) {
      addToast('error', `Bundle export error: ${String(error)}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleImportBundle = async () => {
    setProcessing(true);
    try {
      const result = await api.importShareBundle();
      if (result.success && result.bundle) {
        const bundle = parseShareBundle(result.bundle);
        if (bundle) {
          restoreState({
            conversations: bundle.conversations,
            activeConversationId: bundle.activeConversationId,
            canvasFiles: bundle.canvasOrder ?? undefined,
            canvasContent: bundle.canvasContent,
            autosaveStatus: bundle.autosaveStatus,
          });
          addToast('success', 'Share bundle imported and applied');
        } else {
          addToast('error', 'Failed to parse share bundle');
        }
        closeExportModal();
      } else if (result.error !== 'User cancelled the import.') {
        addToast('error', `Bundle import failed: ${result.error}`);
      }
    } catch (error) {
      addToast('error', `Bundle import error: ${String(error)}`);
    } finally {
      setProcessing(false);
    }
  };

  if (!isExportModalOpen) return null;

  return (
    <div className="export-modal-overlay" onClick={closeExportModal}>
      <div className="export-modal" onClick={e => e.stopPropagation()}>
        <div className="export-header">
          <h3>Export & Share</h3>
          <button type="button" onClick={closeExportModal}>Close</button>
        </div>
        
        <div className="export-body">
          <div className="export-section">
            <h4>Export Document</h4>
            <div className="export-grid">
              <button 
                className="export-btn" 
                onClick={() => handleExportDocument('html')}
                disabled={processing}
              >
                <span className="export-icon">🌐</span>
                <span>HTML</span>
              </button>
              <button 
                className="export-btn" 
                onClick={() => handleExportDocument('pdf')}
                disabled={processing}
              >
                <span className="export-icon">📄</span>
                <span>PDF</span>
              </button>
              <button 
                className="export-btn" 
                onClick={() => handleExportDocument('docx')}
                disabled={processing}
              >
                <span className="export-icon">📝</span>
                <span>DOCX</span>
              </button>
            </div>
          </div>

          <div className="export-section">
            <h4>Project Share</h4>
            <div className="share-actions">
              <button 
                className="share-btn" 
                onClick={handleExportBundle}
                disabled={processing}
              >
                📤 Export Bundle
              </button>
              <button 
                className="share-btn" 
                onClick={handleImportBundle}
                disabled={processing}
              >
                📥 Import Bundle
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
