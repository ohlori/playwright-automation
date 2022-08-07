import { Base } from '../util/base';
import test from '@playwright/test';
import { Calls } from '../util/calls';
var fs = require("fs/promises");

const base = new Base();
const call = new Calls();
let total=0;
let status_change = false;

test("Get all COMPLETED transaction items with amount", async ({ request, baseURL }) => {
    test.setTimeout(0);
    status_change = await call.getAllCompleted({ request, baseURL });
})

if (status_change){
    test("Get SHIPPPING status", async ({ request, baseURL }) => {
        test.setTimeout(0);
        await call.getShippingStat({ request, baseURL });
    });
} else {
    test("No status change", async () => {});
}

test("Shipping Status Summary", async ({ request, baseURL }) => {
    const info = await base.loadContent("/result/shipping-status.json");
    let flow = await base.loadJSONData("/accounting/flow.json");
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
    console.log("\x1b[31m%s\x1b[0m","\t      RTS: " + rts_total_count + " | " +  await base.pesoFormat(Number(await rts_total)));
    console.log("-------------------------------------------");
    console.log("\tDelivered:   " + delivered_count + " | " +  await base.pesoFormat(Number(delivered_total)));
    console.log("\tIn-Progress: " + shipping_count +" | " + await base.pesoFormat(Number(shipping_total)));
    console.log("-------------------------------------------");
    total = Number(Number(delivered_total) + Number(shipping_total));
    console.log("\x1b[33m%s\x1b[0m","\tShipping Total  : " + await base.pesoFormat(total));
 
    // TO SHIP SUMMARY
    const data2 = await base.loadContent("/result/to-ship-total.json");
    const toship =  await base.locateJSON(await data2);
    
    const sales = Number(await await toship.orders.map(x => x.net).reduce((acc, x) => x+acc, 0));
    console.log("\x1b[33m%s\x1b[0m"," Daily Sales (excl. SF) : " + await base.pesoFormat(await sales));
    total = Number(await total + await sales);
    
    // CURRENT BALANCE, SUBTOTAL & UNCATEGORIZED STATUS CODE
    let balance = 0;
    const res_ = await request.get(baseURL + "/api/v3/finance/get_wallet_status/?wallet_type=0&bank_account_id=1021678");
    let rspn = await JSON.parse(JSON.stringify(await res_.json()));
    balance = rspn.data.balance;
    console.log("\x1b[33m%s\x1b[0m","\tCurrent Balance : " + await base.pesoFormat(Number(balance)));
    console.log("-------------------------------------------");
    console.log("\x1b[33m%s\x1b[0m","\tSUB-TOTAL       : " + await base.pesoFormat(Number(balance + total)));
    console.log("-------------------------------------------");
    console.log("\x1b[32m%s\x1b[0m","\tON HAND         : " + await base.pesoFormat((balance + Number(flow.start.onHand)) - Number(flow.expense.map(x => x.amount).reduce((acc, x) => x+acc, 0))));
    console.log("-------------------------------------------"); 
    console.log("\x1b[34m%s\x1b[0m","\tUNCATEGORIZED STATUS CODE: " + (Object.keys(data.orders).length-(rts_total_count+delivered_count+shipping_count)));
    console.log("-------------------------------------------");
})

test.skip("Test", async ({ request, baseURL }) => {
    let flow = await base.loadJSONData("/accounting/flow.json");
    console.log(flow.expense.map(x => x.amount).reduce((acc, x) => x+acc, 0));
})