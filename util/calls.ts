import { Base } from '../util/base';
import { Reuse } from '../util/reuse';
import { global } from "../global";
import { callbackify } from 'util';
var fs = require("fs/promises");

const base = new Base();
const reuse = new Reuse();


export class Calls {

    /* GOAL: Get all completed data starting from the last logged and get the net income daily (collected)
    * TODO:
    * 1. Since this call can only pull up to 40 orders, loop this up to the last page
    * 2. Compare it to the already listed items to mark as "COMPLETE"
    * 3. Take note of the time, so it can be filtered by day to get the net income daily
    **/
    public async getCompleted({ request, baseURL }): Promise<any> {
        const res_ = await request.get(baseURL + "/api/v3/order/get_order_id_list?source=completed&page_size=30&page_number=1");
        await fs.writeFile ("./result/completed-items.json", JSON.stringify(await res_.json(),undefined,2), function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );
    }

    //GOAL: Get all to-ship orders to automatically log it on the inventory to get the net incomes daily (uncollected)
    public async getAllToShip({ request, baseURL }): Promise<any> {
        try{
            let count = 1;
            let toAdd=[];
            let allToShipOrderIds=new Set();
            let pages,combinedResponses;
            let currentToAddDetails;
            let products = await base.loadJSONData("/stocks/products.json");
            const to_ship = await base.loadJSONData("/result/to-ship-total.json");
            let to_ship_ids = to_ship.orders.map(x => x.order_id);

            do {
                //PROCESSED ONLY
                const res_ = await request.get(baseURL + "/api/v3/order/get_package_list?source=processed&page_number="+count);
                //ALL
                // const res_ = await request.get(baseURL + "/api/v3/order/get_package_list?page_number="+count);
                let rspn = await JSON.parse(JSON.stringify(await res_.json()));
                const toShipDetails = await rspn.data.package_list.map((x) => ({"order_id": x.order_id, "region_id": global.region_id, "shop_id": global.shop_id,
                                                                                     order_date: x.order_create_time}));
                
                // Get all the order ids from To Ship tab to use later (to remove ids from to-ship-total.json that are not anymore listed from the tab)
                toShipDetails.forEach((x) => {allToShipOrderIds.add(x.order_id)});
                
                // Get only the order_ids that are NOT listed in the to-ship-total.json
                currentToAddDetails = toShipDetails.filter(el => (-1 == to_ship_ids.indexOf(el.order_id)));
                //TO TEST: currentToAddDetails = toShipDetails.filter(el => (-1 == to_ship_ids.indexOf(el.order_id)) || (to_ship_ids.indexOf(el.order_id).map(k => k.tracking_num === "")));

                // Check how many pages is the To Ship tab
                if (count===1) {
                    pages = rspn.data.total/40;
                    pages = (rspn.data.total % 40) !== 0 ? Math.trunc(pages)+1 : Math.trunc(pages);
                }
                
                if(currentToAddDetails.length!==0){
                    // Prepare body --- slice the response into 10 (this is the only allowable # of data per call)
                    let resArray=[];
                    for (let i = 0, j = currentToAddDetails.length; i < j; i += 10) {
                        resArray.push(currentToAddDetails.slice(i, i + 10));
                    }

                    // get all the details
                    let info, orders;
                    combinedResponses = await reuse.getOrderDetails({ request, baseURL }, resArray, rspn.data.package_list, toShipDetails);
                }
                
                ++count;
                // console.log(pages);
            } while (await count <= pages+1);

            if (combinedResponses!==undefined){
                //Remove the shipped items (by removing orders that are not anymore listed on the To Ship tab)
                const removeOutdated = await to_ship.orders.filter((i) => allToShipOrderIds.has(i.order_id));
                combinedResponses = JSON.parse(combinedResponses);
                //Combining new orders + current to ship orders from To Ship tab
                let updatedToShip = removeOutdated.concat(combinedResponses);
            
                await base.saveFile("./result/to-ship-total.json", JSON.stringify(await updatedToShip, undefined, 2).replace("\n]", "]}").replace("[\n","{ \"orders\": ["));
            }

            console.log("\x1b[32m%s\x1b[0m","\t[to-ship] ADDED ITEMS: " + await currentToAddDetails.length);
        } catch(e) {
            console.error(e)
        }

        const allOrders = await base.loadContent("/result/to-ship-total.json", true);
        console.log("\x1b[32m%s\x1b[0m","\tTOTAL TO SHIP: " + await allOrders.orders.filter(x => x.order_id).length);
    }

