import { useStore } from '../../../store/useStore';
import { api } from '../../../api';
import './ProjectSelector.css';

export function ProjectSelector() {
  const { 
    projectPath, 
    setProjectPath, 
    setCanvasFiles, 
    setActiveCanvasFile, 
    setCanvasContent,
    clearMessages,
  } = useStore();

  const handleOpenProject = async () => {
    const path = await api.openProjectDirectory();
    if (!path) return;

    await api.initCanvasDir(path);
    const listResult = await api.listCanvasFiles(path);

    if (!listResult.success || !listResult.files) {
      console.error('캔버스 파일 목록 조회 실패:', listResult.error);
      return;
    }

    let files = listResult.files;

    if (files.length === 0) {
      const createResult = await api.createDefaultCanvas(path);
      if (createResult.success && createResult.fileName) {
        files = [createResult.fileName];
      }
    }

    setProjectPath(path);
    setCanvasFiles(files);
    clearMessages();

    if (files.length > 0) {
      const firstFile = files[0];
      const readResult = await api.readCanvasFile(path, firstFile);
      if (readResult.success && readResult.content !== undefined) {
        setActiveCanvasFile(firstFile);
        setCanvasContent(readResult.content);
      }
    }
  };

  const projectName = projectPath ? projectPath.split('/').pop() : null;

  return (
    <div className="project-selector" onClick={handleOpenProject}>
      <div className="project-label">
        <span className="project-name">{projectName ?? 'AI Canvas'}</span>
        <span className="project-selector-arrow">▾</span>
      </div>
    </div>
  );
}
