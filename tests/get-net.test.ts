import { Base } from '../util/base';
import test from '@playwright/test';
import { Calls } from '../util/calls';
var fs = require("fs/promises");

const base = new Base();
const call = new Calls();

test("NET PROFIT REPORT BY MONTH", async () => {
    const info = await base.loadJSONData("/db/orders.json");
    
    let month = 2;
    console.log("-------------------------------------------");
    console.log("             MONTHLY NET PROFIT            ");
    console.log("-------------------------------------------");
    let total = 0;
    do {
        const mon = month > 10 ? ""+month : "0"+month;4
        total = await info.orders.filter(x => x.order_date.toString().includes(mon+"/")).map(x => x.profit.total).reduce((acc, x) => x+acc, 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        if (await total != 0) {
            console.log(month +": ₱" +  total);
        }
        ++month;
    } while (total != 0)
})

test.only("DAILY NET PROFIT REPORT BY MONTH", async () => {
    const info = await base.loadJSONData("/db/orders.json");
    
    /*                UPDATE THE DATE AND MONTH!!       */
    let month = 8;
    let day = 1; //First entry is 02/18
   /****************************************************/
    console.log("-------------------------------------------");
    console.log("             MONTHLY NET PROFIT            ");
    console.log("-------------------------------------------");
    let total = 0;
    let subtotal = 0;
    let gross = 0;
    do {
        const mon = month > 10 ? ""+month : "0"+month;4
        subtotal = subtotal + Number(await info.orders.filter(x => x.order_date.toString().includes(mon+"/"+day+"/")).map(x => x.profit.total).reduce((acc, x) => x+acc, 0));
        gross = gross + Number(await info.orders.filter(x => x.order_date.toString().includes(mon+"/"+day+"/")).map(x => x.net).reduce((acc, x) => x+acc, 0));
        total = await info.orders.filter(x => x.order_date.toString().includes(mon+"/"+day+"/")).map(x => x.profit.total).reduce((acc, x) => x+acc, 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        if (await total != 0) {
            console.log(month +"/" + day +": ₱" +  total);
        }
        ++day;
    } while (total != 0)
    console.log("-------------------------------------------");
    console.log("             TOTAL  : ₱"+ subtotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +"            ");
    console.log("             AVERAGE: ₱"+ (subtotal/ (day-2)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +"            ");
    console.log("-------------------------------------------");
    console.log("       MONTHLY GROSS : ₱"+ gross.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +"            ");
})

test.skip("Test", async () => {
    let data = [];

    await base.loopJsonData ("/db/orders3.json", "orders", async function(obj) {
        const net_new = obj.total - obj.e_charges;
        
        data.push(await Object.assign(obj, {
            net: net_new
        }));
    });
    
    const processed = base.processOrderBody(data);
    let to_ship = JSON.stringify(await processed,undefined,2).replace(/\]\s*\]\s/, "]").replace(/\[\s*\[\s/, "[\n").replace(/\],\s*\[\s/, ",");
    base.saveFile("./db/orders3.json", to_ship);
})
