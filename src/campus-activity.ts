import MyCampus from './campus';
import cheerio from 'cheerio';
import fetch from 'node-fetch';
import {join} from 'path';
import {promisify} from 'util';
import {pipeline} from 'stream';
import {createWriteStream} from 'fs';
import {encode} from 'es-cookie';

export interface MyCampusActivityConstructorData {
    id: string;
    url: string;
    name: string | null;
    classes: string[];
    type: string | null;
    html: string;
}

export default class MyCampusActivity {
    private readonly myCampus: MyCampus;
    private readonly data: MyCampusActivityConstructorData;
    private readonly $;

    constructor(myCampus: MyCampus, data: MyCampusActivityConstructorData) {
        this.myCampus = myCampus;
        this.data = data;
        this.$ = cheerio.load(data.html);
    }

    get id(): string {
        return this.data.id;
    }

    get url(): string {
        return this.data.url;
    }

    get name(): string | null {
        return this.data.name;
    }

    get type(): string | null {
        return this.data.type;
    }

    toJSON(): MyCampusActivityConstructorData {
        return Object.assign({}, this.data);
    }

    fingerprint(): string | null {
        if (this.type === 'resource') {
            return this.$('.resourcelinkdetails')?.text();
        }

        return null;
    }

    isDownloadable(): boolean {
        if (this.type === 'resource') {
            return !!this.$('a.aalink')?.attr('href');
        }

        return false;
    }

    async download(path: string): Promise<string> {
        if (this.type === 'resource') {
            const url = this.$('a.aalink')?.attr('href');
            if (!url) {
                throw new Error('Unable to download file: URL not found.');
            }

            return this.downloadWithCookies(path, url);
        }

        throw new Error(`Unable to download ${this.type}: not implemented yet.`);
    }

    private async downloadWithCookies(path: string, url: string): Promise<string> {
        if (!this.myCampus.page) {
            throw new Error('Unable to get browser cookies: Is the page initialized?');
        }

        const cookies = await this.myCampus.page.cookies(url);
        const headers = {
            Cookie: cookies
                .map(cookie => encode(cookie.name, cookie.value, {}))
                .join('; ')
        };

        const response = await fetch(url, {headers});
        console.log(`> Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            throw new Error(`Unexpected response: ${response.statusText}`);
        }
        if (response.body === null) {
            throw new Error('Unexpected response: body is empty');
        }

        const contentType = response.headers.get('content-type');
        if(contentType?.startsWith('text/html;')) {
            console.log('> HTML Output:', await response.text());
            throw new Error('Unexpected response: server replied with html');
        }

        const disposition = response.headers.get('content-disposition');
        if(!disposition?.startsWith('attachment; filename=')) {
            console.log('> Content-Disposition:', disposition);
            throw new Error('Unexpected response: server replied without attachement');
        }

        const fileName = disposition.substr(21);
        const filePath = join(path, fileName);
        const streamPipeline = promisify(pipeline);
        const writeStream = createWriteStream(filePath);
        await Promise.all([
            new Promise(cb => writeStream.on('finish', cb)),
            streamPipeline(response.body, writeStream)
        ]);

        return filePath;
    }
}
