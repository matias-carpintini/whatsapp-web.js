'use strict';

console.log('Starting to load required modules...');

/* Require Optional Dependencies */
try {
    var fs = require('fs-extra');
    console.log('remoteAuth/Loaded fs-extra module successfully.');
    var AdmZip = require('adm-zip');
    console.log('remoteAuth/Loaded AdmZip module successfully.');
    var archiver = require('archiver');
    console.log('remoteAuth/Loaded archiver module successfully.');
} catch {
    console.log('remoteAuth/Failed to load one or more optional dependencies. Setting them to undefined.');
    fs = undefined;
    AdmZip = undefined;
    archiver = undefined;
}

const path = require('path');
console.log('remoteAuth/Loaded path module successfully.');
const { Events } = require('./../util/Constants');
console.log('remoteAuth/Loaded Events from Constants successfully.');
const BaseAuthStrategy = require('./BaseAuthStrategy');
console.log('remoteAuth/Loaded BaseAuthStrategy successfully.');

console.log('remoteAuth/Starting RemoteAuth class definition...');

/**
 * Remote-based authentication
 * @param {object} options - options
 * @param {object} options.store - Remote database store instance
 * @param {string} options.clientId - Client id to distinguish instances if you are using multiple, otherwise keep null if you are using only one instance
 * @param {string} options.dataPath - Change the default path for saving session files, default is: "./.wwebjs_auth/"
 * @param {number} options.backupSyncIntervalMs - Sets the time interval for periodic session backups. Accepts values starting from 60000ms {1 minute}
 */
class RemoteAuth extends BaseAuthStrategy {
    constructor({ clientId, dataPath, store, backupSyncIntervalMs } = {}) {
        console.log('remoteAuth/Initializing RemoteAuth with clientId:', clientId);
        if (!fs && !AdmZip && !archiver) {
            console.log('remoteAuth/Error: Optional dependencies are missing.');
            throw new Error('remoteAuth/Optional Dependencies [fs-extra, adm-zip, archiver] are required to use RemoteAuth. Make sure to run npm install correctly and remove the --no-optional flag');
        }
        super();

        const idRegex = /^[-_\w]+$/i;
        if (clientId && !idRegex.test(clientId)) {
            console.log('remoteAuth/Error: Invalid clientId provided.');
            throw new Error('Invalid clientId. Only alphanumeric characters, underscores and hyphens are allowed.');
        }
        if (!backupSyncIntervalMs || backupSyncIntervalMs < 60000) {
            console.log('remoteAuth/Error: Invalid backupSyncIntervalMs provided.');
            throw new Error('Invalid backupSyncIntervalMs. Accepts values starting from 60000ms {1 minute}.');
        }
        if(!store) {
            console.log('remoteAuth/Error: Remote database store is required but not provided.');
            throw new Error('Remote database store is required.');
        }

        this.store = store;
        this.clientId = clientId;
        this.backupSyncIntervalMs = backupSyncIntervalMs;
        this.dataPath = path.resolve(dataPath || './.wwebjs_auth/');
        this.tempDir = `${this.dataPath}/wwebjs_temp_session_${this.clientId}`;
        this.requiredDirs = ['Default', 'IndexedDB', 'Local Storage'];
        console.log('remoteAuth/RemoteAuth initialized successfully.');
    }

    async beforeBrowserInitialized() {
        console.log('remoteAuth/Executing beforeBrowserInitialized...');
        const puppeteerOpts = this.client.options.puppeteer;
        const sessionDirName = this.clientId ? `RemoteAuth-${this.clientId}` : 'RemoteAuth';
        const dirPath = path.join(this.dataPath, sessionDirName);

        if (puppeteerOpts.userDataDir && puppeteerOpts.userDataDir !== dirPath) {
            console.log('remoteAuth/Error: RemoteAuth is not compatible with a user-supplied userDataDir.');
            throw new Error('RemoteAuth is not compatible with a user-supplied userDataDir.');
        }

        this.userDataDir = dirPath;
        this.sessionName = sessionDirName;

        console.log('remoteAuth/this.userDataDir set to:', this.userDataDir);
        console.log('remoteAuth/this.sessionName set to:', this.sessionName);
        await this.extractRemoteSession();

        this.client.options.puppeteer = {
            ...puppeteerOpts,
            userDataDir: dirPath
        };
        console.log('remoteAuth/beforeBrowserInitialized completed.');
    }

