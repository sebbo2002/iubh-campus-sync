import puppeteer, { Browser, Page } from 'puppeteer';
import MyCampusCourse from './campus-course.js';

export default class MyCampus {
    public browser: Browser | undefined;
    public page: Page | undefined;

    private screenshotTime = new Date().getTime();
    private screenshotIndex = 0;

    async start(username: string, password: string): Promise<void> {
        this.browser = await puppeteer.launch();
        this.page = await this.browser.newPage();
        await this.page.goto('https://mycampus.iubh.de/my/');

        const $usernameInput = await this.page.waitForSelector('#username');
        if(!$usernameInput) {
            throw new Error('Unable to login: not able to find username field');
        }

        await $usernameInput.type(username);

        const $passwordInput = await this.page.waitForSelector('#password');
        if(!$passwordInput) {
            throw new Error('Unable to login: not able to find password field');
        }

        await $passwordInput.type(password);
        await $passwordInput.press('Enter');

        try {
            await this.page.waitForSelector('#page-my-index');
        }
        catch(error) {
            await this.page.reload({
                waitUntil: ['networkidle0', 'domcontentloaded']
            });

            await this.page.waitForSelector('#page-my-index');
        }
    }

    async stop (): Promise<void> {
        if(this.browser) {
            await this.browser.close();
            delete this.browser;
            delete this.page;
        }
    }

    async screenshot (page: Page | undefined = this.page): Promise<void> {
        if(page) {
            await page.screenshot({
                path: this.screenshotTime + '-' + this.screenshotIndex.toString().padStart(3, '0') + '.png'
            });
        }
    }

    async getCourses(): Promise<MyCampusCourse[]> {
        if(!this.page) {
            throw new Error('Unable to get courses: please run start() first!');
        }

        await this.page.goto('https://mycampus.iubh.de/my/');
        await this.page.waitForSelector('.courselist');

        await this.page.waitForSelector('.courselist');

        const activeCourses = await this.page.$$eval('#courses-active .shortname', cs => cs.map(c =>
            c.textContent || '').filter(Boolean)
        );
        const infoCourses = await this.page.$$eval('#courses-intro .shortname', cs => cs.map(c =>
            c.textContent || '').filter(Boolean)
        );

        const courses = await this.page.$$eval('.courseitem', items => items.map(item => {
            const data = {
                url: item.getAttribute('href'),
                id: item.querySelector('.shortname')?.textContent,
                name: item.querySelector('.fullname')?.textContent
            };

            if(!data.id) {
                throw new Error('Course ID not found.');
            }
            if(!data.url) {
                throw new Error('Course URL not found.');
            }

            return data;
        }));

        return courses.map(course => {
            return new MyCampusCourse(this, {
                id: course.id as string,
                name: course.name || undefined,
                current: course.id ? activeCourses.includes(course.id) : false,
                info: course.id ? infoCourses.includes(course.id) : false,
                url: course.url as string
            });
        });
    }

    async getOrgaDocuments(): Promise<void> {
        // @todo
    }
}
