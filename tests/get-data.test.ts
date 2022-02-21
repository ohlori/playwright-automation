import { Base } from '../util/base';
import test from '@playwright/test';
import { Calls } from '../util/calls';
var fs = require("fs/promises");

const base = new Base();
const call = new Calls();


// test("Get COMPLETED items", async ({ request, baseURL }) => {
//     await call.getCompleted({ request, baseURL });
// })


test("Get all TO SHIP items", async ({ request, baseURL }) => {
    test.setTimeout(0);
    await call.getAllToShip({ request, baseURL });
})

test("Calculate the profit", async () => {
    await call.calcProfit();
})

test("Save to database", async () => {
    test.setTimeout(0);
    await call.saveToDB();
})

test("DAILY NET REPORT", async () => {
    const info = await base.loadContent("/result/to-ship-total.json");
    const data =  await base.locateJSON(await info);
    
    console.log("Daily Net Sales : ₱" + String(Number(await await data.orders.map(x => x.net).reduce((acc, x) => x+acc, 0)).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    console.log("Daily Net Profit: ₱" + String(Number(await await data.orders.map(x => x.profit.total).reduce((acc, x) => x+acc, 0)).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
})