    async logout() {
        console.log('remoteAuth/Executing logout...');
        await this.disconnect();
        console.log('remoteAuth/Logout completed.');
    }

    async destroy() {
        console.log('remoteAuth/Executing destroy...');
        clearInterval(this.backupSync);
        console.log('remoteAuth/Destroy completed.');
    }

    async disconnect() {
        console.log('remoteAuth/Executing disconnect...');
        await this.deleteRemoteSession();

        let pathExists = await this.isValidPath(this.userDataDir);
        console.log('remoteAuth/disconnect/Path exists check for disconnect:', pathExists);
        console.log('remoteAuth/disconnect/this.userDataDir during disconnect:', this.userDataDir);
        console.log('remoteAuth/disconnect/this.backupSync during disconnect:', this.backupSync);
        console.log('----------------------------------------------------------------------------------------------');
        if (pathExists) {
            console.log('remoteAuth/disconnect/Attempting to remove userDataDir...');
            await fs.promises.rm(this.userDataDir, {
                recursive: true,
                force: true
            }).catch((error) => {
                console.error('remoteAuth/disconnect/Error deleting userDataDir:', error);
            });
        }
        clearInterval(this.backupSync);
        console.log('remoteAuth/disconnect/Disconnect completed.');
    }

    async afterAuthReady() {
        console.log('remoteAuth/afterAuthReady init...');
        const sessionExists = await this.store.sessionExists({session: this.sessionName});
        console.log('remoteAuth/afterAuthReady/Session exists check:', sessionExists);
        if(!sessionExists) {
            console.log('remoteAuth/afterAuthReady/Session does not exist. Waiting for initial sync delay...');
            await this.delay(60000); /* Initial delay sync required for session to be stable enough to recover */
            console.log('remoteAuth/afterAuthReady/Storing remote session after initial delay...');
            await this.storeRemoteSession({emit: true});
        }
        var self = this;
        this.backupSync = setInterval(async function () {
            console.log('remoteAuth/afterAuthReady/Storing remote session in backupSync interval...');
            await self.storeRemoteSession();
        }, this.backupSyncIntervalMs);
        console.log('remoteAuth/afterAuthReady/afterAuthReady completed.');
    }

    async storeRemoteSession(options) {
        console.log('remoteAuth/storeRemoteSession/Executing storeRemoteSession...');
        /* Compress & Store Session */
        const pathExists = await this.isValidPath(this.userDataDir);
        console.log('remoteAuth/afterAuthReady/Path exists check for storeRemoteSession:', pathExists);
        if (pathExists) {
            console.log('remoteAuth/afterAuthReady/Compressing and storing session...');
            await this.compressSession();
            await this.store.save({session: this.sessionName});
            console.log('remoteAuth/afterAuthReady/Removing compressed session and temp directory...');
            await fs.promises.unlink(`${this.sessionName}.zip`);
            await fs.promises.rm(`${this.tempDir}`, {
                recursive: true,
                force: true
            }).catch(() => {});
            if(options && options.emit) {
                console.log('remoteAuth/afterAuthReady/Emitting REMOTE_SESSION_SAVED event...');
                this.client.emit(Events.REMOTE_SESSION_SAVED);
            }
        }
        console.log('storeRemoteSession completed.');
    }

    async extractRemoteSession() {
        console.log('remoteAuth/extractRemoteSession/Executing extractRemoteSession...');
        const pathExists = await this.isValidPath(this.userDataDir);
        const compressedSessionPath = `${this.sessionName}.zip`;
        const sessionExists = await this.store.sessionExists({session: this.sessionName});
        console.log('remoteAuth/extractRemoteSession/Path exists check for extractRemoteSession:', pathExists);
        console.log('remoteAuth/extractRemoteSession/Session exists check for extractRemoteSession:', sessionExists);
        console.log('remoteAuth/extractRemoteSession/Compressed session path:', compressedSessionPath);
        if (pathExists) {
            console.log('remoteAuth/extractRemoteSession/Removing existing userDataDir...');
            await fs.promises.rm(this.userDataDir, {
                recursive: true,
                force: true
            }).catch((error) => {
                console.error('remoteAuth/extractRemoteSession/Error deleting existing userDataDir:', error);
            });
        }
        if (sessionExists) {
            console.log('remoteAuth/extractRemoteSession/Extracting and decompressing session...');
            await this.store.extract({session: this.sessionName, path: compressedSessionPath});
            await this.unCompressSession(compressedSessionPath);
        } else {
            console.log('remoteAuth/extractRemoteSession/Session does not exist. Creating userDataDir...');
            fs.mkdirSync(this.userDataDir, { recursive: true });
        }
        console.log('remoteAuth/extractRemoteSession/extractRemoteSession completed.');
    }

