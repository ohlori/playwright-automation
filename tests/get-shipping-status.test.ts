import { Base } from '../util/base';
import test from '@playwright/test';
import { json } from 'stream/consumers';
import { join } from 'path';
var fs = require("fs");

const base = new Base();


test("Get SHIPPING ORDER ID info", async ({ request, baseURL }) => {
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
    }
    );
})

test("Get SHIPPPING status", async ({ request, baseURL }) => {
    test.setTimeout(0);
    let count = 0;
    const order_ids = await base.getJSONData("/result/shipping-order-ids.json");
    const total_order_ids = Object.keys(await order_ids.orders).length;
    let combinedResponses;

    
    do {
        const transDetail = await request.get(baseURL + "/api/v3/finance/income_transaction_history_detail/?order_id=" + String(Object.values(await order_ids.orders[count])));
        let info = await JSON.parse(JSON.stringify(await transDetail.json()));
        //console.log(typeof info.data.payment_info.fees_and_charges.transaction_fee);

        const getShippingStatus = await request.get(baseURL + "/api/v3/order/get_forder_logistics?order_id=" + String(Object.values(await order_ids.orders[count])));
        let stat = await JSON.parse(JSON.stringify(await getShippingStatus.json()));
        stat = await stat.data.list.map((x) => ({"order_id": x.order_id, "courier" : x.thirdparty_tracking_number, "status": x.status, "status2" : x.channel_status,
                            "subtotal" : info.data.payment_info.merchant_subtotal.product_price,
                            "shipping_fee": info.data.buyer_payment_info.shipping_fee,
                            "charges": Number(info.data.payment_info.fees_and_charges.transaction_fee) + Number(info.data.payment_info.fees_and_charges.commission_fee),
                            "refund" : info.data.payment_info.merchant_subtotal.refund_amount,
                            "net" : info.data.payment_info.merchant_subtotal.product_price - 
                                    (Number(info.data.payment_info.fees_and_charges.transaction_fee) + Number(info.data.payment_info.fees_and_charges.commission_fee))}));

        stat = await JSON.stringify(await stat ,undefined,2);
        combinedResponses = (await combinedResponses + await stat).replace("\n][",",");
        // console.log(await combinedResponses);
        ++count;
    } while (count < total_order_ids);

    
    await fs.writeFile ("./result/shipping-status.json", await combinedResponses.replace("undefined", ""), async function(err) {
        if (err) { throw err }
        console.log("complete");
    }    
    );
})