package com.bngss.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web == null) return;

        // เรนเดอร์ด้วย GPU เต็มที่ขณะใช้งาน
        web.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
        WebSettings s = web.getSettings();
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setOffscreenPreRaster(false);

        // ตัวเรนเดอร์ได้ความสำคัญสูงเมื่อแสดงอยู่ แต่ลดลงเมื่อแอปไม่อยู่บนจอ (ประหยัดแบต)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }
    }

    // หยุดตัวจับเวลา/แอนิเมชันของหน้าเว็บเมื่อแอปอยู่เบื้องหลัง — แจ้งเตือนยังมาทาง FCM ตามปกติ
    @Override
    public void onPause() {
        super.onPause();
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web != null) web.pauseTimers();
    }

    @Override
    public void onResume() {
        super.onResume();
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web != null) web.resumeTimers();
    }
}
