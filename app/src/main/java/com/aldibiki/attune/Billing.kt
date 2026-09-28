package com.aldibiki.attune

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONArray
import org.json.JSONObject

/**
 * v6.7 — Ali: "I want Google Play … easy, automated, no effort for me or the customer".
 * Google Play Billing: Pro monthly / yearly (subscriptions), Pro lifetime (one-time), and Business
 * activation (one-time, bought again for each system — consumed once the system is activated).
 * Google charges (card or Vodafone / Orange / Etisalat balance), renews, refunds and pays out; the
 * phone asks Play what is owned, which works offline from Play's own cache.
 * Every purchase is acknowledged (Play refunds unacknowledged purchases after 3 days).
 */
class Billing(private val ctx: Context) {
    companion object {
        val SUBS = setOf("attune_pro_monthly", "attune_pro_yearly")
        val INAPP = setOf("attune_pro_lifetime", "attune_business_system")
        const val CONSUMABLE = "attune_business_system"
    }

    var activity: Activity? = null
    private var client: BillingClient? = null
    private var waiting: ((JSONObject) -> Unit)? = null   // the purchase the user is in the middle of
    private val details = HashMap<String, ProductDetails>()

    private fun purchaseJson(p: Purchase) = JSONObject()
        .put("products", JSONArray(p.products)).put("productId", p.products.firstOrNull() ?: "")
        .put("purchased", p.purchaseState == Purchase.PurchaseState.PURCHASED)
        .put("pending", p.purchaseState == Purchase.PurchaseState.PENDING)
        .put("token", p.purchaseToken).put("orderId", p.orderId ?: "").put("time", p.purchaseTime)
        .put("autoRenewing", p.isAutoRenewing)

    private fun acknowledge(p: Purchase) {
        if (p.purchaseState != Purchase.PurchaseState.PURCHASED || p.isAcknowledged) return
        if (p.products.contains(CONSUMABLE)) return          // consumed (which acknowledges) after the system is activated
        client?.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.purchaseToken).build()) { }
    }

    private fun onPurchases(r: BillingResult, list: List<Purchase>?) {
        list?.forEach { acknowledge(it) }
        val done = waiting ?: return
        waiting = null
        when (r.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                val p = list?.firstOrNull()
                if (p == null) done(JSONObject().put("ok", false).put("reason", "nothing bought"))
                else if (p.purchaseState == Purchase.PurchaseState.PENDING) done(JSONObject().put("ok", false).put("pending", true).put("purchase", purchaseJson(p)))
                else done(JSONObject().put("ok", true).put("purchase", purchaseJson(p)).put("productId", p.products.firstOrNull() ?: ""))
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> done(JSONObject().put("ok", false).put("reason", "cancelled"))
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> done(JSONObject().put("ok", true).put("already", true))
            else -> done(JSONObject().put("ok", false).put("reason", r.debugMessage.ifEmpty { "Play error ${r.responseCode}" }))
        }
    }

    /** Connects once; `then` runs when Play is ready (or with an error text). */
    private fun ready(then: (String?) -> Unit) {
        val c = client
        if (c != null && c.isReady) return then(null)
        val nc = c ?: BillingClient.newBuilder(ctx)
            .setListener { r, l -> onPurchases(r, l) }
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build().also { client = it }
        nc.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(r: BillingResult) {
                then(if (r.responseCode == BillingClient.BillingResponseCode.OK) null else (r.debugMessage.ifEmpty { "Google Play billing isn't available on this phone" }))
            }
            override fun onBillingServiceDisconnected() { }
        })
    }

    /** Local prices from Play for every product: {items: [{id, price, period}]}. */
    fun products(done: (JSONObject) -> Unit) = ready { err ->
        if (err != null) return@ready done(JSONObject().put("error", err).put("items", JSONArray()))
        val out = JSONArray()
        fun q(ids: Set<String>, type: String, next: () -> Unit) {
            val params = QueryProductDetailsParams.newBuilder().setProductList(ids.map {
                QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(type).build() }).build()
            client!!.queryProductDetailsAsync(params) { _, list ->
                for (d in list) {
                    details[d.productId] = d
                    val price = if (type == ProductType.SUBS) d.subscriptionOfferDetails?.firstOrNull()?.pricingPhases?.pricingPhaseList?.lastOrNull()?.formattedPrice
                        else d.oneTimePurchaseOfferDetails?.formattedPrice
                    out.put(JSONObject().put("id", d.productId).put("price", price ?: "").put("title", d.name))
                }
                next()
            }
        }
        q(SUBS, ProductType.SUBS) { q(INAPP, ProductType.INAPP) { done(JSONObject().put("items", out)) } }
    }

    /** Play's own purchase sheet for one product. */
    fun buy(id: String, done: (JSONObject) -> Unit) = ready { err ->
        if (err != null) return@ready done(JSONObject().put("ok", false).put("reason", err))
        val start = start@{
            val d = details[id] ?: return@start done(JSONObject().put("ok", false).put("reason", "This product isn't set up in Google Play yet."))
            val a = activity ?: return@start done(JSONObject().put("ok", false).put("reason", "no screen"))
            val pp = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d)
            if (id in SUBS) {
                val offers = d.subscriptionOfferDetails
                val token = offers?.firstOrNull()?.offerToken ?: return@start done(JSONObject().put("ok", false).put("reason", "no subscription plan in Play"))
                pp.setOfferToken(token)
            }
            waiting = done
            a.runOnUiThread {
                val r = client!!.launchBillingFlow(a, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(pp.build())).build())
                if (r.responseCode != BillingClient.BillingResponseCode.OK) { waiting = null; done(JSONObject().put("ok", false).put("reason", r.debugMessage.ifEmpty { "Play error ${r.responseCode}" })) }
            }
        }
        if (details.containsKey(id)) start() else products { start() }
    }

    /** Everything this Google account owns now (active subscriptions, lifetime, unused Business). */
    fun owned(done: (JSONObject) -> Unit) = ready { err ->
        if (err != null) return@ready done(JSONObject().put("error", err).put("items", JSONArray()))
        val out = JSONArray()
        client!!.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.SUBS).build()) { _, subs ->
            subs.forEach { acknowledge(it); out.put(purchaseJson(it)) }
            client!!.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build()) { _, inapp ->
                inapp.forEach { acknowledge(it); out.put(purchaseJson(it)) }
                done(JSONObject().put("items", out))
            }
        }
    }

    /** A Business purchase has activated a system: used up, so the next system can be bought. */
    fun consume(token: String, done: (JSONObject) -> Unit) = ready { err ->
        if (err != null) return@ready done(JSONObject().put("ok", false).put("reason", err))
        client!!.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build()) { r, _ ->
            done(JSONObject().put("ok", r.responseCode == BillingClient.BillingResponseCode.OK))
        }
    }
}
