package com.aybad.passforge;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** "Save as…": the system file picker lets the user choose where to store the file on the phone. */
@CapacitorPlugin(name = "SaveAs")
public class SaveAsPlugin extends Plugin {
    private File pending() { return new File(getContext().getCacheDir(), "passforge-save-as.tmp"); }

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name", "passforge-export.pfg");
        String mime = call.getString("mime", "application/octet-stream");
        String data = call.getString("data");
        if (data == null) {
            call.reject("no data");
            return;
        }
        try (FileOutputStream fo = new FileOutputStream(pending())) {
            fo.write(Base64.decode(data, Base64.DEFAULT));
        } catch (Exception e) {
            call.reject("tmp: " + e.getMessage());
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "onPicked");
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            ret.put("saved", false);
            call.resolve(ret);
            return;
        }
        Uri uri = result.getData().getData();
        File tmp = pending();
        try (InputStream in = new FileInputStream(tmp); OutputStream os = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (os == null) throw new Exception("cannot write");
            byte[] buf = new byte[65536];
            int n;
            long total = 0;
            while ((n = in.read(buf)) > 0) { os.write(buf, 0, n); total += n; }
            os.flush();
            if (total == 0) throw new Exception("empty");
            tmp.delete();
            ret.put("saved", true);
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
