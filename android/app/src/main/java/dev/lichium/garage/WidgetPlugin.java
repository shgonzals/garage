package dev.lichium.garage;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Recibe de la app lo que pinta el widget (JSON, ver src/domain/widget.ts) y lo redibuja. */
@CapacitorPlugin(name = "GarageWidget")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Falta data");
            return;
        }
        Context context = getContext();
        context
            .getSharedPreferences(GarageWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(GarageWidgetProvider.KEY_DATA, data)
            .apply();
        GarageWidgetProvider.updateAll(context);
        call.resolve();
    }
}
