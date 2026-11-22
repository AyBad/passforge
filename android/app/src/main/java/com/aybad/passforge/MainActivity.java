package com.aybad.passforge;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SaveAsPlugin.class);
        registerPlugin(BioVaultPlugin.class);
        super.onCreate(savedInstanceState);
        // no screenshots, no screen recording and a blank preview in "recent apps": passwords are never captured
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    }
}
