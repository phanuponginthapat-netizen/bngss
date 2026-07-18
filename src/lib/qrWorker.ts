export const createQRWorker = () => {
  const workerCode = `
    importScripts('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js');
    self.onmessage = function(e) {
      const { data, width, height } = e.data;
      const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
      if (result) {
        self.postMessage({ data: result.data });
      } else {
        self.postMessage({ data: null });
      }
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};
