import test from '@playwright/test';
import { join } from 'path';
const path = require('path');
import { Base }  from "../util/base";
var fs = require("fs");

const base = new Base();

test("Quick Summary", async ({ request, baseURL }) => {
    const res_ = await request.post(baseURL + "/api/v3/order/get_shipment_meta_multi_shop", {
        data: {
            "orders": [{"shop_id": 271248938,"region_id": "PH"}]
        }
    });
    const data = await base.locateJSON(await res_.json(), "data.shop_list");
    const res2 = await request.post(baseURL + "/api/v3/order/get_order_meta_multi_shop", {
        data: {
            "shop_list":[{"shop_id":271248938,"region_id":"PH"}]
        }
    });

    const combinedResponses = (JSON.stringify(await data[0],undefined,2)+ await JSON.stringify(await res2.json(),undefined,2)).replace(/\s}{/g,",");
    await fs.writeFile ("./result/quick-summary.json", combinedResponses, async function(err) {
        if (err) throw err;

        const info = await base.getJSONData("/result/quick-summary.json",);
        console.log("-------------------------------------------");
        console.log("|              QUICK SUMMARY              |");
        console.log("-------------------------------------------");
        console.log("\tUNPAID / ABANDONED ORDER: " + info.data.unpaid);
        
        console.log("\n\tTOTAL TO SHIP: " + info.data.toship);
        console.log("\x1b\t[33m%s\x1b[0m"," ► Unprocessed: " + info.data.toship_unprocessed);
        console.log("\t ► Processed: " + info.data.toship_processed);
        console.log("\n\tTOTAL IN SHIPPING: " + info.data.shipping);
        console.log("\t ► In Transit: " + info.in_transit);
        console.log("\t ► Delivered: " + (info.data.shipping - info.in_transit));
        console.log("-------------------------------------------");
    });
})