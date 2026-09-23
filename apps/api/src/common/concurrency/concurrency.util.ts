/**
 * Concurrency & Batching Utilities (Milestone M36)
 */

/**
 * Splits an array into chunks of a given maximum size and processes each chunk sequentially or in controlled batches.
 */
export async function chunkedExecution<T, R>(
  items: T[],
  chunkSize: number,
  workerFn: (chunk: T[], chunkIndex: number) => Promise<R[]>,
): Promise<R[]> {
  if (!items || items.length === 0) return [];
  const results: R[] = [];
  const totalChunks = Math.ceil(items.length / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = items.slice(i * chunkSize, (i + 1) * chunkSize);
    const chunkResults = await workerFn(chunk, i);
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Executes async tasks over an array with bounded maximum concurrency.
 */
export async function boundedParallel<T, R>(
  items: T[],
  concurrency: number,
  workerFn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items || items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        results[index] = await workerFn(items[index], index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

/**
 * Retries a transient asynchronous operation with exponential backoff and jitter.
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 50,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      if (attempt >= maxRetries) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 20;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
