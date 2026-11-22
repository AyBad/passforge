package com.aybad.passforge;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Fingerprint / face unlock (strong biometrics only).
 * The PIN is encrypted with an AES key kept in the Android Keystore; the key can only be used after a
 * successful biometric check, and it is destroyed by Android when a new fingerprint/face is enrolled.
 */
@CapacitorPlugin(name = "BioVault")
public class BioVaultPlugin extends Plugin {
    private static final String ALIAS = "passforge_bio_key";
    private static final String PREFS = "passforge_bio";
    private static final int AUTH = BiometricManager.Authenticators.BIOMETRIC_STRONG;

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    @PluginMethod
    public void status(PluginCall call) {
        int r = BiometricManager.from(getContext()).canAuthenticate(AUTH);
        JSObject ret = new JSObject();
        ret.put("available", r == BiometricManager.BIOMETRIC_SUCCESS);
        ret.put("noneEnrolled", r == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED);
        ret.put("hardware", r != BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE && r != BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE && r != BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED);
        ret.put("enrolled", prefs().contains("ct"));
        call.resolve(ret);
    }

    private SecretKey newKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) b.setInvalidatedByBiometricEnrollment(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) b.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(b.build());
        return kg.generateKey();
    }

    private SecretKey existingKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        return (SecretKey) ks.getKey(ALIAS, null);
    }

    private void clear() {
        prefs().edit().clear().apply();
        try { KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null); if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS); } catch (Exception ignored) { }
    }

    @PluginMethod
    public void remove(PluginCall call) { clear(); call.resolve(); }

    @PluginMethod
    public void enroll(PluginCall call) {
        String secret = call.getString("secret");
        if (secret == null) { call.reject("no secret"); return; }
        Cipher cipher;
        try {
            cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, newKey());
        } catch (Exception e) { call.reject("key: " + e.getMessage(), "error"); return; }
        prompt(call, cipher, (c) -> {
            byte[] ct = c.doFinal(secret.getBytes(StandardCharsets.UTF_8));
            prefs().edit()
                    .putString("ct", Base64.encodeToString(ct, Base64.NO_WRAP))
                    .putString("iv", Base64.encodeToString(c.getIV(), Base64.NO_WRAP))
                    .apply();
            call.resolve();
        });
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        String ct = prefs().getString("ct", null), iv = prefs().getString("iv", null);
        if (ct == null || iv == null) { call.reject("not enrolled", "notEnrolled"); return; }
        Cipher cipher;
        try {
            cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, existingKey(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
        } catch (KeyPermanentlyInvalidatedException e) {
            clear(); call.reject("biometrics changed", "invalidated"); return;
        } catch (Exception e) {
            clear(); call.reject("key: " + e.getMessage(), "invalidated"); return;
        }
        prompt(call, cipher, (c) -> {
            byte[] plain = c.doFinal(Base64.decode(ct, Base64.NO_WRAP));
            JSObject ret = new JSObject();
            ret.put("secret", new String(plain, StandardCharsets.UTF_8));
            call.resolve(ret);
        });
    }

    private interface OnCipher { void run(Cipher c) throws Exception; }

    private void prompt(PluginCall call, Cipher cipher, OnCipher onOk) {
        getActivity().runOnUiThread(() -> {
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(call.getString("title", "PassForge"))
                    .setSubtitle(call.getString("subtitle", ""))
                    .setNegativeButtonText(call.getString("cancel", "Cancel"))
                    .setAllowedAuthenticators(AUTH)
                    .setConfirmationRequired(false)
                    .build();
            BiometricPrompt bp = new BiometricPrompt((FragmentActivity) getActivity(), ContextCompat.getMainExecutor(getContext()),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            try {
                                BiometricPrompt.CryptoObject co = result.getCryptoObject();
                                onOk.run(co != null && co.getCipher() != null ? co.getCipher() : cipher);
                            } catch (Exception e) { call.reject(e.getMessage(), "error"); }
                        }

                        @Override
                        public void onAuthenticationError(int code, @NonNull CharSequence msg) {
                            boolean cancel = code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON || code == BiometricPrompt.ERROR_CANCELED;
                            boolean lockout = code == BiometricPrompt.ERROR_LOCKOUT || code == BiometricPrompt.ERROR_LOCKOUT_PERMANENT;
                            call.reject(msg.toString(), cancel ? "cancel" : lockout ? "lockout" : "error");
                        }
                    });
            bp.authenticate(info, new BiometricPrompt.CryptoObject(cipher));
        });
    }
}
