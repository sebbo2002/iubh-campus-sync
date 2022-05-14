'use strict';

import {SyncOptions} from './types';
import Database from './database';
import SyncCampus from './sync-campus';

class Sync {
    static async run (): Promise<void> {
        const sync = new Sync({
            cwd: process.env.SYNC_PATH || process.cwd(),
            username: process.env.SYNC_USERNAME || '',
            password: process.env.SYNC_PASSWORD || ''
        });

        await sync.run();
    }

    private readonly database: Database;
    private readonly options: SyncOptions;

    constructor(options: SyncOptions) {
        this.database = new Database(options.cwd);
        this.options = options;

        if(!this.options.username || !this.options.password) {
            throw new Error('Username or password empty, please check environment variables.');
        }
    }

    async run (): Promise<void> {
        await SyncCampus.run({
            username: this.options.username,
            password: this.options.password,
            database: this.database
        });
    }
}

Sync.run().catch((error: Error) => {
    console.log(error);
    process.exit(1);
});
