package com.orbique.fms.staff;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Orbique FMS staff app demo: a full-screen shell around the staff web app, with phone notifications. */
public class MainActivity extends Activity {
  static final String HOST = "staff-preview.orbiquefms.com";
  static final String BASE = "https://" + HOST + "/m/?co=kilat&shell=android";
  static final String CHANNEL = "fms-events";
  WebView web;
  volatile boolean inFront = false;
  int nextId = 1;

  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel ch = new NotificationChannel(CHANNEL, "Bookings, chats and payments", NotificationManager.IMPORTANCE_HIGH);
      getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
    }
    web = new WebView(this);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setUserAgentString(s.getUserAgentString() + " FMSAndroid/0.1");
    web.addJavascriptInterface(new Bridge(), "FMSAndroid");
    web.setWebChromeClient(new WebChromeClient());
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { }
        return true;
      }
    });
    setContentView(web);
    String link = getIntent() != null ? getIntent().getStringExtra("link") : null;
    if (state != null) web.restoreState(state); else web.loadUrl(BASE + (link != null ? link : ""));
  }

  @Override protected void onNewIntent(Intent i) {
    super.onNewIntent(i);
    String link = i.getStringExtra("link");
    if (link != null && link.startsWith("#")) web.evaluateJavascript("location.hash=" + quote(link), null);
  }
  @Override protected void onResume() { super.onResume(); inFront = true; }
  @Override protected void onPause() { super.onPause(); inFront = false; }
  @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
  @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

  static String quote(String s) { return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"; }

  class Bridge {
    /** True while the app is on screen, so the page can show its own banner instead. */
    @JavascriptInterface public boolean inFront() { return inFront; }
    @JavascriptInterface public boolean canNotify() {
      return Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }
    @JavascriptInterface public void askPermission() {
      if (Build.VERSION.SDK_INT >= 33) runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1));
    }
    /** Shows a phone notification; tapping it opens the app at the given screen (#booking/..., #chat/...). */
    @JavascriptInterface public void notify(String title, String body, String link) {
      if (!canNotify()) return;
      Intent open = new Intent(MainActivity.this, MainActivity.class).putExtra("link", link).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
      int id = nextId++;
      PendingIntent pi = PendingIntent.getActivity(MainActivity.this, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(MainActivity.this, CHANNEL) : new Notification.Builder(MainActivity.this);
      b.setSmallIcon(android.R.drawable.stat_notify_chat).setContentTitle(title).setContentText(body)
        .setStyle(new Notification.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(pi);
      if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
      getSystemService(NotificationManager.class).notify(id, b.build());
    }
  }
}
