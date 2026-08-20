import { registerPlugin } from '@capacitor/core';
const ApkUpdater = registerPlugin('ApkUpdater', {
    web: () => import('./web').then((m) => new m.ApkUpdaterWeb()),
});
export * from './definitions';
export { ApkUpdater };
//# sourceMappingURL=index.js.map