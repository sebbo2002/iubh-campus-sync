import {existsSync, readFileSync, writeFileSync, createReadStream} from 'fs';
import {mkdir, readdir, readFile, writeFile} from 'fs/promises';
import {createHash} from 'crypto';
import {join, dirname, extname, basename, resolve, relative} from 'path';
import {MyCampusCourseStatus} from './types';
import MyCampusActivity from './campus-activity';

export interface DatabaseActivityEntry {
    id: string;
    fingerprint: string | null;
    hash: string;
    path: string;
}

export interface DatabaseActivityInfo {
    entryExists: boolean;
    fileExists: boolean;
    filePath: string | null;
    changedOnRemote: boolean | null;
    changedLocally: boolean | null;
}

export default class Database {
    private readonly path: string;

    readonly cwd: string;
    readonly activities: DatabaseActivityEntry[];
    readonly paths: { [MyCampusCourseStatus.ACTIVE]: string, [MyCampusCourseStatus.INFO]: string, [MyCampusCourseStatus.COMPLETED]: string };

    constructor(cwd: string) {
        this.cwd = cwd;
        if (!existsSync(cwd)) {
            throw new Error(`Unable to load database: Working directory (${cwd}) does not exist!`);
        }

        this.paths = {
            [MyCampusCourseStatus.ACTIVE]: this.cwd,
            [MyCampusCourseStatus.INFO]: join(this.cwd, 'Infos & Organisatorisches'),
            [MyCampusCourseStatus.COMPLETED]: join(this.cwd, 'Abgeschlossene Module')
        };

        this.path = join(cwd, '.iubh-campus-sync.db');
        this.activities = [];

        if (existsSync(this.path)) {
            this.load();
        }
        else {
            this.saveSync();
        }
    }

    load(): void {
        const json = JSON.parse(readFileSync(this.path, {encoding: 'utf8'}));
        if(json.version !== 1) {
            throw new Error('Invalid db version: unable to continue.');
        }

        if(Array.isArray(json.activities)) {
            json.activities.forEach((activity: string[]) => this.activities.push({
                id: activity[0],
                fingerprint: activity[1],
                hash: activity[2],
                path: resolve(this.cwd, activity[3])
            }));
        }
    }

    toJSON(): Record<string, unknown> {
        return {
            'version': 1,
            'activities': this.activities.map(activitiy => ([
                activitiy.id,
                activitiy.fingerprint,
                activitiy.hash,
                relative(this.cwd, activitiy.path)
            ]))
        };
    }

    async save(): Promise<void> {
        await writeFile(this.path, JSON.stringify(this.toJSON(), null, '  '));
    }

    saveSync(): void {
        writeFileSync(this.path, JSON.stringify(this.toJSON(), null, '  '));
    }

    async findOrCreateFolder(id: string, name: string, folder: string = this.cwd): Promise<string> {
        const existingFolder = await this.findFolder(id);
        if (existingFolder) {
            return existingFolder;
        }
        if (!existsSync(folder)) {
            await mkdir(folder);
        }

        const folderPath = await this.getConflictFreeFileName(join(folder, name));
        await mkdir(folderPath);

        const idFilePath = join(folderPath, '.iubh-campus-sync-folder');
        await writeFile(idFilePath, id + '\n');
        return folderPath;
    }

    async findFolder(id: string, folder: string | null = null): Promise<string | null> {
        if (!folder) {
            const results = await Promise.all(Object.values(this.paths).map(path => this.findFolder(id, path)));
            return results.find(Boolean) || null;
        }
        if (!existsSync(folder)) {
            return null;
        }

        const files = await readdir(folder, {withFileTypes: true});
        const results = await Promise.all(files.map(async file => {
            if(file.isDirectory()) {
                return this.findFolder(id, join(folder, file.name));
            }
            if (file.name !== '.iubh-campus-sync-folder' || !file.isFile()) {
                return null;
            }

            const path = join(folder, file.name);
            const content = await readFile(path, {encoding: 'utf8'});
            const savedId = content.split('\n')[0].trim();
            if (savedId === id) {
                return folder;
            }

            return null;
        }));

        return results.find(Boolean) || null;
    }

