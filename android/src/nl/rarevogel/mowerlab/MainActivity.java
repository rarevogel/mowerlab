package nl.rarevogel.mowerlab;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;
import java.io.OutputStream;
import org.json.JSONObject;

/**
 * Mower Lab: a WebView with the page from the assets (served as https://mowerlab.local/).
 * De pagina haalt zelf het weer op bij Open-Meteo. Deze klasse regelt alleen wat een WebView niet zelf kan:
 * een bestand kiezen (import), een bestand opslaan (export/reservekopie) en de kleur van de systeembalken.
 */
public class MainActivity extends Activity {
    private static final String HOST = "https://mowerlab.local/";
    private static final int KIES_BESTAND = 1, BEWAAR_BESTAND = 2;
    private WebView web;
    private ValueCallback<Uri[]> bestandTerug;
    private byte[] teBewaren;
    private String teBewarenNaam;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(getResources().getColor(R.color.achtergrond, getTheme()));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Brug(), "MowerApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                if (!url.startsWith(HOST)) return null;
                String pad = Uri.parse(url).getPath();
                if (pad == null || pad.equals("/") || pad.isEmpty()) pad = "/index.html";
                try {
                    InputStream in = getAssets().open(pad.substring(1));
                    return new WebResourceResponse(pad.endsWith(".html") ? "text/html" : "application/octet-stream", "UTF-8", in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "UTF-8", null);
                }
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith(HOST)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { /* geen browser */ }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> terug, FileChooserParams p) {
                if (bestandTerug != null) bestandTerug.onReceiveValue(null);
                bestandTerug = terug;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.ms-excel", "application/vnd.oasis.opendocument.spreadsheet",
                    "text/csv", "text/comma-separated-values", "text/plain", "application/json", "application/octet-stream" });
                try {
                    startActivityForResult(i, KIES_BESTAND);
                } catch (Exception e) {
                    bestandTerug = null;
                    return false;
                }
                return true;
            }
        });

        // Android 15 tekent achter de systeembalken: houd de pagina daar vrij
        web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            @SuppressWarnings("deprecation")
            public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
                v.setPadding(in.getSystemWindowInsetLeft(), in.getSystemWindowInsetTop(),
                        in.getSystemWindowInsetRight(), in.getSystemWindowInsetBottom());
                return in;
            }
        });

        setContentView(web);
        if (state != null) web.restoreState(state);
        else web.loadUrl(HOST + "index.html");
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code == KIES_BESTAND) {
            Uri[] r = null;
            if (result == RESULT_OK && data != null && data.getData() != null) r = new Uri[] { data.getData() };
            if (bestandTerug != null) bestandTerug.onReceiveValue(r);
            bestandTerug = null;
        } else if (code == BEWAAR_BESTAND) {
            boolean ok = false;
            if (result == RESULT_OK && data != null && data.getData() != null && teBewaren != null) {
                try {
                    OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt");
                    out.write(teBewaren);
                    out.close();
                    ok = true;
                } catch (Exception e) { ok = false; }
            }
            web.evaluateJavascript("window.__bestandOpgeslagen && __bestandOpgeslagen(" + ok + "," + JSONObject.quote(teBewarenNaam == null ? "" : teBewarenNaam) + ")", null);
            teBewaren = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // the page decides (cancel a shape, go back to the Garden tab); otherwise the app closes
        web.evaluateJavascript("window.__terug ? String(__terug()) : 'false'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (v == null || !v.contains("true")) finish();
            }
        });
    }

    /** Bereikbaar vanuit de pagina als window.MowerApp. */
    private class Brug {
        @JavascriptInterface
        public void saveFile(final String naam, final String mime, final String base64) {
            runOnUiThread(new Runnable() { public void run() {
                try {
                    teBewaren = Base64.decode(base64, Base64.DEFAULT);
                    teBewarenNaam = naam;
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(mime);
                    i.putExtra(Intent.EXTRA_TITLE, naam);
                    startActivityForResult(i, BEWAAR_BESTAND);
                } catch (Exception e) {
                    web.evaluateJavascript("window.__bestandOpgeslagen && __bestandOpgeslagen(false,'')", null);
                }
            } });
        }

        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void setDark(final boolean donker, final String kleur) {
            runOnUiThread(new Runnable() { public void run() {
                try {
                    int c = Color.parseColor(kleur.trim());
                    getWindow().setStatusBarColor(c);
                    getWindow().setNavigationBarColor(c);
                    web.setBackgroundColor(c);
                    View d = getWindow().getDecorView();
                    int f = d.getSystemUiVisibility();
                    if (donker) f &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; else f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    if (android.os.Build.VERSION.SDK_INT >= 26) {
                        if (donker) f &= ~0x10; else f |= 0x10; // SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                    }
                    d.setSystemUiVisibility(f);
                } catch (Exception e) { /* ongeldige kleur */ }
            } });
        }
    }
}
