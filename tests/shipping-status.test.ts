import { Base } from '../util/base';
import test from '@playwright/test';
import { json } from 'stream/consumers';
import { join } from 'path';
var fs = require("fs");

const base = new Base();


test("Get SHIPPPING status", async ({ request, baseURL }) => {
    test.setTimeout(0);
    let count = 0;
    const order_ids = await base.getJSONData("/result/shipping-order-ids.json");
    const total_order_ids = Object.keys(await order_ids.orders).length;
    let combinedResponses;

    
    do {
        const getShippingStatus = await request.get(baseURL + "/api/v3/order/get_forder_logistics?order_id=" + String(Object.values(await order_ids.orders[count])));
        let stat = await JSON.parse(JSON.stringify(await getShippingStatus.json()));
        stat = await stat.data.list.map((x) => ({"order_id": x.order_id, "courier" : x.thirdparty_tracking_number, "status": x.status, "status2" : x.channel_status}));
        stat = await JSON.stringify(await stat,undefined,2);
        combinedResponses = (await combinedResponses + await stat).replace("\n][",",");
        //console.log(combinedResponses);
        ++count;
    } while (count < total_order_ids);

    
    await fs.writeFile ("./result/shipping-status.json", await combinedResponses.replace("undefined", ""), async function(err) {
        if (err) { throw err }
        console.log("complete");
    }    
    );
})

test.only("Shipping Status Summary", async ({ request, baseURL }) => {
    const info = await base.loadContent("/result/shipping-status.json");
    const rts_total = Object.values(info).filter(x => x.status === 203).length;
    const delivered = Object.values(info).filter(x => x.status === 8).length;
    const shipping = Object.values(info).filter(x => x.status === 6).length;
    // console.log(Object.values(info).filter(x => x.status === 6).length)
    console.log(Object.values(info).filter(x => x.status === 203));
    console.log("-------------------------------------------");
    console.log("|       SUMMARY OF SHIPPING STATUS        |");
    console.log("-------------------------------------------");
    console.log("\x1b[31m%s\x1b[0m","\tRETURN TO SELLER (RTS): " + rts_total + " | ");
    
    console.log("\n\tDELIVERED: " + delivered);
    // console.log(" ► Unreleased: " + info.data.toship_unprocessed);
    console.log("\tIN-PROGRESS: " + shipping);
    // console.log("\t ► To Collect: " + info.in_transit);
    console.log("\x1b[33m%s\x1b[0m","-------------------------------------------");
    console.log("\x1b[33m%s\x1b[0m","\tUNCATEGORIZED STATUS CODE: " + (Object.values(info).length-(rts_total+delivered+shipping)));
    console.log("\x1b[33m%s\x1b[0m","-------------------------------------------");

    
})
