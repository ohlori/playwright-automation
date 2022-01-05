import { Base } from '../util/base';
import test from '@playwright/test';
import { json } from 'stream/consumers';
import { join } from 'path';
var fs = require("fs");

const base = new Base();

test("Shipping Status Summary", async ({ request, baseURL }) => {
    const info = await base.loadContent("/result/shipping-status.json");
    const rts_total_count = Object.values(info).filter(x => x.status === 203).length;
    const rts_total = await Object.values(info).filter(x => x.status === 203).map(x => x.net).reduce((acc, x) => x+acc);
    // console.log (rts_total_total);

    const delivered_count = Object.values(info).filter(x => x.status === 8).length;
    const delivered_total = await Object.values(info).filter(x => x.status === 8).map(x => x.net).reduce((acc, x) => x+acc);

    const shipping_count = Object.values(info).filter(x => x.status === 6).length;
    const shipping_total = await Object.values(info).filter(x => x.status === 6).map(x => x.net).reduce((acc, x) => x+acc);
    //console.log(Object.values(info).filter(x => x.status === 6).length)
    console.log("-------------------------------------------");
    console.log("|       SUMMARY OF SHIPPING STATUS        |");
    console.log("-------------------------------------------");
    console.log("\x1b[31m%s\x1b[0m","\tRETURN TO SELLER (RTS): " + rts_total_count);
    console.log("\x1b[31m%s\x1b[0m","\t ► Lost: ₱" + String(Number(rts_total).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));;

    console.log("\n-------------------------------------------");
    console.log("\x1b[32m%s\x1b[0m","\tTO COLLECT TOTAL: ₱" + String(Number(Number(delivered_total) + Number(shipping_total)).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("-------------------------------------------");
    console.log("\tDelivered:   " + delivered_count + " | ₱" +  String(Number(delivered_total).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("\tIn-Progress: " + shipping_count +" | ₱" + String(Number(shipping_total).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("\n-------------------------------------------");
    console.log("\x1b[33m%s\x1b[0m","\tUNCATEGORIZED STATUS CODE: " + (Object.values(info).length-(rts_total_count+delivered_count+shipping_count)));
    console.log("-------------------------------------------"); 
})
