package com.shgonzals.garage;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.List;

/**
 * Compra de Garage Pro con Google Play Billing (producto de pago único, sin servidor).
 *
 * - getProduct: precio en la moneda de la cuenta del usuario.
 * - purchase: abre la hoja de pago de Google Play y responde purchased / pending / cancelled / error.
 * - owned: ¿lo tiene comprado esta cuenta? Sirve al abrir la app y para "Restaurar compra".
 *
 * Toda compra se "reconoce" (acknowledge): si no, Google Play la reembolsa a los 3 días.
 */
@CapacitorPlugin(name = "GarageBilling")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient client;
    /** Compra en curso: se responde cuando Google Play avisa en onPurchasesUpdated. */
    private PluginCall purchaseCall;
    private String purchaseProductId;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    /** Conecta con Google Play si hace falta y después ejecuta `onReady`. */
    private void whenReady(PluginCall call, Runnable onReady) {
        if (client.isReady()) {
            onReady.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) onReady.run();
                else call.reject("Google Play no disponible: " + result.getDebugMessage());
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Con enableAutoServiceReconnection la librería reconecta sola en la siguiente llamada.
            }
        });
    }

    private void queryProduct(PluginCall call, String productId, ProductCallback callback) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                Collections.singletonList(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                )
            )
            .build();
        client.queryProductDetailsAsync(params, (result, details) -> {
            List<ProductDetails> list = details.getProductDetailsList();
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || list.isEmpty()) {
                callback.done(null);
            } else {
                callback.done(list.get(0));
            }
        });
    }

    private interface ProductCallback {
        void done(ProductDetails product);
    }

    @PluginMethod
    public void getProduct(PluginCall call) {
        String productId = call.getString("productId");
        whenReady(call, () -> queryProduct(call, productId, (product) -> {
            JSObject ret = new JSObject();
            ProductDetails.OneTimePurchaseOfferDetails offer = product != null ? product.getOneTimePurchaseOfferDetails() : null;
            ret.put("price", offer != null ? offer.getFormattedPrice() : null);
            call.resolve(ret);
        }));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        whenReady(call, () -> queryProduct(call, productId, (product) -> {
            if (product == null) {
                resolveResult(call, "error");
                return;
            }
            BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(
                    Collections.singletonList(
                        BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).build()
                    )
                )
                .build();
            purchaseCall = call;
            purchaseProductId = productId;
            call.setKeepAlive(true);
            getActivity().runOnUiThread(() -> {
                BillingResult result = client.launchBillingFlow(getActivity(), params);
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    finishPurchase(result.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED ? "purchased" : "error");
                }
            });
        }));
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            String outcome = "error";
            for (Purchase purchase : purchases) {
                if (!purchase.getProducts().contains(purchaseProductId)) continue;
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    acknowledge(purchase);
                    outcome = "purchased";
                } else if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    outcome = "pending";
                }
            }
            finishPurchase(outcome);
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            finishPurchase("cancelled");
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            finishPurchase("purchased");
        } else {
            finishPurchase("error");
        }
    }

    private void finishPurchase(String outcome) {
        if (purchaseCall == null) return;
        PluginCall call = purchaseCall;
        purchaseCall = null;
        call.setKeepAlive(false);
        resolveResult(call, outcome);
    }

    private void resolveResult(PluginCall call, String outcome) {
        JSObject ret = new JSObject();
        ret.put("result", outcome);
        call.resolve(ret);
    }

    @PluginMethod
    public void owned(PluginCall call) {
        String productId = call.getString("productId");
        whenReady(call, () -> client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("No se pudieron consultar las compras: " + result.getDebugMessage());
                    return;
                }
                boolean owned = false;
                for (Purchase purchase : purchases) {
                    if (purchase.getProducts().contains(productId) && purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                        owned = true;
                        // Una compra pendiente que se completó con la app cerrada aún no está reconocida.
                        acknowledge(purchase);
                    }
                }
                JSObject ret = new JSObject();
                ret.put("owned", owned);
                call.resolve(ret);
            }
        ));
    }

    private void acknowledge(Purchase purchase) {
        if (purchase.isAcknowledged()) return;
        client.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(),
            (result) -> {}
        );
    }
}
