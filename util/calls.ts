import { Base } from '../util/base';
var fs = require("fs/promises");

const base = new Base();


export class Calls {

    /* GOAL: Get all completed data starting from the last logged and get the net income daily (collected)
    * TODO:
    * 1. Since this call can only pull up to 40 orders, loop this up to the last page
    * 2. Compare it to the already listed items to mark as "COMPLETE"
    * 3. Take note of the time, so it can be filtered by day to get the net income daily
    **/
    public async getCompleted({ request, baseURL }): Promise<any> {
        const res_ = await request.get(baseURL + "/api/v3/order/get_order_id_list?source=completed&page_size=40&page_number=1");
        await fs.writeFile ("./result/completed-items.json", JSON.stringify(await res_.json(),undefined,2), function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );
    }

    //GOAL: Get all to-ship orders to automatically log it on the inventory to get the net incomes daily (uncollected)
    public async getAllToShip({ request, baseURL }): Promise<any> {
        let count = 1;
        let pages, combinedResponses;
        let products = await base.loadJSONData("/stocks/products.json");

        do {
            const res_ = await request.get(baseURL + "/api/v3/order/get_package_list?source=processed&page_number="+count);
            let rspn = await JSON.parse(JSON.stringify(await res_.json()));
            let infos = await rspn.data.package_list.map((x) => ({"order_id": x.order_id, "region_id": "PH", "shop_id": 271248938, order_date: x.order_create_time}));
            
            // slice the response into 10 (this is the only allowable # of data per call)
            let j, resArray=[];
            for (let i = 0, j = infos.length; i < j; i += 10) {
                resArray.push(infos.slice(i, i + 10));
            }

            pages = rspn.data.total/40;
            pages = (pages % 1) !== 0 ? Math.trunc(pages)+1 : Math.trunc(pages);

            // get all the details
            let info, orders;
            for (let x = 0; x<resArray.length; x++) {
                const viewData = await base.processOrderBody(resArray[x]);
                const resDetails = await request.post(baseURL + "/api/v3/order/get_shipment_order_list_by_order_ids_multi_shop", {
                    data: viewData
                });


                
                let total, totalwsf, totalcharges ;
                info = await JSON.parse(JSON.stringify(await resDetails.json()));
                orders = await info.data.orders.map((x) => ({order_id : x.order_id, order_sn : x.order_sn,
                    tracking_num: String(rspn.data.package_list.filter(j => j.order_sn === x.order_sn).map(k => k.third_party_tn)).replace("[", "").replace("]", ""),
                                                    order_date: infos.filter(z => z.order_id === x.order_id)[0].order_date,
                                                    total: total = x.order_items.map(y =>  Number(y.order_price) * y.amount).reduce((total, y) => y+total),
                                                    shipping_fee : Number(x.shipping_fee),
                                                    total_plus_sf : totalwsf = Number(x.order_items.map(y =>  Number(y.order_price) * y.amount).reduce((total, y) => Number(y+total)) + Number(x.shipping_fee)),
                                                    e_charges: totalcharges = Number(Number(totalwsf * 0.01).toFixed()) + 
                                                            Number(Number(totalwsf * 0.0224).toFixed()),
                                                    net : total - totalcharges,
                                                    //order_date: x,
                                                    // order_completed: x,
                                                    buyer_username: x.buyer_user.user_name, buyer_name : x.buyer_address_name, 
                                                    items_count : Object.keys(x.order_items).length,
                                                    order_items: x.order_items.map((y) => ({
                                                        item_id : y.item_id,
                                                        model_id : y.model_id,
                                                        quantity: y.amount, 
                                                        price: Number(y.order_price),
                                                        total: Number(y.order_price) * y.amount,
                                                        charge: Number(((((y.order_price) * y.amount) / Number(total))* totalcharges).toFixed()),
                                                        image: products[y.item_id][y.model_id]["image"]
                                                    }))}));
                combinedResponses = (combinedResponses + await JSON.stringify(await orders,undefined,2)).replace("\n][",",");
            }
            combinedResponses = await combinedResponses.replace("]}[", ",").replace("undefined", "{ \"orders\":") + "}";
            ++count;
            //console.log(combinedResponses);
        } while (count <= pages);

        await fs.writeFile ("./result/to-ship.json", await combinedResponses, async function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );
    }

