package dev.lichium.garage;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Widget de escritorio: las tareas más urgentes y un botón de registro rápido.
 *
 * No calcula nada: pinta lo último que le pasó la app (WidgetPlugin), con los textos ya
 * traducidos. Tocar una fila abre ese vehículo; el botón, el registro rápido; el resto,
 * los recordatorios. Las rutas viajan como enlaces garage://open/... que la app atiende.
 */
public class GarageWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "garage_widget";
    static final String KEY_DATA = "data";

    private static final int[] ROWS = { R.id.row1, R.id.row2, R.id.row3 };
    private static final int[] DOTS = { R.id.row1_dot, R.id.row2_dot, R.id.row3_dot };
    private static final int[] TITLES = { R.id.row1_title, R.id.row2_title, R.id.row3_title };
    private static final int[] SUBTITLES = { R.id.row1_subtitle, R.id.row2_subtitle, R.id.row3_subtitle };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    /** Redibuja todos los widgets colocados (tras recibir datos nuevos de la app). */
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, GarageWidgetProvider.class));
        if (ids.length == 0) return;
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_garage);
        JSONObject data = read(context);
        JSONArray items = data != null ? data.optJSONArray("items") : null;
        int count = items != null ? Math.min(items.length(), ROWS.length) : 0;

        // Fuera de las filas: recordatorios (o la pantalla de Garage Pro si el widget está bloqueado).
        String rootRoute = data != null ? data.optString("open", "/tabs/reminders") : "/tabs/reminders";
        views.setOnClickPendingIntent(R.id.widget_root, open(context, rootRoute, 0));
        views.setOnClickPendingIntent(R.id.quick_log, open(context, "/log", 1));

        // Sin texto, el botón de registro rápido se oculta (widget bloqueado).
        String quickLog = data != null ? data.optString("quickLog") : null;
        if (quickLog != null) views.setTextViewText(R.id.quick_log, quickLog);
        views.setViewVisibility(R.id.quick_log, quickLog != null && quickLog.isEmpty() ? View.GONE : View.VISIBLE);
        String empty = data != null ? data.optString("empty") : context.getString(R.string.widget_open_app);
        views.setTextViewText(R.id.empty, empty);
        views.setViewVisibility(R.id.empty, count == 0 ? View.VISIBLE : View.GONE);

        for (int i = 0; i < ROWS.length; i++) {
            if (i >= count) {
                views.setViewVisibility(ROWS[i], View.GONE);
                continue;
            }
            JSONObject item = items.optJSONObject(i);
            views.setViewVisibility(ROWS[i], View.VISIBLE);
            views.setTextViewText(TITLES[i], item.optString("title"));
            views.setTextViewText(SUBTITLES[i], item.optString("subtitle"));
            views.setTextColor(DOTS[i], toneColor(item.optString("tone")));
            views.setOnClickPendingIntent(ROWS[i], open(context, "/vehicles/" + item.optString("vehicleId"), 10 + i));
        }
        return views;
    }

    private static JSONObject read(Context context) {
        String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, null);
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (JSONException e) {
            return null;
        }
    }

    /** Mismos colores que los testigos de la app (rojo vencido, ámbar pronto, verde al día). */
    private static int toneColor(String tone) {
        switch (tone) {
            case "danger":
                return Color.parseColor("#E5484D");
            case "warning":
                return Color.parseColor("#F5A524");
            case "success":
                return Color.parseColor("#30A46C");
            default:
                return Color.parseColor("#9AA1A9");
        }
    }

    /** Abre la app en esa ruta. `requestCode` distinto por destino: si no, Android reutiliza el mismo intent. */
    private static PendingIntent open(Context context, String route, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("garage://open" + route), context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
