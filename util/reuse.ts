import * as fs from "fs";
import { join } from "path";
import { Base } from '../util/base';

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
                                                e_charges: totalcharges = Number(Number(totalwsf * 0.02).toFixed()) + 
                                                        Number(Number(totalwsf * 0.0224).toFixed()),
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
        let combinedRes;
        const to_ship_total_count = await orders.orders.length;
        for (let x = 0; x < to_ship_total_count; x++) {
            const transDetail = await request.get(baseURL + "/api/v3/finance/income_transaction_history_detail/?order_id=" + orders.orders[x].order_id);
            let info = await JSON.parse(JSON.stringify(await transDetail.json()));
            //console.log(typeof info.data.payment_info.fees_and_charges.transaction_fee);

            const getShippingStatus = await request.get(baseURL + "/api/v3/order/get_forder_logistics?order_id=" + orders.orders[x].order_id);
            let stat = await JSON.parse(JSON.stringify(await getShippingStatus.json()));
            const epoch = stat.data.list[0].ctime;
            const dateNow = base.getDateFromEpoch(epoch);
            // console.log(stat.data);
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