import test from '@playwright/test';
import { Calls } from '../util/calls';
import { count } from 'console';
var fs = require("fs/promises");

const call = new Calls();


test("Get all COMPLETED transaction items with amount", async ({ request, baseURL }) => {
    test.setTimeout(0);
    await call.getAllCompleted({ request, baseURL });
})

test("Get all RETURN/REFUND items", async ({ request, baseURL }) => {
    test.setTimeout(0);
    await call.getAllRefund({ request, baseURL });
})

test("Validate the completed vs the expected", async () => {
    test.setTimeout(0);
    await call.auditShopeeIncomeComp();
})