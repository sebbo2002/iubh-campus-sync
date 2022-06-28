import MyCampusActivity from './campus-activity.js';

export interface MyCampusSectionConstructorData {
    id: string;
    url: string;
    name: string | null;
}

export default class MyCampusSection {
    private readonly data: MyCampusSectionConstructorData;
    public readonly activities: MyCampusActivity[];

    constructor(data: MyCampusSectionConstructorData, activities: MyCampusActivity[]) {
        this.data = data;
        this.activities = activities;
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
}
