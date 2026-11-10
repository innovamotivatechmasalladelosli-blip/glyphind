export type RecoverableSnapshot<T> = { savedAt: number; projects: T[] };

export function recoverableSnapshots<T>(snapshots: unknown[]): RecoverableSnapshot<T>[] {
  return snapshots
    .filter((item): item is RecoverableSnapshot<T> => Boolean(
      item && typeof item === 'object' &&
      Number.isFinite((item as RecoverableSnapshot<T>).savedAt) &&
      Array.isArray((item as RecoverableSnapshot<T>).projects),
    ))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function latestRecoverableSnapshot<T>(snapshots: unknown[]): RecoverableSnapshot<T> | undefined {
  return recoverableSnapshots<T>(snapshots)[0];
}
