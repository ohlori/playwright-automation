import { join } from "path";
const normalizer = require("path");
var fs = require("fs");

export class Base {
    public contentPath: string;
    public contentData: JSON;

    /**
     * Loads the content file by parsing the json file from the given @param {string} path.
     * @todo make the json reading async if the json files gets huge.
     */
     public loadContent(path: string) {
        const localPath = join(process.cwd(), path);
        this.contentPath = normalizer.normalize(localPath);
        this.contentData = JSON.parse(fs.readFileSync(this.contentPath, "utf8"), function(err) {
            if (err) throw err;
                console.log('complete');
                return this.contentData;
            }
        );
    }


    public async getData(path: string, blockPath?: string): Promise <string> {
        let data = await this.loadContent(path);
        return data["block"];
    }
}