    async getLocalActivityInfo(activity: MyCampusActivity): Promise<DatabaseActivityInfo> {
        const entry = this.activities.find(entry => entry.id === activity.id);
        if(!entry) {
            return {
                entryExists: false,
                fileExists: false,
                filePath: null,
                changedOnRemote: null,
                changedLocally: null
            };
        }

        const result: DatabaseActivityInfo = {
            entryExists: true,
            fileExists: false,
            filePath: null,
            changedOnRemote: !!(activity.fingerprint() && entry.fingerprint !== activity.fingerprint()),
            changedLocally: null
        };

        // file exists?
        let foundByHash = false;
        let filePath: string|null = entry.path;
        if(!filePath || !existsSync(filePath)) {
            // no? is the file somewhere else?
            filePath = await this.searchFileByHash(entry.hash);
            foundByHash = true;
        }
        if(!filePath) {
            return result;
        }

        await this.updateLocalActivityFile(activity, filePath);
        result.fileExists = true;
        result.filePath = filePath;
        result.changedLocally = false;

        // file fingerprint matches?
        const actualHash = await this.getHashByFile(filePath);
        if(entry.hash !== actualHash) {
            result.changedLocally = true;

            if(!foundByHash) {
                const newFilePath = await this.searchFileByHash(entry.hash);
                if(newFilePath) {
                    result.filePath = newFilePath;
                    result.changedLocally = false;
                    await this.updateLocalActivityFile(activity, newFilePath);
                }
            }
        }

        return result;
    }

    async searchFileByHash(hash: string, path?: string): Promise<string|null> {
        if (!path) {
            const paths = Object.values(this.paths);
            for(const i in paths) {
                const path = paths[i];
                const result = await this.searchFileByHash(hash, path);
                if(result) {
                    return result;
                }
            }

            return null;
        }
        if (!existsSync(path)) {
            return null;
        }

        const files = await readdir(path, {withFileTypes: true});
        for(const i in files) {
            const file = files[i];
            const filePath = join(path, file.name);
            if(file.isDirectory()) {
                const r = await this.searchFileByHash(hash, filePath);
                if(r) {
                    return r;
                }
            }
            if(!file.isFile() || file.name.substr(0, 1) === '.') {
                continue;
            }

            const fileHash = await this.getHashByFile(filePath);
            if(fileHash === hash) {
                return filePath;
            }
        }

        return null;
    }

    async getHashByFile(path: string): Promise<string> {
        const hash = createHash('sha1');
        hash.setEncoding('hex');

        const fd = createReadStream(path);
        const promise = new Promise(resolve => {
            fd.on('end', () => {
                hash.end();
                resolve(hash.read().toString());
            });
        }) as Promise<string>;

        fd.pipe(hash);
        return promise;
    }

    async updateLocalActivityFile(activity: MyCampusActivity, path: string, hash?: string): Promise<void> {
        const entry = this.activities.find(entry => entry.id === activity.id);
        const fingerprint = activity.fingerprint();
        if(!hash) {
            hash = await this.getHashByFile(path);
        }

        if(!entry) {
            this.activities.push({
                id: activity.id,
                fingerprint,
                hash,
                path
            });
        }else{
            entry.fingerprint = fingerprint;
            entry.hash = hash;
            entry.path = path;
        }

        await this.save();
    }

    async getConflictFreeFileName(filePath: string): Promise<string> {
        return Database.getConflictFreeFileName(filePath);
    }

    static async getConflictFreeFileName(filePath: string): Promise<string> {
        const extension = extname(filePath);
        let newPath = filePath;

        for(let i = 1; existsSync(newPath); i++) {
            newPath = join(dirname(filePath), basename(filePath, extension) + '-' + i + extension);
        }

        return newPath;
    }
}
