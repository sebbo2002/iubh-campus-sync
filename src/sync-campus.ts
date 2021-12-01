import Database from './database';
import MyCampus from './campus';

import {join, dirname, basename, extname} from 'path';
import {rename} from 'fs/promises';
import MyCampusCourse from './campus-course';
import MyCampusSection from './campus-section';

export interface SyncCampusOptions {
    username: string;
    password: string;
    database: Database
}

export default class SyncCampus {
    static async run(options: SyncCampusOptions): Promise<void> {
        const syncCampus = new SyncCampus(options);
        await syncCampus.run();
    }

    private readonly username: string;
    private readonly password: string;
    private readonly database: Database;
    private readonly myCampus: MyCampus;

    constructor(options: SyncCampusOptions) {
        this.username = options.username;
        this.password = options.password;
        this.database = options.database;
        this.myCampus = new MyCampus();

    }

    async run(): Promise<void> {
        await this.myCampus.start(this.username, this.password);

        try {
            await this.syncCourses();
            await this.myCampus.stop();
        }
        catch(error: unknown) {
            await this.myCampus.screenshot();
            await this.myCampus.stop();
            throw error;
        }
    }

    async syncCourses(): Promise<void> {
        const courses = await this.myCampus.getCourses();
        for(const i in courses) {
            const course = courses[i];
            if(['id=1844', 'id=2567', 'id=2566', 'id=4893', 'id=1208', 'id=2565'].find(a => course.url.endsWith(a))) {
                continue;
            }

            const defaultParentFolder = this.database.paths[course.status];
            const folder = await this.database.findOrCreateFolder(
                'course-' + course.id,
                course.name || course.id,
                defaultParentFolder
            );

            try {
                await this.syncCourse(course, folder);
            }
            catch(error) {
                console.log(`Unable to sync course ${course.url}:`);
                console.log(error instanceof Error ? error.stack : error);
            }
        }
    }

    async syncCourse(course: MyCampusCourse, folder: string): Promise<void> {
        const sections = await course.getSections();
        for(const i in sections) {
            const section = sections[i];
            if(!section.activities.find(a => a.isDownloadable())) {
                continue;
            }

            const sectionFolder = await this.database.findOrCreateFolder(
                'course-' + course.id + '/section-' + section.id,
                section.name || course.id,
                folder
            );

            await this.syncSection(course, section, sectionFolder);
        }
    }

    async syncSection(course: MyCampusCourse, section: MyCampusSection, folder: string): Promise<void> {
        for(const i in section.activities) {
            const activity = section.activities[i];
            if(!activity.isDownloadable()) {
                continue;
            }

            const activityInfo = await this.database.getLocalActivityInfo(activity);
            if(!activityInfo.entryExists || !activityInfo.fileExists) {
                console.log(`${course.name || course.id} / ${section.name || section.id} / ${activity.name || activity.id} (${activity.id})`);
                console.log('> File does not exist, download it…');

                const originalFilePath = await activity.download(folder);
                if(!activity.name) {
                    await this.database.updateLocalActivityFile(activity, originalFilePath);
                    console.log('> Done, file saved at' + originalFilePath + '\n');
                    continue;
                }

                const niceFileName = activity.name
                    .replace(/[^a-z0-9-_äüöß.a ()\[]/gi, '_')
                    .replace(/"/g, '') + extname(originalFilePath);

                const niceFilePath = await this.database.getConflictFreeFileName(join(folder, niceFileName));
                console.log(`> Download of ${basename(originalFilePath)} complete`);
                console.log(`> Rename file to ${niceFileName}`);
                await rename(originalFilePath, niceFilePath);

                await this.database.updateLocalActivityFile(activity, niceFilePath);
                console.log('> Done!\n');
            }
            else if(activityInfo.changedOnRemote && activityInfo.changedLocally && activityInfo.filePath) {
                console.log(`${course.name || course.id} / ${section.name || section.id} / ${activity.name || activity.id}`);
                console.log('> File changed on MyCampus and locally, rename local one and download update…');

                const fileExt = extname(activityInfo.filePath);
                const newNameForLocalFile = await this.database.getConflictFreeFileName(join(
                    dirname(activityInfo.filePath),
                    basename(activityInfo.filePath, fileExt) + '.local' + fileExt
                ));

                await rename(activityInfo.filePath, newNameForLocalFile);
                console.log('> File renamed to', newNameForLocalFile);

                const filePath = await activity.download(folder);
                await this.database.updateLocalActivityFile(activity, filePath);
                console.log('> Downloaded new file at ' + filePath + '\n');
            }
            else if(activityInfo.changedOnRemote) {
                console.log(`${course.name || course.id} / ${section.name || section.id} / ${activity.name || activity.id}`);
                console.log('> File changed on MyCampus, update it…');

                const filePath = await activity.download(folder);
                await this.database.updateLocalActivityFile(activity, filePath);

                console.log('> Done, file saved at ' + filePath + '\n');
            }
        }
    }
}