    public async calcProfit(): Promise<any> {
        let products = await base.loadJSONData("/stocks/products.json");
        let data = [];

        await base.loopJsonData ("/result/to-ship.json", "orders", async function(obj) {
            const date = new Date(obj.order_date* 1e3).toLocaleDateString("en-US");
            const dateNow = date.split(", ")[0].split("/").join("/");
            
            let total=0, resArray={};
            const item = obj.order_items;
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
                order_date : 0+dateNow,
                profit: {
                    total: Number(total.toFixed(2)),
                    ...resArray
                } 
            }));
        });
        
        const processed = base.processOrderBody(data);
        let to_ship = JSON.stringify(await processed,undefined,2).replace(/\]\s*\]\s/, "]").replace(/\[\s*\[\s/, "[\n").replace(/\],\s*\[\s/, ",");
        await fs.writeFile ("./result/to-ship-total.json", to_ship, async function(err) {
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
            //console.log(combinedResponses);
        } while (count <= pages);

        let combinedRes;
        const order_ids = await base.processOrderBody(JSON.parse(combinedResponses));
        const total_order_ids = Object.keys(await order_ids.orders).length;

        // JSON file to be checked
        const info = await base.loadContent("/result/shipping-status.json");

        for (let x = 0; x < total_order_ids; x++) {
            const current_val = Number(Object.values(await order_ids.orders[x]));
            const transDetail = await request.get(baseURL + "/api/v3/finance/income_transaction_history_detail/?order_id=" + String(current_val));
            let info = await JSON.parse(JSON.stringify(await transDetail.json()));
            //console.log(typeof info.data.payment_info.fees_and_charges.transaction_fee);

            const getShippingStatus = await request.get(baseURL + "/api/v3/order/get_forder_logistics?order_id=" + String(current_val));
            let stat = await JSON.parse(JSON.stringify(await getShippingStatus.json()));
            stat = await stat.data.list.map((x) => ({"order_id": x.order_id, "courier" : x.thirdparty_tracking_number, "status": x.status, "status2" : x.channel_status,
                                "subtotal" : info.data.payment_info.merchant_subtotal.product_price,
                                "shipping_fee": info.data.buyer_payment_info.shipping_fee,
                                "charges": Number(info.data.payment_info.fees_and_charges.transaction_fee) + Number(info.data.payment_info.fees_and_charges.commission_fee),
                                "refund" : info.data.payment_info.merchant_subtotal.refund_amount,
                                "net" : info.data.payment_info.merchant_subtotal.product_price - 
                                        (Number(info.data.payment_info.fees_and_charges.transaction_fee) + Number(info.data.payment_info.fees_and_charges.commission_fee))}));

            stat = await JSON.stringify(await stat[0], undefined,2);
            combinedRes = (await combinedRes + await stat).replace("\n}{","\n},\n{");
        }

        await fs.writeFile ("./result/shipping-status.json", await combinedRes.replace("undefined","{ \"orders\" : [") + "\n]\n}", async function(err) {
            if (err) { throw err }
            console.log("complete");
        }    
        );
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
                ++count;
                toAdd.push(await current_to_ship.orders[x]);
            }
        }
        const combined = Object.assign(current_details, {toAdd});
    
        let to_ship = JSON.stringify(await combined,undefined,2).replace(/\s\],\s\s*\"toAdd\": \[\s/, ",\n").replace("\n ,", ",");
        await fs.writeFile ("./db/orders.json", to_ship.replace(/,\s*\"toAdd\": \[\]\s/, "\n"), async function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );

        console.log("\x1b[32m%s\x1b[0m","\tADDED ITEMS: " + count);
    }

    public async cleanUpToShip(): Promise<any> {
        let orders = await base.loadJSONData("/result/to-ship.json");
    
        for (let x=0; x<orders.orders.length; x++) {
            const date = new Date(orders.orders[x].order_date* 1e3).toLocaleDateString("en-US");
                const dateNow = date.split(", ")[0].split("/").join("/");
            
            orders.orders[x].order_date = dateNow;
            delete orders.orders[x].total;
            delete orders.orders[x].shipping_fee;
            delete orders.orders[x].total_plus_sf;
            delete orders.orders[x].e_charges;
            delete orders.orders[x].net;
            const item_count = orders.orders[x].order_items.length;
            for (let y=0; y<item_count; y++){
                delete orders.orders[x].order_items[y]["price"];
                delete orders.orders[x].order_items[y]["total"];
                delete orders.orders[x].order_items[y]["charge"];
            }
        }
        await fs.writeFile ("./result/to-ship.json", JSON.stringify(await orders,undefined,2), async function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );
    }

    public async deleteCancelled({ request, baseURL }): Promise<any> {
        let orders = await base.loadJSONData("/db/orders.json");

        const cancelled_list = await request.get(baseURL + "/api/v3/order/get_order_id_list?source=cancelled_all&page_number=1");
        let rspn = await JSON.parse(JSON.stringify(await cancelled_list.json()));
        
        await fs.writeFile ("./db/cancelled.json", JSON.stringify(await cancelled_list.json(),undefined,2), async function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );


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
        await fs.writeFile ("./db/orders.json", orders, async function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );
    }

    public async getAllCompleted({ request, baseURL }): Promise<any> {
        let completed = await base.loadJSONData("/db/s-completed.json");
        let page = 1;
        let found = false;
        let toAdd = [];
        let count = 0;
        do {
            const res = await request.get(baseURL + "/api/v3/finance/get_wallet_transactions/?wallet_type=0&transaction_types=101,102&page_size=30&page_number="+page);
            let response = await JSON.parse(JSON.stringify(await res.json()));
            const size = response.data.list.length;

            for (let x = 0; x<size; x++) {
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

            page = found === false ? page+1: page;
        } while (found === false);

        const combined = Object.assign(completed, {toAdd});
        const updatedList = JSON.stringify(await combined,undefined,2).replace(/\s\],\s\s*\"toAdd\": \[\s/, ",\n").replace("\n ,", ",");
        await fs.writeFile ("./db/s-completed.json", updatedList.replace(/,\s*\"toAdd\": \[\]\s/, "\n"), async function(err) {
            if (err) throw err;
                console.log('complete');
            }
        );
        console.log("\x1b[32m%s\x1b[0m","\tADDED ITEMS: " + count);
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
                        const new_charges = Math.round(new_e * 0.0224) + Math.round(new_e * 0.01);
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
                if (await shipping.orders.filter(z => z.order_id === expectedOrderCharges.orders[x].order_id).length === 0 &&
                    await to_ship.orders.filter(z => z.order_id === expectedOrderCharges.orders[x].order_id).length === 0 &&
                    await refund.orders.filter(z => z.order_id === expectedOrderCharges.orders[x].order_id).length === 0) {
                    combinedResponses.orders.push({status: "missing", order_id: expectedOrderCharges.orders[x].order_id, e_amount: expectedOrderCharges.orders[x].net});
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
        console.log("\x1b[31m%s\x1b[0m","TOTAL ITEMS WITH ISSUE: " + count);
        console.log("\x1b[31m%s\x1b[0m","TOTAL MISSING AMOUNT: " + await base.pesoFormat(totalDiscrp));
    }
}