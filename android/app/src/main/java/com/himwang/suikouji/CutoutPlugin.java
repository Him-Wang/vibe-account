package com.himwang.suikouji;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.FloatBuffer;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;

/**
 * On-device background removal for the Android app. The ONNX model is bundled
 * in assets/models/u2netp.onnx, so there is NO network download at runtime.
 * Web users keep using the WASM/transformers.js pipeline instead.
 */
@CapacitorPlugin(name = "CutoutPlugin")
public class CutoutPlugin extends Plugin {
    private static final String TAG = "CutoutPlugin";
    private static final String MODEL_ASSET = "models/u2netp.onnx";
    private static final long MODEL_SIZE = 4574861L;
    private static final int SIZE = 320;
    private static final float[] MEAN = {0.485f, 0.456f, 0.406f};
    private static final float[] STD = {0.229f, 0.224f, 0.225f};

    private volatile OrtEnvironment env;
    private volatile OrtSession session;

    private OrtSession getSession() throws Exception {
        OrtSession s = session;
        if (s != null) return s;
        synchronized (this) {
            if (session != null) return session;
            File model = new File(getContext().getFilesDir(), "u2netp.onnx");
            if (!model.exists() || model.length() != MODEL_SIZE) {
                try (InputStream in = getContext().getAssets().open(MODEL_ASSET);
                     FileOutputStream out = new FileOutputStream(model)) {
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
            }
            env = OrtEnvironment.getEnvironment();
            OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
            opts.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
            int threads = Math.max(1, Runtime.getRuntime().availableProcessors() - 1);
            opts.setIntraOpNumThreads(threads);
            // CPU is the compatible default; NNAPI is skipped on purpose because
            // transformer-style models partition very poorly on it.
            session = env.createSession(model.getAbsolutePath(), opts);
            Log.i(TAG, "Cutout model loaded (u2netp, bundled)");
            return session;
        }
    }

    @PluginMethod
    public void cutout(PluginCall call) {
        String dataUrl = call.getString("image");
        if (dataUrl == null || dataUrl.isEmpty()) {
            call.reject("image data URL required");
            return;
        }
        try {
            String base64 = dataUrl.contains(",") ? dataUrl.substring(dataUrl.indexOf(',') + 1) : dataUrl;
            byte[] raw = Base64.decode(base64, Base64.DEFAULT);
            Bitmap src = BitmapFactory.decodeByteArray(raw, 0, raw.length);
            if (src == null) {
                call.reject("invalid image data");
                return;
            }

            OrtSession s = getSession();
            Bitmap sq = Bitmap.createScaledBitmap(src, SIZE, SIZE, true); // stretch, never letterbox
            int[] pixels = new int[SIZE * SIZE];
            sq.getPixels(pixels, 0, SIZE, 0, 0, SIZE, SIZE);
            int n = SIZE * SIZE;
            float[] input = new float[3 * n];
            for (int i = 0; i < n; i++) {
                int c = pixels[i];
                float r = ((c >> 16) & 0xff) / 255f;
                float g = ((c >> 8) & 0xff) / 255f;
                float b = (c & 0xff) / 255f;
                input[i] = (r - MEAN[0]) / STD[0];
                input[n + i] = (g - MEAN[1]) / STD[1];
                input[2 * n + i] = (b - MEAN[2]) / STD[2];
            }

            float[] logits;
            try (OnnxTensor tensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(input),
                    new long[]{1, 3, SIZE, SIZE});
                 OrtSession.Result results = s.run(java.util.Collections.singletonMap(s.getInputNames().iterator().next(), tensor))) {
                // ORT Java returns a nested array for a [1,1,320,320] tensor.
                // Drill down to the innermost float[] regardless of rank.
                Object value = results.get(0).getValue();
                while (value instanceof Object[] arr) {
                    value = arr.length > 0 ? arr[0] : null;
                    if (value == null) throw new IllegalStateException("empty model output");
                }
                if (!(value instanceof float[] flat)) {
                    throw new IllegalStateException("unexpected model output: " + value.getClass());
                }
                logits = new float[n];
                System.arraycopy(flat, 0, logits, 0, Math.min(n, flat.length));
            }

            float lo = Float.MAX_VALUE, hi = -Float.MAX_VALUE;
            for (float v : logits) {
                if (v < lo) lo = v;
                if (v > hi) hi = v;
            }
            float span = Math.max(hi - lo, 1e-6f);

            int[] outPixels = new int[n];
            for (int i = 0; i < n; i++) {
                int x = i % SIZE;
                int y = i / SIZE;
                int sx = x * src.getWidth() / SIZE;
                int sy = y * src.getHeight() / SIZE;
                int alpha = Math.round(((logits[i] - lo) / span) * 255f);
                alpha = Math.max(0, Math.min(255, alpha));
                outPixels[i] = (alpha << 24) | (src.getPixel(sx, sy) & 0x00ffffff);
            }
            Bitmap mask = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
            mask.setPixels(outPixels, 0, SIZE, 0, 0, SIZE, SIZE);
            Bitmap full = Bitmap.createScaledBitmap(mask, src.getWidth(), src.getHeight(), true);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            full.compress(Bitmap.CompressFormat.PNG, 100, bos);
            String result = "data:image/png;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
            JSObject ret = new JSObject();
            ret.put("image", result);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "cutout failed", e);
            call.reject("cutout failed: " + e.getMessage(), e);
        }
    }
}
