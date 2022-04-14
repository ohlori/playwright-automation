import { Base } from '../util/base';
import test from '@playwright/test';
import { Calls } from '../util/calls';
var fs = require("fs/promises");

const base = new Base();
const call = new Calls();
let total=0;

test("Get all COMPLETED transaction items with amount", async ({ request, baseURL }) => {
    test.setTimeout(0);
    await call.getAllCompleted({ request, baseURL });
})

test("Get SHIPPPING status", async ({ request, baseURL }) => {
    test.setTimeout(0);
    await call.getShippingStat({ request, baseURL });
})

test("Shipping Status Summary", async ({ request, baseURL }) => {
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
    console.log("\tDelivered:   " + delivered_count + " | ₱" +  String(Number(delivered_total).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("\tIn-Progress: " + shipping_count +" | ₱" + String(Number(shipping_total).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("-------------------------------------------");
    total = Number(Number(delivered_total) + Number(shipping_total));
    console.log("\x1b[33m%s\x1b[0m","\tShipping Total  : ₱" + String(await total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")));
 
    // TO SHIP SUMMARY
    const data2 = await base.loadContent("/result/to-ship-total.json");
    const toship =  await base.locateJSON(await data2);
    
    const sales = Number(await await toship.orders.map(x => x.net).reduce((acc, x) => x+acc, 0));
    console.log("\x1b[33m%s\x1b[0m","\tDaily Net Sales : ₱" + String(await sales.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")));
    total = Number(await total + await sales);
    
    // CURRENT BALANCE, SUBTOTAL & UNCATEGORIZED STATUS CODE
    let balance = 0;
    let num: number[] = [balance, balance + total, sales];
    const res_ = await request.get(baseURL + "/api/v3/finance/get_wallet_status/?wallet_type=0&bank_account_id=1021678");
    let rspn = await JSON.parse(JSON.stringify(await res_.json()));
    balance = rspn.data.balance;
    console.log("\x1b[33m%s\x1b[0m","\tCurrent Balance : ₱" + Number(balance).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("-------------------------------------------");
    console.log("\x1b[32m%s\x1b[0m","         SUB-TOTAL : ₱" + Number(balance + total).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("-------------------------------------------"); 
    console.log("\x1b[34m%s\x1b[0m","\tUNCATEGORIZED STATUS CODE: " + (Object.keys(data.orders).length-(rts_total_count+delivered_count+shipping_count)));
    console.log("-------------------------------------------");
})

test.skip("Test", async ({ request, baseURL }) => {
    let num: number[] = [5, 3, 2];
    //console.log("\x1b[32m%s\x1b[0m","         SUB-TOTAL : ₱" + Number(3).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log(num);
})