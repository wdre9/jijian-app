package com.wdre9.jijian;

import android.content.Context;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import java.io.File;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "JijianMainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册本地 MediaStore 导出插件（必须在 super.onCreate 之前）
        registerPlugin(MediaStoreSaverPlugin.class);
        // 覆盖安装后 WebView 数据目录（app_webview）会被保留，旧 Service Worker
        // 及其缓存会接管首次加载，导致 v1.2.6 的新代码根本不执行（导出仍走旧逻辑、
        // 首次进入点不动）。在 super.onCreate 之前只清理 "Service Worker" 子目录，
        // 严禁删除 app_webview 整体，否则会清掉 localStorage/IndexedDB 用户数据。
        clearWebViewServiceWorkerData();
        super.onCreate(savedInstanceState);
    }

    private void clearWebViewServiceWorkerData() {
        try {
            File webViewDir = getDir("app_webview", Context.MODE_PRIVATE);
            if (webViewDir == null) {
                Log.w(TAG, "app_webview dir is null");
                return;
            }
            File swDir = new File(webViewDir, "Service Worker");
            if (swDir.exists()) {
                deleteRecursive(swDir);
                Log.i(TAG, "Cleared WebView Service Worker data: " + swDir.getAbsolutePath());
            } else {
                Log.i(TAG, "No Service Worker dir: " + swDir.getAbsolutePath());
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to clear Service Worker data", e);
        }
    }

    private void deleteRecursive(File file) {
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteRecursive(child);
            }
        }
        if (file.delete()) {
            Log.d(TAG, "deleted: " + file.getAbsolutePath());
        } else {
            Log.w(TAG, "delete failed: " + file.getAbsolutePath());
        }
    }
}
