import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/useStore';
import { api, type RuntimeInstallProgress } from '../api';
import './OnboardingWizard.css';

type WizardStep = 'choice' | 'install';

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

  const [installProgress, setInstallProgress] = useState(0);
  const [installPhase, setInstallPhase] = useState<RuntimeInstallProgress['phase'] | null>(null);

  const step = useMemo<WizardStep | null>(() => {
    if (!runtimeStatus) return 'install';
    if (runtimeStatus.onboardingDone) {
      if (runtimeStatus.activeRuntime === 'none') return 'install';
      return null;
    }

    if (runtimeStatus.globalInstalled && !runtimeStatus.localInstalled && runtimeStatus.mode === 'auto') return 'choice';
    if (runtimeStatus.activeRuntime === 'none') return 'install';
    return null;
  }, [runtimeStatus]);

  useEffect(() => {
    if (!projectPath) {
      return;
    }

    return api.onRuntimeInstallProgress((progress) => {
      if (progress.projectPath !== projectPath) {
        return;
      }

      setInstallProgress(progress.percent);
      setInstallPhase(progress.phase);
    });
  }, [projectPath]);

  useEffect(() => {
    if (!isOnboardingOpen || !projectPath) {
      return;
    }

    if (!step) {
      closeOnboarding();
    }
  }, [isOnboardingOpen, projectPath, step, closeOnboarding]);

  useEffect(() => {
    if (step !== 'install') {
      setInstallProgress(0);
      setInstallPhase(null);
    }
  }, [step]);

  if (!isOnboardingOpen || !projectPath || !step) return null;

  const progressPercent = Math.max(0, Math.min(100, Math.round(installProgress)));
  const isInstallDownloading = runtimeBusy && installPhase === 'downloading';
  const isInstallFinalizing = runtimeBusy && (installPhase === 'extracting' || installPhase === 'finalizing');
  const showInstallProgress = step === 'install' && installPhase !== null && installPhase !== 'error';

  const installButtonLabel = isInstallDownloading
    ? `OpenCode 다운로드 중... ${progressPercent}%`
    : isInstallFinalizing
      ? '시스템에 설정하는 중...'
      : installPhase === 'done' && !runtimeBusy
        ? '설치 완료'
        : 'OpenCode 설치하기';

  const runWithBusy = async (action: () => Promise<void>) => {
    setRuntimeBusy(true);
    setRuntimeError(null);
    try {
      await action();
    } finally {
      setRuntimeBusy(false);
    }
  };

  const refreshStatus = async () => {
    const statusResult = await api.runtimeCheckStatus(projectPath);
    if (statusResult.success && statusResult.data) {
      setRuntimeStatus(statusResult.data);
      setRuntimeError(null);
      return;
    }

    setRuntimeError(statusResult.error ?? '런타임 상태를 불러오지 못했습니다');
  };

  const chooseGlobal = async () => {
    await runWithBusy(async () => {
      const result = await api.runtimeSetMode(projectPath, 'global');
      if (result.success && result.data) {
        const doneResult = await api.runtimeCompleteOnboarding(projectPath);
        if (doneResult.success && doneResult.data) {
          setRuntimeStatus(doneResult.data);
          setOnboardingDismissed(true);
          closeOnboarding();
          return;
        }

        setRuntimeError(doneResult.error ?? '온보딩 완료 처리에 실패했습니다');
        return;
      }

      setRuntimeError(result.error ?? '글로벌 런타임 선택에 실패했습니다');
    });
  };

  const installLocal = async () => {
    setInstallProgress(0);
    setInstallPhase('downloading');

    await runWithBusy(async () => {
      const result = await api.runtimeInstallLocal(projectPath);
      if (result.success && result.data) {
        setInstallProgress(100);
        setInstallPhase('done');

        const doneResult = await api.runtimeCompleteOnboarding(projectPath);
        if (doneResult.success && doneResult.data) {
          setRuntimeStatus(doneResult.data);
          setOnboardingDismissed(true);
          closeOnboarding();
          return;
        }

        setRuntimeError(doneResult.error ?? '온보딩 완료 처리에 실패했습니다');
        return;
      }

      setInstallPhase('error');
      setRuntimeError(result.error ?? '프로젝트 런타임 설치에 실패했습니다');
    });
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

      setRuntimeError(result.error ?? '온보딩 완료 처리에 실패했습니다');
    });
  };

  const skipForNow = () => {
    void completeOnboarding();
  };

  return (
    <div className="onboarding-overlay" onClick={skipForNow}>
      <div className="onboarding-modal" onClick={(event) => event.stopPropagation()}>
        <div className="onboarding-header">
          <h3>AI 기능 준비</h3>
          <button type="button" onClick={skipForNow}>나중에</button>
        </div>

        {step === 'choice' && (
          <div className="onboarding-body">
            <p>이미 설치된 AI 엔진을 찾았습니다. 이 프로젝트에서 사용할 방식을 선택해주세요.</p>
            <div className="onboarding-action-row">
              <button type="button" className="onboarding-secondary" onClick={chooseGlobal} disabled={runtimeBusy}>글로벌 엔진 사용</button>
              <button type="button" className="onboarding-primary" onClick={installLocal} disabled={runtimeBusy}>프로젝트 전용 설치</button>
            </div>
          </div>
        )}

        {step === 'install' && (
          <div className="onboarding-body">
            <p>AI 기능을 활성화하기 위해 전용 엔진을 설치합니다.</p>
            <div className="onboarding-action-row">
              <button type="button" className="onboarding-primary" onClick={installLocal} disabled={runtimeBusy}>{installButtonLabel}</button>
              <button type="button" className="onboarding-secondary" onClick={refreshStatus} disabled={runtimeBusy}>{runtimeError ? '다시 시도' : '다시 확인'}</button>
            </div>
            {showInstallProgress && (
              <div className="onboarding-progress" role="status" aria-live="polite">
                <div className="onboarding-progress-track">
                  <div className="onboarding-progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="onboarding-progress-text">{progressPercent}%</span>
              </div>
            )}
          </div>
        )}

        {runtimeError && <p className="onboarding-error">{runtimeError}</p>}
      </div>
    </div>
  );
}
