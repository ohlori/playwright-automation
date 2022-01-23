import { Base } from '../util/base';
import test from '@playwright/test';
var fs = require("fs/promises");

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

    // Order IDS to be searched
    const order_ids = await base.getJSONData("/result/shipping-order-ids.json");
    const total_order_ids = Object.keys(await order_ids.orders).length;
    let combinedResponses;

    // JSON file to be checked
    const info = await base.loadContent("/result/shipping-status.json");
    const orders =  await base.locateJSON(await info);

    for (let x = 0; x < total_order_ids; x++) {
        const current_val = Number(Object.values(await order_ids.orders[x]));
        const transDetail = await request.get(baseURL + "/api/v3/finance/income_transaction_history_detail/?order_id=" + String(current_val));
        let info = await JSON.parse(JSON.stringify(await transDetail.json()));
        //console.log(typeof info.data.payment_info.fees_and_charges.transaction_fee);

        const getShippingStatus = await request.get(baseURL + "/api/v3/order/get_forder_logistics?order_id=" + String(current_val));
        let stat = await JSON.parse(JSON.stringify(await getShippingStatus.json()));
        stat = await stat.data.list.map((x) => ({"order_id": x.order_id, "courier" : x.thirdparty_tracking_number, "status": x.status, "status2" : x.channel_status,
                            "subtotal" : info.data.payment_info.merchant_subtotal.product_price,
                            "shipping_fee": info.data.buyer_payment_info.shipping_fee,
                            "charges": Number(info.data.payment_info.fees_and_charges.transaction_fee) + Number(info.data.payment_info.fees_and_charges.commission_fee),
                            "refund" : info.data.payment_info.merchant_subtotal.refund_amount,
                            "net" : info.data.payment_info.merchant_subtotal.product_price - 
                                    (Number(info.data.payment_info.fees_and_charges.transaction_fee) + Number(info.data.payment_info.fees_and_charges.commission_fee))}));

        stat = await JSON.stringify(await stat[0], undefined,2);
        combinedResponses = (await combinedResponses + await stat).replace("\n}{","\n},\n{");
    }

    //console.log(await combinedResponses);
    await fs.writeFile ("./result/shipping-status.json", await combinedResponses.replace("undefined","{ \"orders\" : [") + "\n]\n}", async function(err) {
        if (err) { throw err }
        console.log("complete");
    }    
    );
})

test("Shipping Status Summary", async () => {
    const info = await base.loadContent("/result/shipping-status.json");
    const data =  await base.locateJSON(await info);
    const rts_total_count = await data.orders.filter(x => x.status === 203).length;
    const rts_total = await data.orders.filter(x => x.status === 203).map(x => x.net).reduce((acc, x) => x+acc, 0);

    const delivered_count = await data.orders.filter(x => x.status === 8).length;
    const delivered_total = await data.orders.filter(x => x.status === 8).map(x => x.net).reduce((acc, x) => x+acc, 0);

    const shipping_count = await data.orders.filter(x => x.status === 6).length;
    const shipping_total = await data.orders.filter(x => x.status === 6).map(x => x.net).reduce((acc, x) => x+acc, 0);

    console.log("-------------------------------------------");
    console.log("|     SUMMARY OF SHIPPING STATUS " + "[" + Object.keys(data.orders).length +"]"+"    |");
    console.log("-------------------------------------------");
    console.log("\x1b[31m%s\x1b[0m","\t      RTS: " + rts_total_count + " | ₱" +  String(Number(await rts_total).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));;

    console.log("-------------------------------------------");
    console.log("\x1b[32m%s\x1b[0m","\tTO COLLECT TOTAL: ₱" + String(Number(Number(delivered_total) + Number(shipping_total)).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("-------------------------------------------");
    console.log("\tDelivered:   " + delivered_count + " | ₱" +  String(Number(delivered_total).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("\tIn-Progress: " + shipping_count +" | ₱" + String(Number(shipping_total).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("-------------------------------------------");
    console.log("\x1b[33m%s\x1b[0m","\tUNCATEGORIZED STATUS CODE: " + (Object.keys(data.orders).length-(rts_total_count+delivered_count+shipping_count)));
    console.log("-------------------------------------------"); 
})
