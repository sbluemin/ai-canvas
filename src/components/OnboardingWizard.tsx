import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/useStore';
import { api } from '../api';
import './OnboardingWizard.css';

type WizardStep = 'setup';

export function OnboardingWizard() {
  const {
    projectPath,
    runtimeStatus,
    runtimeBusy,
    runtimeError,
    isOnboardingOpen,
    closeOnboarding,
    setOnboardingDismissed,
    setRuntimeBusy,
    setRuntimeError,
    setRuntimeStatus,
  } = useStore(useShallow((state) => ({
    projectPath: state.projectPath,
    runtimeStatus: state.runtimeStatus,
    runtimeBusy: state.runtimeBusy,
    runtimeError: state.runtimeError,
    isOnboardingOpen: state.isOnboardingOpen,
    closeOnboarding: state.closeOnboarding,
    setOnboardingDismissed: state.setOnboardingDismissed,
    setRuntimeBusy: state.setRuntimeBusy,
    setRuntimeError: state.setRuntimeError,
    setRuntimeStatus: state.setRuntimeStatus,
  })));

  const step = useMemo<WizardStep | null>(() => {
    if (!runtimeStatus) return 'setup';
    if (runtimeStatus.activeRuntime === 'none') return 'setup';
    return null;
  }, [runtimeStatus]);

  useEffect(() => {
    if (!isOnboardingOpen) {
      return;
    }

    if (!step) {
      closeOnboarding();
    }
  }, [isOnboardingOpen, step, closeOnboarding]);

  if (!isOnboardingOpen || !step) return null;

  const runWithBusy = async (action: () => Promise<void>) => {
    setRuntimeBusy(true);
    setRuntimeError(null);
    try {
      await action();
    } finally {
      setRuntimeBusy(false);
    }
  };

  const completeOnboarding = async () => {
    await runWithBusy(async () => {
      const result = await api.runtimeCompleteOnboarding(projectPath);
      if (result.success && result.data) {
        setRuntimeStatus(result.data);
        setOnboardingDismissed(true);
        closeOnboarding();
        return;
      }

      setRuntimeError(result.error ?? 'Failed to complete onboarding');
    });
  };

  const refreshStatus = async () => {
    await runWithBusy(async () => {
      const statusResult = await api.runtimeCheckStatus(projectPath);
      if (statusResult.success && statusResult.data) {
        setRuntimeStatus(statusResult.data);
        setRuntimeError(null);

        if (statusResult.data.activeRuntime !== 'none') {
          const doneResult = await api.runtimeCompleteOnboarding(projectPath);
          if (doneResult.success && doneResult.data) {
            setRuntimeStatus(doneResult.data);
            setOnboardingDismissed(true);
            closeOnboarding();
            return;
          }

          setRuntimeError(doneResult.error ?? 'Failed to complete onboarding');
          return;
        }

        setRuntimeError('AI 인증이 아직 설정되지 않았습니다. Settings에서 API Key 또는 OAuth를 연결해주세요.');
        return;
      }

      setRuntimeError(statusResult.error ?? 'Failed to load runtime status');
    });
  };

  const skipForNow = () => {
    void completeOnboarding();
  };

  return (
    <div className="onboarding-overlay">
      <button
        type="button"
        className="onboarding-backdrop"
        onClick={skipForNow}
        aria-label="Close AI setup"
      />
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <h3>AI Setup</h3>
          <button type="button" onClick={skipForNow}>Later</button>
        </div>

        <div className="onboarding-body">
          <p>
            AI 사용을 위해 인증 설정이 필요합니다.
            Settings의 AI Runtime 탭에서 API Key 또는 OAuth를 설정한 뒤 다시 확인해주세요.
          </p>
          <div className="onboarding-action-row">
            <button type="button" className="onboarding-primary" onClick={refreshStatus} disabled={runtimeBusy}>
              {runtimeBusy ? 'Checking...' : 'I Completed Auth Setup'}
            </button>
            <button type="button" className="onboarding-secondary" onClick={skipForNow} disabled={runtimeBusy}>
              Later
            </button>
          </div>
        </div>

        {runtimeError && <p className="onboarding-error">{runtimeError}</p>}
      </div>
    </div>
  );
}
