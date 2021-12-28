import test from '@playwright/test';
var fs = require("fs");

test("Quick Summary", async ({ request, baseURL }) => {
    const res_ = await request.post(baseURL + "/api/v3/order/get_shipment_meta_multi_shop", {
        data: {
            "orders": [
                {
                    "shop_id": 271248938,
                    "region_id": "PH"
                }
            ]
        }
    });
    
    await fs.writeFile ("./result/quick-summary.json", JSON.stringify(await res_.json(),undefined,2), function(err) {
        if (err) throw err;
            console.log('complete');
        }
    );
})