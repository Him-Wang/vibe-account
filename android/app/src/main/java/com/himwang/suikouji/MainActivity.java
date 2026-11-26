package com.himwang.suikouji;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void load() {
        // Register the on-device cutout plugin before the bridge is built, so
        // the JS `registerPlugin("CutoutPlugin")` call resolves to our native code.
        registerPlugin(CutoutPlugin.class);
        super.load();
    }
}
