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

    public loadContent(path: string, testData?: string) {
        try {
            const localPath = join(process.cwd(), path);
            this.contentPath = normalizer.normalize(localPath);
            this.contentData = JSON.parse(fs.readFileSync(this.contentPath, "utf8"));
            return this.contentData;
        } catch (error) {
            console.log("ERROR: unable to read content file.");
        }
    }

     public loadJSONData(path: string, testData: string) {
        let jsonPath;

        this.contentPath = join(process.cwd(), path);
        this.contentPath = normalizer.normalize(this.contentPath);
        this.contentPath = JSON.parse(fs.readFileSync(this.contentPath, "utf8"));
        // populate a path with the whole json file
        jsonPath = this.contentPath;
        return jsonPath[testData];
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
            return loc;
        }
    }

    public async getJSONData(path: string, block?: string) {
        let data;
        this.contentData = await this.loadContent(path);
        this.contentData = block === undefined ? this.contentData: this.contentData[block];
        data = this.contentData;
        return  data;
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

    public loopJsonData(json, data, callback) {
        const inputData = this.loadJSONData(json, data);
        inputData.forEach((val, i) => {
            ((item, index) => {
                callback(item, index, inputData);
            })(val, i);
        });
    }
}