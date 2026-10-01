/** Stop scheduling immediately, then wait for the current sweep to finish. */
export function startIntervalWorker(
  sweep: (isStopped: () => boolean) => Promise<void>,
  intervalMs: number,
  onError: (error: unknown) => void
): () => Promise<void> {
  let stopped = false;
  let active: Promise<void> | undefined;
  const tick = () => {
    if (stopped || active) return;
    active = Promise.resolve()
      .then(() => stopped ? undefined : sweep(() => stopped))
      .catch(onError)
      .finally(() => { active = undefined; });
  };
  const timer = setInterval(tick, intervalMs);
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await active;
  };
}
