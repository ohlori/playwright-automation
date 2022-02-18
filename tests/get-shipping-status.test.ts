import { Base } from '../util/base';
import test from '@playwright/test';
import { Calls } from '../util/calls';
var fs = require("fs/promises");

const base = new Base();
const call = new Calls();

test("Get SHIPPING ORDER ID info", async ({ request, baseURL }) => {
    await call.getShippingStat({ request, baseURL });
})

test("Get SHIPPPING status", async ({ request, baseURL }) => {
    test.setTimeout(0);
    await call.getShippingStat({ request, baseURL });
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
