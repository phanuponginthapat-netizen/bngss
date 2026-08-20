import { WebPlugin } from '@capacitor/core';
import type { ApkUpdaterPlugin, DownloadApkOptions, DownloadApkResult, GetAppVersionResult, InstallApkOptions } from './definitions';
export declare class ApkUpdaterWeb extends WebPlugin implements ApkUpdaterPlugin {
    getAppVersion(): Promise<GetAppVersionResult>;
    downloadApk(_options: DownloadApkOptions): Promise<DownloadApkResult>;
    installApk(_options: InstallApkOptions): Promise<void>;
}
