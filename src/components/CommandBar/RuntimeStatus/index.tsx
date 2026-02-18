import { useStore } from '../../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import './RuntimeStatus.css';

function getRuntimeLabel(status: ReturnType<typeof useStore.getState>['runtimeStatus']) {
  if (!status) return 'Runtime Missing';
  if (status.activeRuntime === 'none') return 'Runtime Missing';
  if (status.activeRuntime === 'global') return 'Global Runtime';
  return 'Project Runtime';
}

function getRuntimeStateClass(status: ReturnType<typeof useStore.getState>['runtimeStatus']) {
  if (!status || status.activeRuntime === 'none') return 'missing';
  return 'ready';
}

export function RuntimeStatusBadge() {
  const { runtimeStatus, openOnboarding } = useStore(useShallow((state) => ({
    runtimeStatus: state.runtimeStatus,
    openOnboarding: state.openOnboarding,
  })));

  const label = getRuntimeLabel(runtimeStatus);
  const stateClass = getRuntimeStateClass(runtimeStatus);

  return (
    <button type="button" className={`runtime-status-badge ${stateClass}`} onClick={openOnboarding} title="Runtime status">
      <span className="runtime-status-dot" aria-hidden="true" />
      <span className="runtime-status-label">{label}</span>
    </button>
  );
}
