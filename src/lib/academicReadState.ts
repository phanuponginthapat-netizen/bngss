type ReadStatus = { error?: unknown; isLoading?: boolean; isFetching?: boolean };

export function academicReadState(reads: ReadStatus[], extraLoading = false, extraError?: unknown) {
  const error = extraError || reads.find(read => read.error)?.error;
  const loading = extraLoading || reads.some(read => read.isLoading || read.isFetching);
  return { error, loading, ready: !error && !loading };
}