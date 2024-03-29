import { Base } from '../util/base';
import test from '@playwright/test';
import { Calls } from '../util/calls';
var fs = require("fs/promises");

const base = new Base();
const call = new Calls();

test("Get all TO SHIP items", async ({ request, baseURL }) => {
    test.setTimeout(12000000);
    await call.getAllToShip({ request, baseURL });
})

test("Calculate the profit", async () => {
    await call.calcProfit("./result/to-ship-total.json");
})

test("Save to database", async () => {
    await call.saveToDB();
})

test("Delete cancelled orders", async ({ request, baseURL }) => {
    test.setTimeout(12000000);
    await call.deleteCancelled({ request, baseURL });
})

test("DAILY NET REPORT", async () => {
    const data = await base.loadContent("/result/to-ship-total.json", true);
    console.log("Daily Net Sales : " + await base.pesoFormat(Number(await await data.orders.map(x => x.net).reduce((acc, x) => x+acc, 0))));
    console.log("Daily Net Profit: " + await base.pesoFormat(Number(await await data.orders.map(x => x.profit.total).reduce((acc, x) => x+acc, 0))));
})

test.skip("SAMPLE SKIP", async ({ request, baseURL }) => {
    await call.getShippingDetailsFromToShip({ request, baseURL });
})
