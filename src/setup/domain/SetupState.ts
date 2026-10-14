export interface SetupStatus {
  completed: boolean;
  currentStep: number;
}

export interface SetupStateRepository {
  getStatus(): Promise<SetupStatus>;
  setProgress(step: number): Promise<void>;
  markCompleted(by: string, at: Date): Promise<void>;
  markReset(by: string, at: Date): Promise<void>;
}

/** Per-action password verification scoped to the setup module reset flow. */
export interface SetupAdminVerifier {
  verifyById(userId: string, password: string): Promise<boolean>;
}
