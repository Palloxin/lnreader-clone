import WebView from 'react-native-webview';
import React from 'react';
import { assetsUriPrefix, onLogMessage } from "@screens/reader/components/WebViewReader";

interface PluginThread {
  initPlugin(pluginId: string, pluginCode: string): Plugin;
}

export function getPluginThread(): PluginThread {
  getWebView();
  return {
    initPlugin(pluginId: string, pluginCode: string) {
      return getWebView().injectJavaScript(
        `loadPlugin(${JSON.stringify(pluginId)}, ${JSON.stringify(pluginCode)})`,
      );
    },
  };
}

let webview: any | null = null;

function getWebView() {
  if (!webview) {
    webview = React.createElement(WebView, {
      javaScriptEnabled: true,
      onMessage: (ev: { nativeEvent: { data: string } }) => {
        __DEV__ && onLogMessage(ev);
        const event = JSON.parse(ev.nativeEvent.data);
        switch (event.type) {
          case 'save':
            if (event.data && typeof event.data === 'number') {
              saveProgress(event.data);
            }
            break;
          case 'debug':
            //already logged by the onLogMessage
            // if (event.data && typeof event.data === 'string') {
            //   console.log(event.data);
            // }
            break;
        }
      },
      source: {
        baseUrl: undefined,
        html: `
        <!DOCTYPE html>
          <html>
              <--! Cheerio is just implementing jquery for places without a builtin html parser, so cus this is a browser, just use browsers html parser -->
              <script src="${assetsUriPrefix}/plugin_deps/jquery-3.7.1.min.js"></script>
              
              <script>
                window.pluginsMap = new Map();
                window.loadPlugin = function(pluginId, pluginCode) {
                  const plugin = initPlugin(pluginId, pluginCode);
                  window.plugin = plugin;
                }
				
                const packages = {
                  // 'htmlparser2': { Parser },
                  // 'cheerio': { load },
                  'cheerio': {
                    load: function(html) {
                      let elm = document.createElement('div');
                      elm.innerHTML = html;
                      return $(elm.firstChild);
                    },
                  // 'dayjs': dayjs,
                  // 'urlencode': { encode, decode },
                  // '@libs/novelStatus': { NovelStatus },
                  // '@libs/fetch': { fetchApi, fetchText, fetchProto },
                  // '@libs/isAbsoluteUrl': { isUrlAbsolute },
                  // '@libs/filterInputs': { FilterTypes },
                  // '@libs/defaultCover': { defaultCover },
                };
				function initPlugin(pluginId, pluginCode) {
                  const _require = (packageName) => {
                    if (packageName === '@libs/storage') {
                      return {
                        storage: new Storage(pluginId),
                        localStorage: new LocalStorage(pluginId),
                        sessionStorage: new SessionStorage(pluginId),
                      };
                    }
                    return packages[packageName];
                  };
                  
                  return Function(
                    'require',
                    'module',
                    'const exports = module.exports = {};\\n' + pluginCode + '\\nreturn exports.default',
                  )(_require, {});
                }
              </script>
          </html>
          `,
      },
    });
  }
  return webview;
}
