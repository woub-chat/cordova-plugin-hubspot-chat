package com.woub.plugins.hubspot;

import android.content.Intent;
import android.util.Log;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.hubspot.mobilesdk.HubspotManager;
import com.hubspot.mobilesdk.HubspotWebActivity;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

public class HubspotChatPlugin extends CordovaPlugin {

    private static final String TAG = "HubspotChatPlugin";
    private boolean isConfigured = false;

    @Override
    protected void pluginInitialize() {
        super.pluginInitialize();
        configureSDK();
    }

    private void configureSDK() {
        if (isConfigured) return;

        try {
            HubspotManager manager = HubspotManager.getInstance(cordova.getActivity());
            manager.configure();
            isConfigured = true;
            Log.d(TAG, "HubSpot SDK configured successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to configure HubSpot SDK: " + e.getMessage());
        }
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        switch (action) {
            case "configure":
                configure(callbackContext);
                return true;
            case "show":
                String chatFlow = args.optString(0, null);
                show(chatFlow, callbackContext);
                return true;
            case "hide":
                hide(callbackContext);
                return true;
            case "setUserIdentity":
                String email = args.optString(0, null);
                String identityToken = args.optString(1, null);
                setUserIdentity(email, identityToken, callbackContext);
                return true;
            case "clearUserIdentity":
                clearUserIdentity(callbackContext);
                return true;
            case "setChatProperties":
                JSONObject properties = args.optJSONObject(0);
                setChatProperties(properties, callbackContext);
                return true;
            case "logout":
                logout(callbackContext);
                return true;
            default:
                return false;
        }
    }

    private void configure(CallbackContext callbackContext) {
        configureSDK();
        if (isConfigured) {
            callbackContext.success("Configured");
        } else {
            callbackContext.error("Failed to configure HubSpot SDK");
        }
    }

    private void show(String chatFlow, CallbackContext callbackContext) {
        if (!isConfigured) {
            callbackContext.error("HubSpot SDK not configured");
            return;
        }

        cordova.getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(cordova.getActivity(), HubspotWebActivity.class);
                if (chatFlow != null && !chatFlow.isEmpty()) {
                    intent.putExtra("chatFlow", chatFlow);
                }
                cordova.getActivity().startActivity(intent);
                callbackContext.success();
            } catch (Exception e) {
                Log.e(TAG, "Failed to open chat: " + e.getMessage());
                callbackContext.error("Failed to open chat: " + e.getMessage());
            }
        });
    }

    private void hide(CallbackContext callbackContext) {
        cordova.getActivity().runOnUiThread(() -> {
            try {
                cordova.getActivity().finishActivity(0);
                callbackContext.success();
            } catch (Exception e) {
                callbackContext.error("Failed to hide chat: " + e.getMessage());
            }
        });
    }

    private void setUserIdentity(String email, String identityToken, CallbackContext callbackContext) {
        if (email == null || email.isEmpty()) {
            callbackContext.error("Email is required");
            return;
        }

        try {
            HubspotManager manager = HubspotManager.getInstance(cordova.getActivity());
            manager.setUserIdentity(email, identityToken);
            callbackContext.success();
        } catch (Exception e) {
            callbackContext.error("Failed to set user identity: " + e.getMessage());
        }
    }

    private void clearUserIdentity(CallbackContext callbackContext) {
        try {
            HubspotManager manager = HubspotManager.getInstance(cordova.getActivity());
            // SDK doesn't have clearUserIdentity, so set empty values
            manager.setUserIdentity("", "");
            callbackContext.success();
        } catch (Exception e) {
            callbackContext.error("Failed to clear user identity: " + e.getMessage());
        }
    }

    private void setChatProperties(JSONObject properties, CallbackContext callbackContext) {
        if (properties == null) {
            callbackContext.error("Properties must be provided");
            return;
        }

        try {
            HubspotManager manager = HubspotManager.getInstance(cordova.getActivity());
            Map<String, String> propsMap = new HashMap<>();
            
            Iterator<String> keys = properties.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                propsMap.put(key, properties.optString(key, ""));
            }
            
            manager.setChatProperties(propsMap);
            callbackContext.success();
        } catch (Exception e) {
            callbackContext.error("Failed to set chat properties: " + e.getMessage());
        }
    }

    private void logout(CallbackContext callbackContext) {
        try {
            HubspotManager manager = HubspotManager.getInstance(cordova.getActivity());
            // logout() is a suspend function (Kotlin coroutine), so just clear identity instead
            manager.setUserIdentity("", "");
            callbackContext.success();
        } catch (Exception e) {
            callbackContext.error("Failed to logout: " + e.getMessage());
        }
    }
}
