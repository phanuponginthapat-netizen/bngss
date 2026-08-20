'use strict';

var core = require('@capacitor/core');

const ApkUpdater = core.registerPlugin('ApkUpdater', {
    web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.ApkUpdaterWeb()),
});

class ApkUpdaterWeb extends core.WebPlugin {
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

var web = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ApkUpdaterWeb: ApkUpdaterWeb
});

exports.ApkUpdater = ApkUpdater;
//# sourceMappingURL=plugin.cjs.js.map