    public async calcProfit(fileToCalc: any): Promise<any> {
        let products = await base.loadJSONData("/stocks/products.json");
        let data = [];

        await base.loopJsonDatafromJSON(fileToCalc, "orders", async function(obj) {
            let dateNow = base.getDateFromEpoch(obj.order_date);
            let total=0, resArray={};
            const item = obj.order_items;
            if ((!Object.prototype.hasOwnProperty.call(obj, "profit"))){
                for (let x = 0; x<item.length; x++) {
                    let currentCost;
                    // Excluding piso print, waybill printer, comb binding, japanese from zero, korean from zero, harrison's
                    if (item[x].item_id !== 5466601122 && item[x].item_id !== 9796544496 && item[x].item_id !== 13266021243 &&
                        item[x].item_id !== 10823437701 && item[x].item_id !== 8248315539 && item[x].item_id !== 7277574568 ) {
                        //Check if ITEM ID is in the products db
                        try {
                            await products[item[x].item_id]
                        }catch (error) {
                            console.log ("[ORDER ID: " +obj.order_sn+ "] Missing ITEM ID: " + item[x].item_id);
                        }

                        //Check if MODEL ID is in the products db
                        try {
                            await products[item[x].item_id][item[x].model_id]["cost"];
                        }catch (error) {
                            console.log ("[ORDER ID: " +obj.order_sn+ " | ITEM ID: " +item[x].item_id+ "] Missing MODEL ID: " + item[x].model_id);
                        }
                        currentCost = products[item[x].item_id][item[x].model_id]["cost"] * item[x].quantity;
                        const netprof = (item[x].total - item[x].charge) - currentCost;
                        total = total + netprof;
                        resArray[item[x].model_id] = Number(netprof.toFixed(2));
                    // Items that need to be analyze because listing has a combined products: 3355461227 - Paperang+
                    } else if (item[x].item_id === 3355461227){

                    }
                }

                data.push(await Object.assign(obj, {
                    order_date : dateNow,
                    profit: {
                        total: Number(total.toFixed(2)),
                        ...resArray
                    } 
                }));
            } else {
                data.push(await Object.assign(obj));
            }
        });

        const processed = await base.processOrderBody(data);
        let to_ship = JSON.stringify(processed,undefined,2);
        await fs.writeFile (fileToCalc, to_ship, async function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );
    }

    public async getShippingStat({ request, baseURL }): Promise<any> {
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
            
        } while (count <= pages+2);
        combinedResponses = combinedResponses.replaceAll(",]\n[", ",").replace(",][]", "]");
        // console.log(combinedResponses);
        let combinedRes;
        const order_ids = await base.processOrderBody(JSON.parse(combinedResponses));
        const total_order_ids = Object.keys(await order_ids.orders).length;
        // console.log(order_ids)

