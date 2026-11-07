import pkg from '../../package.json';

export const APP_RAW_VERSION = pkg.version || '3.0.0';
export const APP_SEMVER = APP_RAW_VERSION;
export const APP_VERSION = `v${APP_RAW_VERSION.replace(/^v/i, '')}`;
export const APP_BUILD_DATE = new Date().toISOString().slice(0, 10);
