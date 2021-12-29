import { Base } from '../util/base';
import test from '@playwright/test';
import { json } from 'stream/consumers';
import { join } from 'path';
var fs = require("fs");

const base = new Base();


test("Get SHIPPPING status", async ({ request, baseURL }) => {
    let count = 1;
    let pages;
    let infos;
    let orders;
    let combinedResponses;
    do {
        const res_ = await request.get(baseURL + "/api/v3/order/get_order_id_list?source=shipping&page_number=" + count);
        infos = await JSON.parse(JSON.stringify(await res_.json()));
        orders = await infos.data.orders.map((x) => ({"order_id":  x.order_id }));
        orders = await JSON.stringify(await orders,undefined,2);
        if (count === 1) {
            const info = await base.locateJSON(infos, "data.page_info.total");
            pages = info/40;
            pages = (pages % 1) !== 0 ? Math.trunc(pages)+1 : Math.trunc(pages); 
            combinedResponses = (await orders);
        } else {
            combinedResponses = (await combinedResponses + await orders).replace("\n][",",");
        }
        ++count;
        //console.log(combinedResponses);
    } while (count <= pages);

    //console.log(combinedResponses);
    const data = await base.processOrderBody(JSON.parse(combinedResponses));
    await fs.writeFile ("./result/shipping-order-ids.json", await JSON.stringify(await data,undefined,2), async function(err) {
        if (err) { throw err }
            console.log("complete");

            await base.loopJsonData("/result/shipping-order-ids.json", "orders", async function(item) {
                // console.log(item.order_id);
                const getShippingStatus = await request.get(baseURL + "/api/v3/order/get_forder_logistics?order_id=" + await item.order_id);
                console.log("x");
                console.log("y");
                // let stat = await JSON.parse(JSON.stringify(await getShippingStatus.json()));
                // stat = await stat.data.list.map((x) => ({"order_id": x.order_id, "courier" : x.thirdparty_tracking_number, "status": x.status, "status2" : x.channel_status}));
                // // // stat = await JSON.stringify(await stat,undefined,2);
                // console.log(await JSON.stringify(await stat,undefined,2));
                // combinedResponses = (await combinedResponses + await stat).replace("\n][",",");
            });
        }
    );

  
    
})
