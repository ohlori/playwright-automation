import * as fs from "fs";
import { join } from "path";
const normalizer = require("path");


export class Base {
    public contentPath: string;
    public contentData: JSON;


    public getContentData(): JSON {
        return this.contentData;
    }

    public async loadContent(path: string, returnData?: boolean) {
        try {
            const localPath = join(process.cwd(), path);
            this.contentPath = normalizer.normalize(localPath);
            this.contentData = await JSON.parse(fs.readFileSync(this.contentPath, "utf8"));

            if(returnData) {
                const data = await this.locateJSON(await this.contentData);
                return await data
            } else {
                return this.contentData;
            }
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

    public async locateJSON(data: JSON, jsonStrc?: string) {
        let loc: JSON = data;
        // split the received locator path in json with .
        let str;
        if (jsonStrc !== undefined && jsonStrc.includes(".")) {
            str = jsonStrc.split(".");

            for (let i = 0; i < str.length; i++) {
                loc = loc[str[i]];
            }
        }
        return await JSON.parse(JSON.stringify(loc,undefined,2));
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

    public async loopJsonDatafromJSON(json, data, callback) {
        const inputData = await this.loadJSONData(json, data);
        const promises = [];
        await inputData.forEach((val, i) => {
            promises.push(callback(val, i, inputData));
        });
        await Promise.all(promises);
    }

    public loadJSONData(path: string, testData?: any) {
        let jsonPath;

        this.contentPath = join(process.cwd(), path);
        this.contentPath = normalizer.normalize(this.contentPath);
        this.contentPath = JSON.parse(fs.readFileSync(this.contentPath, "utf8"));
        jsonPath = this.contentPath;
        return (testData === undefined || testData === 0) ? jsonPath :jsonPath[testData];
    }

    public pesoFormat(amount: any): string {
        let formatted = "₱ " + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",").padStart(10, " ");
        return formatted;
    }

    public getDateFromEpoch(epoch: any): any {
        const date = new Date(epoch* 1e3).toLocaleDateString("en-US");
        const dateNow = date.split(", ")[0].split("/").join("/");
        return dateNow;
    }

    public async saveFile(outputDir: any, data: any)  {
        return new Promise((resolve, reject) => {
            fs.writeFile(outputDir, data, err => {
                if (err) { reject(err); }
                resolve(true);
            })
        });

    }
}