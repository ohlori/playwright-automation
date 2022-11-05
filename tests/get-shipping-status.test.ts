import { Base } from '../util/base';
import test from '@playwright/test';
import { Calls } from '../util/calls';
var fs = require("fs/promises");

const base = new Base();
const call = new Calls();
let total=0;
let status_change;

test("Get SHIPPING status", async ({ request, baseURL }) => {
    test.setTimeout(12000000);
    status_change = await call.getAllCompleted({ request, baseURL });
    if (await status_change) {
        await call.getShippingStat(await {request, baseURL });
    }
})

test("Check if all items are saved in DB", async ({ request, baseURL }) => {
    test.setTimeout(12000000);
    await call.saveMissingOrdersInDB({ request, baseURL });
    await call.calcProfit("./db/orders.json");
})

test("Shipping Status Summary", async ({ request, baseURL }) => {
    const data = await base.loadContent("/result/shipping-status.json", true);
    let flow = await base.loadJSONData("/accounting/flow.json");
    const rts = await data.orders.filter(x => x.status === 203);
    const rts_total = rts.map(x => x.net).reduce((acc, x) => x+acc, 0);

    const total_missing = await data.orders.filter(x => x.status === 9);

    const delivered_count = await data.orders.filter(x => x.status === 8).length;
    const delivered_total = await data.orders.filter(x => x.status === 8).map(x => x.net).reduce((acc, x) => x+acc, 0);

    const shipping_count = await data.orders.filter(x => x.status === 6).length;
    const shipping_total = await data.orders.filter(x => x.status === 6).map(x => x.net).reduce((acc, x) => x+acc, 0);

    console.log("---------------------------------------------------");
    console.log("|         SUMMARY OF SHIPPING STATUS " + "[" + Object.keys(data.orders).length +"]"+"        |");
    console.log("---------------------------------------------------");
    console.log("\x1b[31m%s\x1b[0m","\t\t    RTS: " + rts.length + " | " +  await base.pesoFormat(Number(await rts_total)));
    if (rts.length > 0){
        const rtsOrderIds = await data.orders.filter(x => x.status === 203).map(y => y.order_id);
        console.log("\x1b[31m%s\x1b[0m", "\t\t    " +rtsOrderIds);
    }
    console.log("---------------------------------------------------");
    console.log("\tDelivered:   " + delivered_count.toString().padEnd(11) +  await base.pesoFormat(Number(delivered_total)));
    console.log("\tIn-Progress: " + shipping_count.toString().padEnd(11) + await base.pesoFormat(Number(shipping_total)));
    console.log("---------------------------------------------------");
    total = Number(Number(delivered_total) + Number(shipping_total));
    console.log("\x1b[33m%s\x1b[0m","\tShipping Total        : " + await base.pesoFormat(total));
 
    // TO SHIP SUMMARY
    const toship = await base.loadContent("/result/to-ship-total.json", true);
    
    // TO SHIP (with Shopee's actual calculation)
    // await call.getShippingDetailsFromToShip({ request, baseURL });
    // const toship = await base.loadContent("/result/toShipActualIncomeDetails.json", true);

    const sales = Number(await await toship.orders.map(x => x.net).reduce((acc, x) => x+acc, 0));
    console.log("\x1b[33m%s\x1b[0m","\tDaily Sales Net       : " + await base.pesoFormat(await sales));
    total = Number(await total + await sales);
    
    // CURRENT BALANCE, SUBTOTAL & UNCATEGORIZED STATUS CODE
    let balance = 0;
    const res_ = await request.get(baseURL + "/api/v3/finance/get_wallet_status/?wallet_type=0&bank_account_id=1021678");
    let rspn = await JSON.parse(JSON.stringify(await res_.json()));
    balance = rspn.data.balance;
    console.log("\x1b[33m%s\x1b[0m","\tCurrent Balance       : " + await base.pesoFormat(Number(balance)));
    console.log("---------------------------------------------------");
    console.log("\x1b[33m%s\x1b[0m","\tSUB-TOTAL             : " + await base.pesoFormat(Number(balance + total)));
    console.log("---------------------------------------------------");
    const onhand = Number(balance + Number(flow.start.onHand)) - Number(flow.expense.map(x => x.amount).reduce((acc, x) => x+acc, 0));
    console.log("\x1b[32m%s\x1b[0m","\tONHAND + DELIVERED    : " + await base.pesoFormat(Number(delivered_total+ onhand)));
    if (total_missing.length > 0) {
        console.log("---------------------------------------------------");
        console.log("\x1b[34m%s\x1b[0m","\t    MISSING DURING DELIVERY: "+total_missing.length);
        console.log("\x1b[34m%s\x1b[0m","\t    "+ await total_missing.map(y => y.order_id));
    }
    const uncat = (Object.keys(data.orders).length-(rts.length+delivered_count+shipping_count+total_missing.length));
    if (uncat > 0) {
        console.log("---------------------------------------------------"); 
        console.log("\x1b[34m%s\x1b[0m","\t    UNCATEGORIZED STATUS CODE: " + await uncat);
    }
    console.log("---------------------------------------------------");
})

test.skip("Test", async ({ request, baseURL }) => {
    let flow = await base.loadJSONData("/accounting/flow.json");
    console.log(flow.expense.map(x => x.amount).reduce((acc, x) => x+acc, 0));
})