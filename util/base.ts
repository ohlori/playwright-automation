import { join } from "path";
const normalizer = require("path");
var fs = require("fs");

export class Base {
    public contentPath: string;
    public contentData: JSON;


    public getContentData(): JSON {
        return this.contentData;
    }

    /**
     * Loads the content file by parsing the json file from the given @param {string} path.
     * @todo make the json reading async if the json files gets huge.
     */
    public loadContent(path: string) {
        try {
            const localPath = join(process.cwd(), path);
            this.contentPath = normalizer.normalize(localPath);
            this.contentData = JSON.parse(fs.readFileSync(this.contentPath, "utf8"));
            return this.contentData;
        } catch (error) {
            console.log("ERROR: unable to read content file.");
        }
    }

     public locateJSON(data: JSON, jsonStrc: string) {
        let loc: JSON = data;
        // split the received locator path in json with .
        let str;
        if (jsonStrc.includes(".")) {
            str = jsonStrc.split(".");

            for (let i = 0; i < str.length; i++) {
                loc = loc[str[i]];
            }
            return JSON.parse(JSON.stringify(loc,undefined,2));
        } else {
            return loc[jsonStrc];
        }
    }

    public async getJSONData(path: string, block?: string): Promise <any> {
        let data = await this.loadContent(path);
        data = block === undefined ? data: this.locateJSON(data, block) ;
        return data;
    }

    public async processOrderBody(infos: any): Promise <any> {    
        let viewData = { 
            orders : [] 
        };

        await infos.forEach (async function(column) {
            await viewData.orders.push(await column);
        });

        return await viewData;
    }
}