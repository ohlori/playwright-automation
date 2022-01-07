import * as fs from "fs";
import { checkPrimeSync } from "crypto";
import { join } from "path";
const normalizer = require("path");


export class Base {
    public contentPath: string;
    public contentData: JSON;


    public getContentData(): JSON {
        return this.contentData;
    }

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
    public async getJSONData(path: string, block?: string) {
        let data;
        this.contentData = await this.loadContent(path);
        this.contentData = block === undefined ? this.contentData: this.contentData[block];
        data = this.contentData;
        return  data;
    }

     public locateJSON(data: JSON, jsonStrc?: string) {
        let loc: JSON = data;
        // split the received locator path in json with .
        let str;
        if (jsonStrc !== undefined && jsonStrc.includes(".")) {
            str = jsonStrc.split(".");

            for (let i = 0; i < str.length; i++) {
                loc = loc[str[i]];
            }
        }
        return JSON.parse(JSON.stringify(loc,undefined,2));
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

    public async loopJsonData(json, data, callback) {
        const inputData = this.loadJSONData(json, data);
        const promises = [];
        await inputData.forEach((val, i) => {
            promises.push(callback(val, i, inputData));
        });
        await Promise.all(promises);
    }

    loadJSONData
}