        await reuse.getShippingDetails({request, baseURL}, await order_ids, "./result/shipping-status.json");
    }
    
    public async getShippingDetailsFromToShip({ request, baseURL }): Promise<any> {
        const data = await base.loadContent("/result/to-ship-total.json", true);
        await reuse.getShippingDetails({request, baseURL}, await data, "./result/toShipActualIncomeDetails.json");
    }

    public async saveMissingOrdersInDB({ request, baseURL }): Promise<any> {
        let current_details = await base.loadJSONData("/db/orders.json");
        let inShipping = await base.loadJSONData("/result/shipping-status.json");
        const inShippingCount = inShipping.orders.length;
        let missing = []; 

        for (let i=0; i<inShippingCount; i++) {
            if (await current_details.orders.filter(x => x.order_id === inShipping.orders[i].order_id).length === 0) {
                // console.log(inShipping.orders[i].order_id + " not found!");
                missing.push({"order_id": inShipping.orders[i].order_id, "region_id": global.region_id, "shop_id": global.shop_id});
            }
        }

        if (missing.length>0) {
            // Prepare body --- slice the response into 10 (this is the only allowable # of data per call)
            let resArray=reuse.sliceTo10(await missing);

            // get all the necessary details
            let missing_details = await reuse.getOrderDetails({ request, baseURL }, resArray, inShipping.orders, inShipping.orders);
            missing_details = missing_details.replace(/[\t\n\r]/gm, "");

            const missingDetails = JSON.parse(missing_details)
            const order_ids = missingDetails.map(x => x.order_id);
            const combined = Object.assign(current_details, {missingDetails});
            
            for (let item of missingDetails) {
                console.log(item.order_id);
            }

            let to_ship = JSON.stringify(await combined,undefined,2).replace(/\s\],\s*\"missingDetails\": \[\s/, ",\n").replace("\n ,", ",");
            await base.saveFile("./db/orders.json", to_ship.replace(/,\s*\"missingDetails\": \[\]\s/, "\n"));
            console.log("\x1b[31m%s\x1b[0m","\t[MISSING: " + order_ids+"]");
            console.log("\x1b[32m%s\x1b[0m","\t[db] ADDED ITEMS: " + order_ids.length);
        }
    }

    public async saveToDB(): Promise<any> {
        let current_details = await base.loadJSONData("/db/orders.json");
        let current_to_ship = await base.loadJSONData("/result/to-ship-total.json");

        const to_ship_total_count = current_to_ship.orders.length;
        let count = 0;
        let toAdd = [];
        for (let x=0; x<to_ship_total_count; x++) {
            // If it does not exist on the order-details.json, add the details
            // console.log(await current_details.orders.filter(z => z.order_id === current_to_ship.orders[x].order_id).length);
            if(await current_details.orders.filter(z => z.order_id === current_to_ship.orders[x].order_id).length === 0){
                if (current_to_ship.orders[x].hasOwnProperty("profit")) {
                    ++count;
                    toAdd.push(await current_to_ship.orders[x]);
                } else {
                    console.log("\x1b[31m%s\x1b[0m","ORDER ID/S WITHOUT COMPUTED PROFIT: " +  current_to_ship.orders[x].order_id);

                }
            }
        }
        const combined = Object.assign(current_details, {toAdd});
    
        let to_ship = JSON.stringify(await combined,undefined,2).replace(/\s\],\s\s*\"toAdd\": \[\s/, ",\n").replace("\n ,", ",");
        await base.saveFile("./db/orders.json", to_ship.replace(/,\s*\"toAdd\": \[\]\s/, "\n"));
        console.log("\x1b[32m%s\x1b[0m","\t[db] ADDED ITEMS: " + count);
    }

    public async deleteCancelled({ request, baseURL }): Promise<any> {
        let orders = await base.loadJSONData("/db/orders.json");

        const cancelled_list = await request.get(baseURL + "/api/v3/order/get_order_id_list?source=cancelled_all&page_number=1");
        let rspn = await JSON.parse(JSON.stringify(await cancelled_list.json()));
        await base.saveFile("./db/cancelled.json", JSON.stringify(await cancelled_list.json(),undefined,2));

        const toDelete = rspn.data.orders.length;
        let indexes = new Set();
        for (let x=0; x<toDelete; x++){
            if (await orders.orders.filter(z => z.order_id === rspn.data.orders[x].order_id).length === 1){
                const index = await orders.orders.findIndex(z => z.order_id === rspn.data.orders[x].order_id);
                indexes.add(index);
                // For terminal reporting only
                if (indexes.size === 1) {
                    console.log("\x1b[31m%s\x1b[0m", "\t-------- CANCELLED ORDERS --------");
                }
                console.log("\x1b[31m%s\x1b[0m", "\t\t  " +rspn.data.orders[x].order_id);
            }
        }
        // For terminal reporting only
        if (indexes.size > 0) {
            console.log("\x1b[31m%s\x1b[0m", "\t--------------------------------");
        }

        let new_orders = orders.orders.filter((x, i) => !indexes.has(i));
        new_orders = Object.assign({orders: new_orders});
        orders = JSON.stringify(new_orders,undefined,2);
        await base.saveFile("./db/orders.json", orders);
    }

    public async getAllCompleted({ request, baseURL }): Promise<boolean> {
        let completed = await base.loadJSONData("/db/s-completed.json");
        let page = 1;
        let found = false;
        let toAdd = [];
        let count = 0;
        do {
            const res = await request.get(baseURL + "/api/v3/finance/get_wallet_transactions/?wallet_type=0&transaction_types=101,102&page_size=100&page_number="+page, { timeout: 0 });
            let response = await JSON.parse(JSON.stringify(await res.json()));
            const size = response.data.list.length;
            for (let x = 0; x<size; x++) {
                if(await completed.orders.filter(z => z.order_id === response.data.list[x].order_id).length === 0){
                    ++count;
                    const item = {"order_id": response.data.list[x].target_id, "order_sn" : response.data.list[x].order_sn, 
                                "amount" : response.data.list[x].amount, "refund": 0, "transaction_id": response.data.list[x].transaction_id};
                    toAdd.push(await item);
                } else {
                    found = true;
                    break;
                }
            }

            page = found === false ? page+1: page;
        } while (found === false);

        const combined = Object.assign(completed, {toAdd});
        const updatedList = JSON.stringify(await combined,undefined,2).replace(/\s\],\s\s*\"toAdd\": \[\s/, ",\n").replace("\n ,", ",");
        await base.saveFile("./db/s-completed.json", updatedList.replace(/,\s*\"toAdd\": \[\]\s/, "\n"));
        console.log("\x1b[32m%s\x1b[0m","\tADDED ITEMS: " + count);
        const change = await count > 0;
        return change;
    }

    public async getAllRefund({ request, baseURL }): Promise<any> {
        let combinedResponses, res_size;
        let page = 1;
        do {
            const res = await request.get(baseURL + "/api/v2/return/list?SPC_CDS_VER=2&page_size=100&page_number=" + page);
            let response = await JSON.parse(JSON.stringify(await res.json()));
            res_size = response.data.list.length;
            let infos = await response.data.list.map((x) => ({"order_id": x.order_id, "return_id": x.return_id, "refund_amount": x.refund_amount, status: x.return_header.status_text_key}));

            for (let x=0; x<infos.length; x++) {
                if(infos[x].status.includes("completed")){
                    combinedResponses = (await combinedResponses + await JSON.stringify(await infos[x],undefined,2)).replace("\n}{","\n\t},\n\t{");;
                }
            }
            ++page;
        } while (res_size !==0)

        combinedResponses = await combinedResponses.replace("undefined", "{ \"orders\": [");
        await fs.writeFile ("./result/refund.json", await combinedResponses.replace("\n}","\n\t}") + "\n]}" , async function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );
    }

    public async auditShopeeIncomeComp(): Promise<any> {
        let expectedOrderCharges = await base.loadJSONData("/db/orders.json");
        let actualOrderCharges = await base.loadJSONData("/db/s-completed.json");
        let shipping = await base.loadJSONData("/result/shipping-status.json");
        let to_ship = await base.loadJSONData("/result/to-ship-total.json");
        let valid_discrep = await base.loadJSONData("/db/valid-discrepancy.json");
        let refund = await base.loadJSONData("/result/refund.json");
        const size = expectedOrderCharges.orders.length;
        
        let combinedResponses = { orders : [] };
        let count=0, totalDiscrp = 0;
        for (let x = 0; x< size; x++) {
            let result = await actualOrderCharges.orders.filter(z => z.order_sn === expectedOrderCharges.orders[x].order_sn);
            
            try {
                // Check if expected amount is not equal from the actual that was listed in Shopee
                if (await valid_discrep.orders.filter(z => z.order_id === expectedOrderCharges.orders[x].order_id).length === 0 &&
                        result[0].amount !== expectedOrderCharges.orders[x].net) {
                    // Check the if the actual amount is less than the expected
                    if (result[0].amount < expectedOrderCharges.orders[x].net) {
                        // Find in the refund lists if there was a refund/return trasaction
                        let refund_detail = await refund.orders.filter(z => z.order_id === expectedOrderCharges.orders[x].order_id);
                        let new_e = expectedOrderCharges.orders[x].total - Number(refund_detail[0].refund_amount);
                        const new_charges = Math.round(new_e * global.comFee) + Math.round(new_e * global.transFee);
                        new_e = await new_e - new_charges;
                        const discrep = new_e - Number(result[0].amount);
                        totalDiscrp = totalDiscrp +discrep;
                        if (result[0].amount !== new_e) {
                            combinedResponses.orders.push({status: "discrepancy", order_id: expectedOrderCharges.orders[x].order_id,
                                                    return_id:refund_detail[0].return_id, e_amount: new_e, a_amount: result[0].amount, discrep_amount: discrep});
                            ++count;
                            // console.log(expectedOrderCharges.orders[x].total + " - " + Number(refund_detail[0].refund_amount) + "-" + new_charges + " = "+ await new_e);
                            // console.log("[ORDER ID:"+expectedOrderCharges.orders[x].order_id + "][RETURN ID: " +refund_detail[0].return_id + "]"+
                            //             "["+ await base.pesoFormat(result[0].amount) +"][E: "+await base.pesoFormat(new_e) +"]");
                        }
                    }
                }
            // DATA NOT FOUND
            }catch (e) {
                let order_id;
                let e_amount_missing;
                if (await shipping.orders.filter(z => z.order_id === expectedOrderCharges.orders[x].order_id).length === 0 &&
                    await to_ship.orders.filter(z => z.order_id === expectedOrderCharges.orders[x].order_id).length === 0 &&
                    await refund.orders.filter(z => z.order_id === expectedOrderCharges.orders[x].order_id).length === 0) {
                    combinedResponses.orders.push({status: "missing", order_id: expectedOrderCharges.orders[x].order_id, missing_amount: expectedOrderCharges.orders[x].net});
                    ++count;
                    //console.log("\x1b[31m%s\x1b[0m","NOT FOUND: " + expectedOrderCharges.orders[x].order_id +" | MISSING: " + expectedOrderCharges.orders[x].net.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
                }
            }
        }
        
        await fs.writeFile ("./action_item/to-report.json", JSON.stringify(await combinedResponses,undefined,2), async function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );
        const data = await base.loadContent("/action_item/to-report.json", true);
        const missing = await base.pesoFormat(Number(await await data.orders.map(x => x.missing_amount).filter(item => !!item).reduce((acc, x) => x+acc, 0)));

        console.log("\x1b[31m%s\x1b[0m","TOTAL ITEMS WITH ISSUE: " + count);
        console.log("\x1b[31m%s\x1b[0m","TOTAL DISCREPANCY AMOUNT: " + await base.pesoFormat(totalDiscrp));  
        console.log("\x1b[31m%s\x1b[0m","TOTAL MISSING AMOUNT: " + missing);
    }

    public async getAllCompletedFromStart({ request, baseURL }): Promise<any> {
        let completed = await base.loadJSONData("/db/s-completed.json");
        let page = 1;
        let found = false;
        let toAdd = [];
        let count = 0;
        let totalPages;
        //do {
            const res = await request.get(baseURL + "/api/v3/finance/get_wallet_transactions/?SPC_CDS_VER=2&wallet_type=0&start_date=2020-06-06&end_date=2022-07-03&page_size=50&page_number="+page);
            let response = await JSON.parse(JSON.stringify(await res.json()));
            totalPages = response.data.page_info.total;
            console.log(totalPages);
            console.log(response.data.list.filter(z => z.order_sn).length);
            for (let x = 0; x<response.data.list.length; x++) {
                if(await completed.orders.filter(z => z.order_sn === response.data.list[x].order_sn).length === 0){
                    ++count;
                    const item = {"order_id": response.data.list[x].target_id, "order_sn" : response.data.list[x].order_sn, 
                                "amount" : response.data.list[x].amount, "refund": 0, "transaction_id": response.data.list[x].transaction_id};
                    toAdd.push(await item);
                } else {
                    found = true;
                    break;
                }
            }

            // page = found === false ? page+1: page;
        // } while (found === false);

        // const combined = Object.assign(completed, {toAdd});
        // const updatedList = JSON.stringify(await combined,undefined,2).replace(/\s\],\s\s*\"toAdd\": \[\s/, ",\n").replace("\n ,", ",");
        // await fs.writeFile ("./db/s-completed.json", updatedList.replace(/,\s*\"toAdd\": \[\]\s/, "\n"), async function(err) {
        //     if (err) throw err;
        //         console.log('complete');
        //     }
        // );
        // console.log("\x1b[32m%s\x1b[0m","\tADDED ITEMS: " + count);
        await fs.writeFile ("./db/all.json", JSON.stringify(await response,undefined,2), async function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );
    }

    public async updateOrderDateInDBOrders({ request, baseURL }, keyToUpdate:string, incorrecVal:string): Promise<any> {
        const dealIds = await reuse.getDealIdsWithIncorrectVal({ request, baseURL }, keyToUpdate, incorrecVal);
        for (let orderId of dealIds) {
            const  orderDate = await reuse.getOrderDate({ request, baseURL }, orderId);
            await reuse.updateDBOrderDetails(orderId, keyToUpdate, orderDate)
        }
    }
}