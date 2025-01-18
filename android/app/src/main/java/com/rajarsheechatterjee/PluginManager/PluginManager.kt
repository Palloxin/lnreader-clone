package com.rajarsheechatterjee.PluginManager

import android.annotation.SuppressLint
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule


class PluginManager(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {
    val plugins: MutableMap<String, PluginContext> = mutableMapOf()

    override fun getName(): String {
        return "PluginManager"
    }

    @SuppressLint("SetJavaScriptEnabled")
    @ReactMethod
    fun createJsContext(html: String, promise: Promise) {
        this.reactApplicationContext.runOnUiQueueThread {
            val view = WebView(this.reactApplicationContext.applicationContext)
            val pluginContext = PluginContext(view)
//            view.loadUrl("https://soopy.dev")
            view.settings.javaScriptEnabled = true
            view.loadData(html, "text/html; charset=utf-8", "UTF-8")
            view.addJavascriptInterface(object {
                @JavascriptInterface
                fun sendMessage(message: String) {
                    reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("PluginManager", Arguments.createMap().apply {
                            putString("id", pluginContext.uuid)
                            putString("message", message)
                        })
                }
            }, "PluginManager")
            view.webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    promise.resolve(pluginContext.uuid)
                }
            }
            view.webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit(
                            "NativeDebug",
                            "[PluginManagerWebConsole] ${consoleMessage?.message()}"
                        )
                    return super.onConsoleMessage(consoleMessage)
                }
            }
            plugins[pluginContext.uuid] = pluginContext
        }
    }

    @ReactMethod
    fun eval(id: String, js: String, promise: Promise) {
        this.reactApplicationContext.runOnUiQueueThread {
            plugins[id]?.eval(js, promise)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }
}