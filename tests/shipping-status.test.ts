import { Base } from '../util/base';
import test from '@playwright/test';
import { json } from 'stream/consumers';
var fs = require("fs");

const base = new Base();


test("Get SHIPPPING status", async ({ request, baseURL }) => {
    const res_ = await request.get(baseURL + "/api/v3/order/get_order_id_list?source=shipping&page_size=40&page_number=1");
    let infos = await JSON.parse(JSON.stringify(await res_.json()));
    infos = await infos.data.orders.map((x) => ({"order_id": x.order_id, "shop_id": x.shop_id,  "region_id": x.region_id }));
    // console.log(await infos);
    //console.log(await typeof infos);
 
    let viewData = { 
        orders : [] 
    };
    let jsonData = {};

    await infos.forEach (async function(column) {
        await viewData.orders.push(await column);
    });

    // console.log(await viewData);
    console.log("TO SHIP TOTAL ORDERS: " + await viewData.orders.length);
    const resDetails = await request.post(baseURL + "/api/v3/order/get_shipment_order_list_by_order_ids_multi_shop", {
        data: viewData
    });  

    await fs.writeFile ("./result/shipping-status.json", JSON.stringify(await resDetails.json(),undefined,2), function(err) {
        if (err) throw err;
            console.log('complete');
        }
    );
})
