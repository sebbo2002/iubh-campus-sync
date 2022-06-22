import {MyCampusCourseStatus} from './types';
import MyCampus from './campus';
import MyCampusSection from './campus-section';
import MyCampusActivity from './campus-activity';

export interface MyCampusCourseConstructorData {
    id: string;
    name?: string;
    current: boolean;
    info: boolean;
    url: string;
}

export default class MyCampusCourse {
    private myCampus: MyCampus;
    private data: MyCampusCourseConstructorData;

    constructor(myCampus: MyCampus, data: MyCampusCourseConstructorData) {
        this.myCampus = myCampus;
        this.data = data;
    }

    get id(): string {
        return this.data.id;
    }

    get name(): string | null {
        return this.data.name || null;
    }

    get status(): MyCampusCourseStatus {
        if (this.data.current) {
            return MyCampusCourseStatus.ACTIVE;
        }
        else if (this.data.info) {
            return MyCampusCourseStatus.INFO;
        }
        else {
            return MyCampusCourseStatus.COMPLETED;
        }
    }

    get url(): string {
        return this.data.url;
    }

    toString(): string {
        return `MyCampusCourse<${this.id}>`;
    }

    async getSections(): Promise<MyCampusSection[]> {
        if (!this.myCampus.browser) {
            throw new Error('Unable to fetch course details: please run start() first!');
        }

        const page = await this.myCampus.browser.newPage();
        await page.goto(this.url);

        try {
            await page.waitForSelector('#region-main ul.topics');
        }
        catch(error) {
            return [];
        }

        const rawSections = await page.$$eval('ul.topics li.section', sections => sections.map(section => ({
            id: section.id,
            url: '#' + section.id,
            name: section.getAttribute('aria-label'),
            activities: Array.from(section.querySelectorAll('.section li.activity'))
                .map(activity => activity.id)
        })));

        const rawActivities = await page.$$eval('ul.topics ul.section li.activity', activities => activities.map(activity => {
            const classes = (activity.getAttribute('class') || '').split(' ').filter(Boolean);
            return {
                id: activity.id,
                url: '#' + activity.id,

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                name: activity.querySelector('.instancename')?.innerText?.split('\n')[0] || null,

                classes,
                type: classes.length >= 2 ? classes[1] : null,
                html: activity.innerHTML
            };
        }));

        const sections = rawSections.map(rawSection => {
            const activities = rawSection.activities.map(activityId => {
                const rawActivity = rawActivities.find(rawActivity => rawActivity.id === activityId);
                if(rawActivity) {
                    rawActivity.url = this.url + rawActivity.url;
                    return new MyCampusActivity(this.myCampus, rawActivity);
                }

                return undefined;
            }).filter(Boolean) as MyCampusActivity[];

            rawSection.url = this.url + rawSection.url;
            return new MyCampusSection(rawSection, activities);
        });

        await page.close();
        return sections;
    }
}
