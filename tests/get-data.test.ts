import { Base } from '../util/base';
import test from '@playwright/test';
var fs = require("fs/promises");

const base = new Base();

/* GOAL: Get all completed data starting from the last logged and get the net income daily (collected)
 * TODO:
 * 1. Since this call can only pull up to 40 orders, loop this up to the last page
 * 2. Compare it to the already listed items to mark as "COMPLETE"
 * 3. Take note of the time, so it can be filtered by day to get the net income daily
**/
test("Get COMPLETED items", async ({ request, baseURL }) => {
    const res_ = await request.get(baseURL + "/api/v3/order/get_order_id_list?source=completed&page_size=40&page_number=1");
    await fs.writeFile ("./result/completed-items.json", JSON.stringify(await res_.json(),undefined,2), function(err) {
        if (err) throw err;
            console.log('complete');
        }
    );
})


/* GOAL: Get all to-ship orders to automatically log it on the inventory to get the net incomes daily (uncollected)
 * TODO: combine total in all the pages
 * 1. 
 * 2. 
 * 3. 
**/
test("Get all TO SHIP items", async ({ request, baseURL }) => {
    let count = 1;
    let pages, combinedResponses;

    do {
        const res_ = await request.get(baseURL + "/api/v3/order/get_package_list?source=processed&page_number="+count);
        let rspn = await JSON.parse(JSON.stringify(await res_.json()));
        let infos = await rspn.data.package_list.map((x) => ({"order_id": x.order_id, "region_id": "PH", "shop_id": 271248938}));
        
        // slice the response into 10 (this is the only allowable # of data per call)
        let j, resArray=[];
        for (let i = 0, j = infos.length; i < j; i += 10) {
            resArray.push(infos.slice(i, i + 10));
        }

        pages = rspn.data.total/40;
        pages = (pages % 1) !== 0 ? Math.trunc(pages)+1 : Math.trunc(pages);

        // get all the details
        let info, orders;
        for (let x = 0; x<resArray.length; x++) {
            const viewData = await base.processOrderBody(resArray[x]);
            const resDetails = await request.post(baseURL + "/api/v3/order/get_shipment_order_list_by_order_ids_multi_shop", {
                data: viewData
            });

            let total, totalwsf, totalcharges ;
            info = await JSON.parse(JSON.stringify(await resDetails.json()));
            orders = await info.data.orders.map((x) => ({order_id : x.order_id, order_sn : x.order_sn,
                                                total: total = x.order_items.map(y =>  Number(y.order_price) * y.amount).reduce((total, y) => y+total),
                                                shipping_fee : Number(x.shipping_fee),
                                                total_plus_sf : totalwsf = Number(x.order_items.map(y =>  Number(y.order_price) * y.amount).reduce((total, y) => Number(y+total)) + Number(x.shipping_fee)),
                                                e_charges: totalcharges = Number(Number(totalwsf * 0.01).toFixed()) + 
                                                        Number(Number(totalwsf * 0.0224).toFixed()),
                                                net : totalwsf - totalcharges,
                                                //order_date: x,
                                                // order_completed: x,
                                                buyer_username: x.buyer_user.user_name, buyer_name : x.buyer_address_name, 
                                                items_count : Object.keys(x.order_items).length,
                                                order_items: x.order_items.map((y) => ({
                                                    item_id : y.item_id,
                                                    model_id : y.model_id,
                                                    quantity: y.amount, 
                                                    price: Number(y.order_price),
                                                    total: Number(y.order_price) * y.amount,
                                                    charge: Number(((((y.order_price) * y.amount) / Number(total))* totalcharges).toFixed())
                                                }))}));
            combinedResponses = (combinedResponses + await JSON.stringify(await orders,undefined,2)).replace("\n][",",");
        }
        combinedResponses = await combinedResponses.replace("]}[", ",").replace("undefined", "{ \"orders\":") + "}";
        ++count;
        //console.log(combinedResponses);
    } while (count <= pages);

    await fs.writeFile ("./result/to-ship-total.json", await combinedResponses, async function(err) {
        if (err) throw err;
            console.log('complete');
        }
    );
})

test("DAILY NET REPORT", async () => {
    const info = await base.loadContent("/result/to-ship-total.json");
    const data =  await base.locateJSON(await info);
    
    console.log("Daily Net Sales : ₱" + String(Number(await await data.orders.map(x => x.net).reduce((acc, x) => x+acc, 0)).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    //console.log("Daily Net Profit: ₱" + String(Number(await await data.orders.map(x => x.net).reduce((acc, x) => x+acc, 0)).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
})
