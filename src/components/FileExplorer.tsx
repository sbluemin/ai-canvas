import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import { TreeEntry } from '../store/types';
import { api } from '../api';
import './FileExplorer.css';

interface FileExplorerProps {
  onSelectFile: (filePath: string) => void;
  onRefreshTree: () => Promise<void>;
}

interface FolderContextMenuState {
  x: number;
  y: number;
  entry: TreeEntry;
}

function TreeNode({
  entry,
  depth,
  activeFile,
  onSelect,
  expandedFolders,
  onToggleFolder,
  onContextMenu,
}: {
  entry: TreeEntry;
  depth: number;
  activeFile: string | null;
  onSelect: (path: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: TreeEntry) => void;
}) {
  const isExpanded = expandedFolders.has(entry.path);

  if (entry.type === 'folder') {
    return (
      <div className="tree-node">
        <button
          type="button"
          className="tree-item tree-folder"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => onToggleFolder(entry.path)}
          onContextMenu={(e) => onContextMenu(e, entry)}
        >
          <span className={`tree-chevron ${isExpanded ? 'expanded' : ''}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M3 2l4 3-4 3V2z" />
            </svg>
          </span>
          <svg className="tree-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 1h5l1 1H14.5a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-12A.5.5 0 0 1 1.5 1z"/>
          </svg>
          <span className="tree-label">{entry.name}</span>
        </button>
        {isExpanded && entry.children && (
          <div className="tree-children">
            {entry.children.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                activeFile={activeFile}
                onSelect={onSelect}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onContextMenu={onContextMenu}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = entry.path === activeFile;
  return (
    <button
      type="button"
      className={`tree-item tree-file ${isActive ? 'active' : ''}`}
      style={{ paddingLeft: `${28 + depth * 16}px` }}
      onClick={() => onSelect(entry.path)}
      onContextMenu={(e) => onContextMenu(e, entry)}
      title={entry.path}
    >
      <svg className="tree-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0H4zM9 1v3.5A1.5 1.5 0 0 0 10.5 6H13v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5z"/>
      </svg>
      <span className="tree-label">{entry.name.replace(/\.md$/, '')}</span>
    </button>
  );
}

export function FileExplorer({ onSelectFile, onRefreshTree }: FileExplorerProps) {
  const {
    projectPath,
    canvasTree,
    activeCanvasFile,
    addToast,
    canvasFiles,
    setCanvasFiles,
    setActiveCanvasFile,
    setCanvasContent,
  } = useStore();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onRefreshTree();
  }, [onRefreshTree]);

  useEffect(() => {
    if (!folderContextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setFolderContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [folderContextMenu]);

  const handleToggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: TreeEntry) => {
    e.preventDefault();
    setFolderContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  const handleNewFolder = async (parentPath?: string) => {
    if (!projectPath) return;
    const name = prompt('Enter folder name')?.trim();
    if (!name) return;

    const folderPath = parentPath ? `${parentPath}/${name}` : name;
    const result = await api.createCanvasFolder(projectPath, folderPath);
    if (!result.success) {
      addToast('error', `Failed: ${result.error}`);
      return;
    }

    if (parentPath) {
      setExpandedFolders((prev) => new Set(prev).add(parentPath));
    }
    await onRefreshTree();
    addToast('success', `Created folder: ${name}`);
  };

  const handleNewFileInFolder = async (folderPath: string) => {
    if (!projectPath) return;
    const name = prompt('Enter file name')?.trim();
    if (!name) return;

    const normalized = name.endsWith('.md') ? name : `${name}.md`;
    const filePath = `${folderPath}/${normalized}`;

    const result = await api.writeCanvasFile(
      projectPath,
      filePath,
      `# ${name.replace(/\.md$/, '')}\n\nStart writing here.\n`,
    );
    if (!result.success) {
      addToast('error', `Failed: ${result.error}`);
      return;
    }

    setCanvasFiles([...canvasFiles, filePath]);
    setExpandedFolders((prev) => new Set(prev).add(folderPath));

    const readResult = await api.readCanvasFile(projectPath, filePath);
    if (readResult.success && readResult.content !== undefined) {
      setActiveCanvasFile(filePath);
      setCanvasContent(readResult.content);
    }
    await onRefreshTree();
    addToast('success', `Created: ${normalized}`);
  };

  const handleDeleteFolder = async (folderPath: string) => {
    if (!projectPath) return;
    const confirmed = confirm(`Delete folder "${folderPath}" and all its contents?`);
    if (!confirmed) return;

    const result = await api.deleteCanvasFolder(projectPath, folderPath);
    if (!result.success) {
      addToast('error', `Failed: ${result.error}`);
      return;
    }

    const updatedFiles = canvasFiles.filter((f) => !f.startsWith(`${folderPath}/`));
    setCanvasFiles(updatedFiles);

    if (activeCanvasFile && activeCanvasFile.startsWith(`${folderPath}/`)) {
      if (updatedFiles.length > 0) {
        onSelectFile(updatedFiles[0]);
      } else {
        setActiveCanvasFile(null);
        setCanvasContent('');
      }
    }
    await onRefreshTree();
    addToast('success', `Deleted folder: ${folderPath}`);
  };

  const handleRenameFolder = async (folderPath: string) => {
    if (!projectPath) return;
    const oldName = folderPath.split('/').pop() ?? folderPath;
    const newName = prompt('Enter new folder name', oldName)?.trim();
    if (!newName || newName === oldName) return;

    const parentPath = folderPath.includes('/') ? folderPath.substring(0, folderPath.lastIndexOf('/')) : '';
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    const result = await api.renameCanvasFolder(projectPath, folderPath, newPath);
    if (!result.success) {
      addToast('error', `Failed: ${result.error}`);
      return;
    }

    const prefix = `${folderPath}/`;
    const updatedFiles = canvasFiles.map((f) =>
      f.startsWith(prefix) ? `${newPath}/${f.substring(prefix.length)}` : f,
    );
    setCanvasFiles(updatedFiles);

    if (activeCanvasFile && activeCanvasFile.startsWith(prefix)) {
      setActiveCanvasFile(`${newPath}/${activeCanvasFile.substring(prefix.length)}`);
    }

    setExpandedFolders((prev) => {
      const next = new Set<string>();
      for (const p of prev) {
        if (p === folderPath) {
          next.add(newPath);
        } else if (p.startsWith(prefix)) {
          next.add(`${newPath}/${p.substring(prefix.length)}`);
        } else {
          next.add(p);
        }
      }
      return next;
    });

    await onRefreshTree();
    addToast('success', `Renamed to: ${newName}`);
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span className="file-explorer-title">Explorer</span>
        <div className="file-explorer-actions">
          <button
            type="button"
            className="file-explorer-action-btn"
            onClick={() => handleNewFolder()}
            title="New folder"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1h5l1 1H14.5a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-12A.5.5 0 0 1 1.5 1z"/>
            </svg>
            <span>+</span>
          </button>
          <button
            type="button"
            className="file-explorer-action-btn"
            onClick={onRefreshTree}
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
              <path d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A5.501 5.501 0 0 1 13.5 8a.5.5 0 0 1-1 0 4.5 4.5 0 0 0-4.5-4.5zM2.5 8a.5.5 0 0 1 1 0 4.5 4.5 0 0 0 8.357 2.318.5.5 0 1 1 .771.636A5.501 5.501 0 0 1 2.5 8z"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="file-explorer-tree">
        {canvasTree.length === 0 ? (
          <div className="file-explorer-empty">
            No files yet.
          </div>
        ) : (
          canvasTree.map((entry) => (
            <TreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              activeFile={activeCanvasFile}
              onSelect={onSelectFile}
              expandedFolders={expandedFolders}
              onToggleFolder={handleToggleFolder}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {folderContextMenu && (
        <div
          ref={contextMenuRef}
          className="tab-context-menu"
          style={{ top: folderContextMenu.y, left: folderContextMenu.x }}
        >
          {folderContextMenu.entry.type === 'folder' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  handleNewFileInFolder(folderContextMenu.entry.path);
                  setFolderContextMenu(null);
                }}
              >
                New File
              </button>
              <button
                type="button"
                onClick={() => {
                  handleNewFolder(folderContextMenu.entry.path);
                  setFolderContextMenu(null);
                }}
              >
                New Subfolder
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRenameFolder(folderContextMenu.entry.path);
                  setFolderContextMenu(null);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  handleDeleteFolder(folderContextMenu.entry.path);
                  setFolderContextMenu(null);
                }}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onSelectFile(folderContextMenu.entry.path);
                  setFolderContextMenu(null);
                }}
              >
                Open
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
