import { WebPlugin } from '@capacitor/core';
export class ApkUpdaterWeb extends WebPlugin {
    async getAppVersion() {
        throw this.unavailable('getAppVersion is not supported on web');
    }
    async downloadApk(_options) {
        throw this.unavailable('downloadApk is not supported on web');
    }
    async installApk(_options) {
        throw this.unavailable('installApk is not supported on web');
    }
}
//# sourceMappingURL=web.js.map