import * as fs from "fs";
import { join } from "path";
import { Base } from '../util/base';
import { global } from "../global";

const normalizer = require("path");


const base = new Base();

export class Reuse {
    public sliceTo10(toSlice: any):  Array<any> {
        let resArray = [];
        for (let i = 0, j = toSlice.length; i < j; i += 10) {
            resArray.push(toSlice.slice(i, i + 10));
        }
        return resArray;
    }

    public async getDealIdsWithIncorrectVal({ request, baseURL }, key:string, value:string): Promise<any> {
        let orders = await base.loadJSONData("/db/orders.json");
        const inc = await orders.orders.filter((x) => x[key] === value).map(x => x.order_id);
        return await inc;
    }

    public async getOrderDate({ request, baseURL }, orderId: any): Promise<any> {
        const res = await request.get(baseURL + "/api/v3/order/get_order_tracking_history/?order_id="+orderId);
        let response = await JSON.parse(JSON.stringify(await res.json()));
        const order_date = response.data.history.filter(x => x.old_status === 0).map(x => x.ctime);
        const gmtDate = await base.getDateFromEpoch(order_date[0]);
        return await gmtDate;
    }

    public async updateDBOrderDetails(orderId: any, keyToUpdate:string, value:string): Promise<any> {
        let orders = await base.loadJSONData("/db/orders.json");
        // console.log(orders.orders[10458]);
        if (await orders.orders.filter(z => z.order_id == orderId).length === 1){
            const index = await orders.orders.findIndex(z => z.order_id == orderId);
            orders.orders[index][keyToUpdate]=value;
        }
        orders = JSON.stringify(orders,undefined,2);
        await base.saveFile("./db/orders.json", orders);
    }

    public async getOrderDetails({ request, baseURL }, resArray: Array<any>, objToGetTrackingNum: any, objToGetOrderDate: any): Promise<any> {
        let info, orders, combinedResponses;
        for (let x = 0; x<resArray.length; x++) {
            const viewData = await base.processOrderBody(resArray[x]);
            const resDetails = await request.post(baseURL + "/api/v3/order/get_shipment_order_list_by_order_ids_multi_shop", {
                data: viewData
            });

            let total, totalwsf, totalcharges ;
            info = await JSON.parse(JSON.stringify(await resDetails.json()));
            orders = await info.data.orders.map((x) => ({order_id : x.order_id, order_sn : x.order_sn, 
                 tracking_num: String(objToGetTrackingNum.filter(j => j.order_id === x.order_id).map(k => k.third_party_tn)).replace("[", "").replace("]", ""),
                                                order_date: objToGetOrderDate.filter(z => z.order_id === x.order_id)[0].order_date,
                                                total: total = x.order_items.map(y =>  Number(y.order_price) * y.amount).reduce((total, y) => y+total),
                                                shipping_fee : Number(x.shipping_fee),
                                                total_plus_sf : totalwsf = Number(x.order_items.map(y =>  Number(y.order_price) * y.amount).reduce((total, y) => Number(y+total)) + Number(x.shipping_fee)),
                                                e_charges: totalcharges = Number(Number(totalwsf * global.comFee).toFixed()) + 
                                                        Number(Number(totalwsf * global.transFee).toFixed()),
                                                net : total - totalcharges,
                                                buyer_username: x.buyer_user.user_name, buyer_name : x.buyer_address_name, 
                                                items_count : Object.keys(x.order_items).length,
                                                isCompleted: false,
                                                order_items: x.order_items.map((y) => ({
                                                    item_id : y.item_id,
                                                    model_id : y.model_id,
                                                    item_name: "",
                                                    quantity: y.amount, 
                                                    price: Number(y.order_price),
                                                    total: Number(y.order_price) * y.amount,
                                                    charge: Number(((((y.order_price) * y.amount) / Number(total))* totalcharges).toFixed()),
                                                    //image: products[y.item_id][y.model_id]["image"]
                                                }))}));
            combinedResponses = (combinedResponses + await JSON.stringify(await orders,undefined,2)).replace("\n][",",");
        }
        combinedResponses = await combinedResponses.replace("]}[", ",").replace("undefined", "");

        return combinedResponses;
    }

    public async getShippingDetails({ request, baseURL }, orders: any, fileName: any): Promise<any> {
        let combinedRes, transDetail, getShippingStatus;
        const to_ship_total_count = await orders.orders.length;
        for (let x = 0; x < to_ship_total_count; x++) {
            // Needs to do while loop becauase sometimes, the initial query gets 502 but upon retrying again, it gets 200
            do {
                let retry=0;
                if (retry >  3) { break; }
                transDetail = await request.get(baseURL + "/api/v3/finance/income_transaction_history_detail/?order_id=" + orders.orders[x].order_id);
                getShippingStatus = await request.get(baseURL + "/api/v3/order/get_forder_logistics?order_id=" + orders.orders[x].order_id);
                retry += 1;
                // console.log (orders.orders[x].order_id + " - " + transDetail.status() + " - " + getShippingStatus.status())
                await delay(2000);
            }while((transDetail.status()==502 || getShippingStatus.status()==502))

            let info = await JSON.parse(JSON.stringify(await transDetail.json()));
            let stat = await JSON.parse(JSON.stringify(await getShippingStatus.json()));
            const epoch = await stat.data.list[0].ctime;
            const dateNow = await base.getDateFromEpoch(epoch);

            // console.log("-----------------------------------------------------------------------------------------------")
            // console.log(JSON.stringify(await getShippingStatus.json()))
            // console.log(JSON.stringify(await transDetail.json()))
            stat = await stat.data.list.map((x) => ({"order_id": x.order_id, "order_sn": x.order_sn,
                                "third_party_tn" : x.thirdparty_tracking_number,
                                "order_date": dateNow,
                                "status": x.status, "status2" : x.channel_status,
                                "subtotal" : info.data.payment_info.merchant_subtotal.product_price,
                                "shipping_fee": info.data.buyer_payment_info.shipping_fee,
                                "charges": Number(info.data.payment_info.fees_and_charges.transaction_fee) + Number(info.data.payment_info.fees_and_charges.commission_fee),
                                "refund" : info.data.payment_info.merchant_subtotal.refund_amount,
                                "net" : info.data.payment_info.merchant_subtotal.product_price - 
                                        (Number(info.data.payment_info.fees_and_charges.transaction_fee) + Number(info.data.payment_info.fees_and_charges.commission_fee))}));
            stat = await JSON.stringify(await stat[0], undefined,2);
            combinedRes = (await combinedRes + await stat).replace("\n}{","\n},\n{");
        }
        await base.saveFile(fileName, await combinedRes.replace("undefined","{ \"orders\" : [") + "\n]\n}");
    }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))