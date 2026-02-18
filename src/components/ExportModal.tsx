import { useState } from 'react';
import { useStore, type ShareBundle } from '../store/useStore';
import { api } from '../api';
import { CloseIcon, GlobeIcon, FileTextIcon, FilePenIcon, UploadIcon, DownloadIcon } from './Icons';
import './ExportModal.css';

type ExportFormat = 'html' | 'pdf' | 'docx';

const EXPORT_FORMATS: { id: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'html', label: 'HTML', desc: 'Web page', icon: <GlobeIcon width={24} height={24} /> },
  { id: 'pdf',  label: 'PDF',  desc: 'Print-ready', icon: <FileTextIcon width={24} height={24} /> },
  { id: 'docx', label: 'DOCX', desc: 'Word document', icon: <FilePenIcon width={24} height={24} /> },
];

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
    restoreState,
  } = useStore();
  
  const [processing, setProcessing] = useState(false);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);

  const handleExportDocument = async (format: ExportFormat) => {
    if (!projectPath) return;
    setProcessing(true);
    setActiveFormat(format);
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
      setActiveFormat(null);
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
        canvasContent,
        autosaveStatus,
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
        restoreState(result.bundle as ShareBundle);
        addToast('success', 'Share bundle imported.');
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
    <div className="export-overlay" onClick={closeExportModal}>
      <div className="export-modal" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <header className="export-header">
          <h4 className="export-title">Export & Share</h4>
          <button type="button" className="export-close-btn" onClick={closeExportModal} aria-label="Close export">
            <CloseIcon />
          </button>
        </header>

        {/* 본문 */}
        <div className="export-body">
          {/* 문서 내보내기 섹션 */}
          <section className="export-section">
            <span className="export-section-label">Document</span>
            <div className="export-format-grid">
              {EXPORT_FORMATS.map(fmt => (
                <button
                  key={fmt.id}
                  type="button"
                  className={`export-format-card${activeFormat === fmt.id ? ' active' : ''}`}
                  onClick={() => handleExportDocument(fmt.id)}
                  disabled={processing}
                >
                  <span className="format-icon">{fmt.icon}</span>
                  <span className="format-label">{fmt.label}</span>
                  <span className="format-desc">{fmt.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 구분선 */}
          <div className="export-divider" />

          {/* 프로젝트 공유 섹션 */}
          <section className="export-section">
            <span className="export-section-label">Project Bundle</span>
            <div className="export-share-row">
              <button
                type="button"
                className="export-share-btn"
                onClick={handleExportBundle}
                disabled={processing}
              >
                <UploadIcon width={16} height={16} />
                <span>Export</span>
              </button>
              <button
                type="button"
                className="export-share-btn"
                onClick={handleImportBundle}
                disabled={processing}
              >
                <DownloadIcon width={16} height={16} />
                <span>Import</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
