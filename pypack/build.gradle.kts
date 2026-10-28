// v8.7 (P7, Ali agreed): Python for Code (Pyodide, 26 MB) is downloaded the first time it is needed in the Play Store build —
// Play Asset Delivery's on-demand pack. The Play workflow step moves app/src/main/assets/www/py into src/main/assets/py before
// `bundlePlayRelease`; the README keeps the pack from ever being empty (a bundle refuses an empty pack).
plugins { id("com.android.asset-pack") }
assetPack {
    packName.set("pypack")
    dynamicDelivery { deliveryType.set("on-demand") }
}
