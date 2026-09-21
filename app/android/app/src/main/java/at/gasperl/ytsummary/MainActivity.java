package at.gasperl.ytsummary;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Kaltstart über das Teilen-Ziel. Das Share-Plugin wertet nur onNewIntent aus; läuft die
     * App noch nicht, kommt der SEND-Intent aber als Start-Intent und ginge verloren – kein
     * Ereignis, kein Logeintrag, von einem echten Fehlschlag nicht zu unterscheiden (Kimi,
     * 21.09.2026, am Plugin-Quelltext belegt). Deshalb wird er hier einmal nachgereicht; das
     * Plugin hält das Ereignis fest, bis der Listener im WebView steht.
     * Nur beim echten Neustart: nach einer Drehung käme derselbe Intent sonst ein zweites Mal.
     */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent start = getIntent();
        if (savedInstanceState == null && bridge != null && start != null
                && Intent.ACTION_SEND.equals(start.getAction())) {
            onNewIntent(start);
        }
    }
}
