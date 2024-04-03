'use strict';

console.log('Starting to load required modules...');

/* Require Optional Dependencies */
try {
    var fs = require('fs-extra');
    console.log('Loaded fs-extra module successfully.');
    var AdmZip = require('adm-zip');
    console.log('Loaded AdmZip module successfully.');
    var archiver = require('archiver');
    console.log('Loaded archiver module successfully.');
} catch {
    console.log('Failed to load one or more optional dependencies. Setting them to undefined.');
    fs = undefined;
    AdmZip = undefined;
    archiver = undefined;
}

const path = require('path');
console.log('Loaded path module successfully.');
const { Events } = require('./../util/Constants');
console.log('Loaded Events from Constants successfully.');
const BaseAuthStrategy = require('./BaseAuthStrategy');
console.log('Loaded BaseAuthStrategy successfully.');

console.log('Starting RemoteAuth class definition...');

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
        console.log('Initializing RemoteAuth with clientId:', clientId);
        if (!fs && !AdmZip && !archiver) {
            console.log('Error: Optional dependencies are missing.');
            throw new Error('Optional Dependencies [fs-extra, adm-zip, archiver] are required to use RemoteAuth. Make sure to run npm install correctly and remove the --no-optional flag');
        }
        super();

        const idRegex = /^[-_\w]+$/i;
        if (clientId && !idRegex.test(clientId)) {
            console.log('Error: Invalid clientId provided.');
            throw new Error('Invalid clientId. Only alphanumeric characters, underscores and hyphens are allowed.');
        }
        if (!backupSyncIntervalMs || backupSyncIntervalMs < 60000) {
            console.log('Error: Invalid backupSyncIntervalMs provided.');
            throw new Error('Invalid backupSyncIntervalMs. Accepts values starting from 60000ms {1 minute}.');
        }
        if(!store) {
            console.log('Error: Remote database store is required but not provided.');
            throw new Error('Remote database store is required.');
        }

        this.store = store;
        this.clientId = clientId;
        this.backupSyncIntervalMs = backupSyncIntervalMs;
        this.dataPath = path.resolve(dataPath || './.wwebjs_auth/');
        this.tempDir = `${this.dataPath}/wwebjs_temp_session_${this.clientId}`;
        this.requiredDirs = ['Default', 'IndexedDB', 'Local Storage'];
        console.log('RemoteAuth initialized successfully.');
    }

    async beforeBrowserInitialized() {
        console.log('Executing beforeBrowserInitialized...');
        const puppeteerOpts = this.client.options.puppeteer;
        const sessionDirName = this.clientId ? `RemoteAuth-${this.clientId}` : 'RemoteAuth';
        const dirPath = path.join(this.dataPath, sessionDirName);

        if (puppeteerOpts.userDataDir && puppeteerOpts.userDataDir !== dirPath) {
            console.log('Error: RemoteAuth is not compatible with a user-supplied userDataDir.');
            throw new Error('RemoteAuth is not compatible with a user-supplied userDataDir.');
        }

        this.userDataDir = dirPath;
        this.sessionName = sessionDirName;

        console.log('----------------------------------------------------------------------------------------------');
        console.log('this.userDataDir set to:', this.userDataDir);
        console.log('this.sessionName set to:', this.sessionName);
        console.log('----------------------------------------------------------------------------------------------');
        await this.extractRemoteSession();

        this.client.options.puppeteer = {
            ...puppeteerOpts,
            userDataDir: dirPath
        };
        console.log('beforeBrowserInitialized completed.');
    }

    async logout() {
        console.log('Executing logout...');
        await this.disconnect();
        console.log('Logout completed.');
    }

    async destroy() {
        console.log('Executing destroy...');
        clearInterval(this.backupSync);
        console.log('Destroy completed.');
    }

    async disconnect() {
        console.log('Executing disconnect...');
        await this.deleteRemoteSession();

        let pathExists = await this.isValidPath(this.userDataDir);
        console.log('----------------------------------------------------------------------------------------------');
        console.log('Path exists check for disconnect:', pathExists);
        console.log('this.userDataDir during disconnect:', this.userDataDir);
        console.log('this.backupSync during disconnect:', this.backupSync);
        console.log('----------------------------------------------------------------------------------------------');
        if (pathExists) {
            console.log('Attempting to remove userDataDir...');
            await fs.promises.rm(this.userDataDir, {
                recursive: true,
                force: true
            }).catch((error) => {
                console.error('Error deleting userDataDir:', error);
            });
        }
        clearInterval(this.backupSync);
        console.log('Disconnect completed.');
    }

    async afterAuthReady() {
        console.log('Executing afterAuthReady...');
        const sessionExists = await this.store.sessionExists({session: this.sessionName});
        console.log('Session exists check:', sessionExists);
        if(!sessionExists) {
            console.log('Session does not exist. Waiting for initial sync delay...');
            await this.delay(60000); /* Initial delay sync required for session to be stable enough to recover */
            console.log('Storing remote session after initial delay...');
            await this.storeRemoteSession({emit: true});
        }
        var self = this;
        this.backupSync = setInterval(async function () {
            console.log('Storing remote session in backupSync interval...');
            await self.storeRemoteSession();
        }, this.backupSyncIntervalMs);
        console.log('afterAuthReady completed.');
    }

    async storeRemoteSession(options) {
        console.log('Executing storeRemoteSession...');
        /* Compress & Store Session */
        const pathExists = await this.isValidPath(this.userDataDir);
        console.log('----------------------------------------------------------------------------------------------');
        console.log('Path exists check for storeRemoteSession:', pathExists);
        console.log('----------------------------------------------------------------------------------------------');
        if (pathExists) {
            console.log('Compressing and storing session...');
            await this.compressSession();
            await this.store.save({session: this.sessionName});
            console.log('Removing compressed session and temp directory...');
            await fs.promises.unlink(`${this.sessionName}.zip`);
            await fs.promises.rm(`${this.tempDir}`, {
                recursive: true,
                force: true
            }).catch(() => {});
            if(options && options.emit) {
                console.log('Emitting REMOTE_SESSION_SAVED event...');
                this.client.emit(Events.REMOTE_SESSION_SAVED);
            }
        }
        console.log('storeRemoteSession completed.');
    }

    async extractRemoteSession() {
        console.log('Executing extractRemoteSession...');
        const pathExists = await this.isValidPath(this.userDataDir);
        const compressedSessionPath = `${this.sessionName}.zip`;
        const sessionExists = await this.store.sessionExists({session: this.sessionName});
        console.log('----------------------------------------------------------------------------------------------');
        console.log('Path exists check for extractRemoteSession:', pathExists);
        console.log('Session exists check for extractRemoteSession:', sessionExists);
        console.log('Compressed session path:', compressedSessionPath);
        console.log('----------------------------------------------------------------------------------------------');
        if (pathExists) {
            console.log('Removing existing userDataDir...');
            await fs.promises.rm(this.userDataDir, {
                recursive: true,
                force: true
            }).catch((error) => {
                console.error('Error deleting existing userDataDir:', error);
            });
        }
        if (sessionExists) {
            console.log('Extracting and decompressing session...');
            await this.store.extract({session: this.sessionName, path: compressedSessionPath});
            await this.unCompressSession(compressedSessionPath);
        } else {
            console.log('Session does not exist. Creating userDataDir...');
            fs.mkdirSync(this.userDataDir, { recursive: true });
        }
        console.log('extractRemoteSession completed.');
    }

    async deleteRemoteSession() {
        console.log('Executing deleteRemoteSession...');
        const sessionExists = await this.store.sessionExists({session: this.sessionName});
        console.log('Session exists check for deleteRemoteSession:', sessionExists);
        if (sessionExists) {
            console.log('Deleting remote session...');
            await this.store.delete({session: this.sessionName});
        }
        console.log('deleteRemoteSession completed.');
    }

    async compressSession() {
        console.log('Executing compressSession...');
        const archive = archiver('zip');
        const stream = fs.createWriteStream(`${this.sessionName}.zip`);

        console.log('Copying userDataDir to tempDir...');
        await fs.copy(this.userDataDir, this.tempDir).catch(() => {});
        console.log('Deleting metadata...');
        await this.deleteMetadata();
        console.log('Archiving session...');
        return new Promise((resolve, reject) => {
            archive
                .directory(this.tempDir, false)
                .on('error', err => reject(err))
                .pipe(stream);

            stream.on('close', () => {
                console.log('Session compressed successfully.');
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
                    console.log('Session could not be decompressed. Error!.');
                    reject(err);
                } else {
                    console.log('Session decompressed successfully.');
                    resolve();
                }
            });
        });
        console.log('Removing compressed session file...');
        await fs.promises.unlink(compressedSessionPath);
    }

    async deleteMetadata() {
        console.log('Executing deleteMetadata...');
        const sessionDirs = [path.join(this.tempDir, 'Default'), this.tempDir,];
        console.log('Session directories for metadata deletion:', sessionDirs);
        for (const dir of sessionDirs) {
            const sessionFiles = await fs.promises.readdir(dir);
            for (const element of sessionFiles) {
                if (!this.requiredDirs.includes(element)) {
                    const dirElement = path.join(dir, element);
                    const stats = await fs.promises.lstat(dirElement);

                    if (stats.isDirectory()) {
                        console.log('Removing directory:', dirElement);
                        await fs.promises.rm(dirElement, {
                            recursive: true,
                            force: true
                        }).catch(() => {});
                    } else {
                        console.log('Removing file:', dirElement);
                        await fs.promises.unlink(dirElement).catch(() => {});
                    }
                }
            }
        }
        console.log('Metadata deletion completed.');
    }

    async isValidPath(path) {
        try {
            await fs.promises.access(path);
            console.log('Path is valid:', path);
            return true;
        } catch {
            console.log('Path is not valid:', path);
            return false;
        }
    }

    async delay(ms) {
        console.log(`Starting delay for ${ms} milliseconds...`);
        return new Promise(resolve => setTimeout(() => {
            console.log('Delay completed.');
            resolve();
        }, ms));
    }
}

console.log('RemoteAuth class defined successfully. Preparing to export...');

module.exports = RemoteAuth;

console.log('RemoteAuth module exported successfully.');