    async deleteRemoteSession() {
        console.log('remoteAuth/deleteRemoteSession/Executing deleteRemoteSession...');
        const sessionExists = await this.store.sessionExists({session: this.sessionName});
        console.log('remoteAuth/deleteRemoteSession/Session exists check for deleteRemoteSession:', sessionExists);
        if (sessionExists) {
            console.log('remoteAuth/deleteRemoteSession/Deleting remote session...');
            await this.store.delete({session: this.sessionName});
        }
        console.log('remoteAuth/deleteRemoteSession/deleteRemoteSession completed.');
    }

    async compressSession() {
        console.log('remoteAuth/compressSession/Executing compressSession...');
        const archive = archiver('zip');
        const stream = fs.createWriteStream(`${this.sessionName}.zip`);

        console.log('remoteAuth/compressSession/Copying userDataDir to tempDir...');
        await fs.copy(this.userDataDir, this.tempDir).catch(() => {});
        console.log('remoteAuth/compressSession/Deleting metadata...');
        await this.deleteMetadata();
        console.log('remoteAuth/compressSession/Archiving session...');
        return new Promise((resolve, reject) => {
            archive
                .directory(this.tempDir, false)
                .on('error', err => reject(err))
                .pipe(stream);

            stream.on('close', () => {
                console.log('remoteAuth/compressSession/Session compressed successfully.');
                resolve();
            });
            archive.finalize();
        });
    }

    async unCompressSession(compressedSessionPath) {
         await new Promise((resolve, reject) => {
            const zip = new AdmZip(compressedSessionPath, {}); 
            zip.extractAllToAsync(this.userDataDir, true, false, (err) => {
                if (err) {
                    console.log('remoteAuth/unCompressSession/Session could not be decompressed. Error!.');
                    reject(err);
                } else {
                    console.log('remoteAuth/unCompressSession/Session decompressed successfully.');
                    resolve();
                }
            });
        });
        console.log('remoteAuth/unCompressSession/Removing compressed session file...');
        await fs.promises.unlink(compressedSessionPath);
    }

    async deleteMetadata() {
        console.log('remoteAuth/deleteMetadata/Executing deleteMetadata...');
        const sessionDirs = [path.join(this.tempDir, 'Default'), this.tempDir,];
        console.log('remoteAuth/deleteMetadata/Session directories for metadata deletion:', sessionDirs);
        for (const dir of sessionDirs) {
            const sessionFiles = await fs.promises.readdir(dir);
            for (const element of sessionFiles) {
                if (!this.requiredDirs.includes(element)) {
                    const dirElement = path.join(dir, element);
                    const stats = await fs.promises.lstat(dirElement);

                    if (stats.isDirectory()) {
                        console.log('remoteAuth/deleteMetadata/Removing directory:', dirElement);
                        await fs.promises.rm(dirElement, {
                            recursive: true,
                            force: true
                        }).catch(() => {});
                    } else {
                        console.log('remoteAuth/deleteMetadata/Removing file:', dirElement);
                        await fs.promises.unlink(dirElement).catch(() => {});
                    }
                }
            }
        }
        console.log('remoteAuth/deleteMetadata/Metadata deletion completed.');
    }

    async isValidPath(path) {
        try {
            await fs.promises.access(path);
            console.log('isValidpath/Path is valid:', path);
            return true;
        } catch {
            console.log('isValidpath/Path is not valid:', path);
            return false;
        }
    }

    async delay(ms) {
        console.log(`delay/Starting delay for ${ms} milliseconds...`);
        return new Promise(resolve => setTimeout(() => {
            console.log('delay/Delay completed.');
            resolve();
        }, ms));
    }
}

console.log('remoteAuth/RemoteAuth class defined successfully. Preparing to export...');

module.exports = RemoteAuth;

console.log('remoteAuth/RemoteAuth module exported successfully.');
