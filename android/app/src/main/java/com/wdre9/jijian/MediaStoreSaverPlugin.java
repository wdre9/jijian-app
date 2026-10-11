package com.wdre9.jijian;

import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * 通过 MediaStore 把文件写入公共「文档」目录（仅 Android）。
 * Android 10（API 29）及以上无需任何存储权限，文件管理器立即可见——
 * 这是 Android 11+ 分区存储下导出文件到公共目录的唯一免权限正解
 * （Capacitor Filesystem 直写公共 Documents/Downloads 在 Android 11+ 必须
 * 有「所有文件访问权限」，否则只能落到文件管理器不可见的应用私有目录）。
 * Android 9 及以下不支持 RELATIVE_PATH，插件拒绝后由 JS 侧走 Filesystem 降级链。
 */
@CapacitorPlugin(name = "MediaStoreSaver")
public class MediaStoreSaverPlugin extends Plugin {

    @PluginMethod
    public void saveToDocuments(PluginCall call) {
        String base64 = call.getString("base64");
        String filename = call.getString("filename");
        String mime = call.getString("mimeType", "application/octet-stream");
        String subdir = call.getString("subdir", "jijian-exports");

        if (base64 == null || filename == null) {
            call.reject("缺少 base64 或 filename 参数");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            // Android 9 及以下没有 RELATIVE_PATH，交给 JS 侧走 Filesystem 降级链
            call.reject("UNSUPPORTED: Android 10 以下不支持 MediaStore 相对路径写入");
            return;
        }

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Uri collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);

            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOCUMENTS + "/" + subdir);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            Uri itemUri = getContext().getContentResolver().insert(collection, values);
            if (itemUri == null) {
                call.reject("写入失败：无法创建媒体库条目");
                return;
            }

            try (OutputStream out = getContext().getContentResolver().openOutputStream(itemUri)) {
                if (out == null) {
                    call.reject("写入失败：无法打开输出流");
                    return;
                }
                out.write(bytes);
                out.flush();
            }

            // 写完解除 pending，文件才对其他应用（文件管理器）可见
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            getContext().getContentResolver().update(itemUri, done, null, null);

            JSObject ret = new JSObject();
            ret.put("uri", itemUri.toString());
            ret.put("display", "文件管理 → 文档 → " + subdir + "/" + filename);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("写入公共文档失败: " + e.getMessage(), e);
        }
    }

    /** 滚动清理：只保留指定目录下指定前缀的最新 maxFiles 个文件（供自动备份用）。
     *  应用删除自己创建的文件无需任何权限。清理失败不报错，不影响备份主流程。 */
    @PluginMethod
    public void pruneDir(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.resolve();
            return;
        }
        String subdir = call.getString("subdir");
        String prefix = call.getString("prefix", "");
        int maxFiles = call.getInt("maxFiles", 14);
        if (subdir == null) {
            call.reject("缺少 subdir 参数");
            return;
        }
        try {
            Uri collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            String relPath = Environment.DIRECTORY_DOCUMENTS + "/" + subdir + "/";
            String selection = MediaStore.MediaColumns.RELATIVE_PATH + "=? AND "
                    + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?";
            String[] args = new String[]{relPath, prefix + "%"};

            List<Uri> uris = new ArrayList<>();
            try (Cursor cursor = getContext().getContentResolver().query(collection,
                    new String[]{MediaStore.MediaColumns._ID},
                    selection, args, MediaStore.MediaColumns.DATE_ADDED + " ASC")) {
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        uris.add(ContentUris.withAppendedId(collection, cursor.getLong(0)));
                    }
                }
            }
            int excess = uris.size() - maxFiles;
            for (int i = 0; i < excess; i++) {
                getContext().getContentResolver().delete(uris.get(i), null, null);
            }
            call.resolve();
        } catch (Exception e) {
            // 清理失败不影响主流程
            call.resolve();
        }
    }
}
