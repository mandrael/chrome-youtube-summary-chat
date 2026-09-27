package at.gasperl.ytsummary;

import com.getcapacitor.BridgeActivity;

/*
 * Bewusst leer. Den Kaltstart über das Teilen-Ziel deckt Capacitor selbst ab:
 * BridgeActivity.load() ruft onNewIntent(getIntent()), das Share-Plugin bekommt den
 * Start-Intent also wie jeden späteren. Eine eigene Weiterleitung hier lieferte das
 * Ereignis doppelt – Capacitor hält Ereignisse ohne Zuhörer als Liste fest
 * (Plugin.notifyListeners, @capacitor/android 8.5.2). Nachgelesen am 27.09.2026.
 */
public class MainActivity extends BridgeActivity {}
