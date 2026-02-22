import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { TerminalIcon } from './Icons';
import './CommandPalette.css';

type PaletteCommand = {
  id: 'open-opencode-terminal';
  label: string;
  disabled: boolean;
  disabledReason?: string;
  run: () => Promise<void>;
};

function matchesQuery(label: string, query: string): boolean {
  const normalizedLabel = label.toLowerCase();
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return true;
  return tokens.every((token) => normalizedLabel.includes(token));
}

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    closeCommandPalette,
    runtimeStatus,
    projectPath,
    addToast,
  } = useStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const runtimeReady = !!runtimeStatus && runtimeStatus.activeRuntime !== 'none';
  const projectReady = !!projectPath;

  const commands = useMemo<PaletteCommand[]>(() => {
    const disabled = !runtimeReady || !projectReady;
    const disabledReason = !projectReady
      ? 'Open a project first'
      : !runtimeReady
        ? 'Runtime setup required'
        : undefined;

    return [
      {
        id: 'open-opencode-terminal',
        label: 'Open OpenCode Terminal',
        disabled,
        disabledReason,
        run: async () => {
          const result = await api.runtimeOpenTerminal(projectPath);
          if (result.success) {
            addToast('success', 'OpenCode terminal opened');
            return;
          }

          addToast('error', result.error ?? 'Failed to launch terminal');
        },
      },
    ];
  }, [addToast, projectPath, projectReady, runtimeReady]);

  const filteredCommands = useMemo(() => {
    return commands.filter((command) => matchesQuery(command.label, query));
  }, [commands, query]);

  useEffect(() => {
    if (!isCommandPaletteOpen) return;

    setQuery('');
    setSelectedIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    if (selectedIndex < filteredCommands.length) return;
    setSelectedIndex(0);
  }, [filteredCommands.length, selectedIndex]);

  useEffect(() => {
    if (!isCommandPaletteOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCommandPalette();
        return;
      }

      if (filteredCommands.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const command = filteredCommands[selectedIndex];
        if (!command || command.disabled) return;

        void command.run();
        closeCommandPalette();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeCommandPalette, filteredCommands, isCommandPaletteOpen, selectedIndex]);

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="command-palette-overlay">
      <button
        type="button"
        className="command-palette-backdrop"
        onClick={closeCommandPalette}
        aria-label="Close command palette"
      />
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="command-palette-search-row">
          <svg className="command-palette-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="20" y1="20" x2="16.5" y2="16.5" />
          </svg>
          <input
            ref={inputRef}
            className="command-palette-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command"
            aria-label="Command palette search"
          />
        </div>

        <div className="command-palette-list" role="listbox" aria-label="Command palette commands">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">No matching commands</div>
          ) : (
            filteredCommands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                className={`command-palette-item${index === selectedIndex ? ' active' : ''}${command.disabled ? ' disabled' : ''}`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  if (command.disabled) return;
                  void command.run();
                  closeCommandPalette();
                }}
                disabled={command.disabled}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <span className="command-palette-item-main">
                  <TerminalIcon width={14} height={14} />
                  <span>{command.label}</span>
                </span>
                {command.disabledReason && (
                  <span className="command-palette-item-badge">{command.disabledReason}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
