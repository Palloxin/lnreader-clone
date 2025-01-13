import { assetsUriPrefix } from '@screens/reader/components/WebViewReader';
import { fetchApi } from '@plugins/helpers/fetch';
import { Plugin, PopularNovelsOptions } from '@plugins/types';
import { Filters } from '@plugins/types/filterTypes';
import { PluginContext, PluginManager } from '@native/PluginManager';

interface PluginThread {
  initPlugin(pluginId: string, pluginCode: string): Promise<Plugin>;
}

// let loadedPlugins = new Set<string>();

export function getPluginThread(): PluginThread {
  return {
    async initPlugin(pluginId: string, pluginCode: string) {
      console.log('initPlugin', pluginId);
      await loadPlugin(pluginId, pluginCode);

      let ret = {
        id: await webviewCode(pluginId, `return plugin.id;`),
        name: await webviewCode(pluginId, `return plugin.name;`),
        icon: await webviewCode(pluginId, `return plugin.icon;`),
        site: await webviewCode(pluginId, `return plugin.site;`),
        version: await webviewCode(pluginId, `return plugin.version;`),
        filters: await webviewCode(pluginId, `return plugin.filters;`),
        pluginSettings: await webviewCode(pluginId, `return plugin.pluginSettings;`),
        // imageRequestInit?: ImageRequestInit;
        // filters?: Filters;
        // pluginSettings: any;
        popularNovels: async (
          pageNo: number,
          options?: PopularNovelsOptions<Filters>,
        ) => {
          return await webviewCodeAsync(
            pluginId,
            `return await plugin.popularNovels(${JSON.stringify(
              pageNo,
            )}, ${JSON.stringify(options)});`,
          );
        },
        // parseNovel: (novelPath: string) => Promise<SourceNovel>;
        // parsePage?: (novelPath: string, page: string) => Promise<SourcePage>;
        // parseChapter: (chapterPath: string) => Promise<string>;
        // searchNovels: (searchTerm: string, pageNo: number) => Promise<NovelItem[]>;
        // resolveUrl?: (path: string, isNovel?: boolean) => string;
        // webStorageUtilized?: boolean;
      };
      console.log(ret);
      return ret;
    },
  };
}

let webviewCallbacks = new Map<number, (ret: any) => void>();

async function webviewCode(pluginId: string, code: string) {
  let context = await getPluginContext();
  return JSON.parse(await context.eval(`
	(new Function("plugin", ${JSON.stringify(
    code,
  )}))(pluginsMap.get(${JSON.stringify(pluginId)}))
  `));
}

async function webviewCodeAsync(pluginId: string, code: string) {
  let id = Math.floor(Math.random() * 100000);

  return new Promise(async resolve => {
    webviewCallbacks.set(id, (ret: any) => {
      resolve(ret);
    });

    let context = await getPluginContext();
    context.eval(`
		(new AsyncFunction("plugin", ${JSON.stringify(
      code,
    )}))(pluginsMap.get(${JSON.stringify(pluginId)})).then(ret=>{
			window.PluginManager.sendMessage(JSON.stringify({
				type: 'webview-code-res',
				id: ${id},
				data: ret
			}));
		}).catch(err=>{
          console.error(err.stack);
		});
	`);
  });
}

async function loadPlugin(pluginId: string, pluginCode: string) {
  // loadedPlugins.add(pluginId);
  let context = await getPluginContext();
  await context.eval(`
    loadPlugin(${JSON.stringify(pluginId)}, ${JSON.stringify(
    pluginCode,
  )});
  `);
}

let pluginContext: PluginContext | null = null;

async function getPluginContext(): PluginContext {
  if (!pluginContext) {
    let resData = new Map();

    let con = await PluginManager.createJsContext(
      // language=HTML
      `
		  <!DOCTYPE html>
		  <html>
		  <!-- Cheerio is just implementing jquery for places without a builtin html parser, so cus this is a browser, just use browsers html parser -->
<!--		  <script src="${assetsUriPrefix}/plugin_deps/jquery-3.7.1.min.js"></script>-->

          <script src="https://bundle.run/cheerio@1.0.0-rc.6"></script>
		  </html>
      `,
      (data: string) => {
        __DEV__ && console.log('[Plugin Native Req] ' + data);
        const event = JSON.parse(data);
        switch (event.type) {
          case 'webview-code-res':
            webviewCallbacks.get(event.id)?.(event.data);
            break;
          case 'fetchApi':
            // @ts-ignore
            fetchApi(...event.data).then(res => {
              let resId = Math.floor(Math.random() * 100000);
              resData.set(resId, res);
              setTimeout(() => {
                resData.delete(resId);
              }, 10000);

              let data = {
                ok: res.ok,
                resId: resId,
              };
              pluginContext!.eval(
                `nativeRes(${event.id}, ${JSON.stringify(data)});`,
              );
            });
            break;
          case 'fetchApi-text':
            resData
              .get(event.data)
              .text()
              // @ts-ignore
              .then(res => {
                pluginContext!.eval(
                  `nativeRes(${event.id}, ${JSON.stringify(res)});`,
                );
              });
          case 'debug':
            //already logged by the onLogMessage
            break;
        }
      },
    );
    //TODO: in native code when creating the js context we need to wait for it to finish loading
    await new Promise(resolve => setTimeout(resolve, 5000));
    await con.eval(`
      window.onerror = function (msg, url, lineNo, columnNo, error) {
        console.error(error.stack)
      }
	  window.onunhandledrejection = function (t, ev) {
        console.error(ev.stack)
	  }
	  
      const AsyncFunction = Object.getPrototypeOf(async function () {
      }).constructor;

      let pluginsMap = new Map();
      function loadPlugin(pluginId, pluginCode) {
          let plugin = initPlugin(pluginId, pluginCode);
          pluginsMap.set(pluginId, plugin);
      }

      //NOTE: this is duplicated in filterTypes.ts
      const FilterTypes = {
          TextInput: 'Text',
          Picker: 'Picker',
          CheckboxGroup: 'Checkbox',
          Switch: 'Switch',
          ExcludableCheckboxGroup: 'XCheckbox',
          Text: 'TextInput',
          Checkbox: 'CheckboxGroup',
          XCheckbox: 'ExcludableCheckboxGroup',
      }

      const packages = {
          // 'htmlparser2': { Parser },
          'cheerio': { load: cheerio.load },
          // 'cheerio': {
          //     load: function (html) {
          //         let parser = new DOMParser();
          //         let elm = parser.parseFromString(html, 'text/html');
			//	  
            //       return (inp) => {
			// 		  let ret = $(elm, inp)
			// 		  console.log(inp, JSON.stringify(ret))
			// 		  return ret;
            //       };
            //   }
          // },
          // 'dayjs': dayjs,
          // 'urlencode': { encode, decode },
          // '@libs/novelStatus': { NovelStatus },
          // '@libs/fetch': { fetchApi, fetchText, fetchProto },
          '@libs/fetch': {
              fetchApi: async function (...params) {
                  let nativeFetchData = await native('fetchApi', params);
                  return {
                      ok: nativeFetchData.ok,
                      text: async function () {
                          return await native('fetchApi-text', nativeFetchData.resId);
                      },
                      json: async function () {
                          //TODO
                      },
                  }
              }
          },
          '@libs/isAbsoluteUrl': {isUrlAbsolute},
          '@libs/filterInputs': {FilterTypes},
          // '@libs/defaultCover': { defaultCover },
      };

      let nativeCallbacks = new Map();

      async function native(type, data) {
          let id = Math.floor(Math.random() * 100000);

          return new Promise(resolve => {
              nativeCallbacks.set(id, (ret) => {
                  resolve(ret);
              });

              window.PluginManager.sendMessage(JSON.stringify({
                  type,
                  id,
                  data
              }));
          });
      }

      window.nativeRes = function (id, res) {
          nativeCallbacks.get(id)(res);
      }

      function initPlugin(pluginId, pluginCode) {
          const _require = (packageName) => {
              if (packageName === '@libs/storage') {
                  return {
                      // storage: new Storage(pluginId),
                      // localStorage: new LocalStorage(pluginId),
                      // sessionStorage: new SessionStorage(pluginId),
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

      function isUrlAbsolute(url) {
          if (url) {
              if (url.indexOf('//') === 0) {
                  return true;
              } // URL is protocol-relative (= absolute)
              if (url.indexOf('://') === -1) {
                  return false;
              } // URL has no protocol (= relative)
              if (url.indexOf('.') === -1) {
                  return false;
              } // URL does not contain a dot, i.e. no TLD (= relative, possibly REST)
              if (url.indexOf('/') === -1) {
                  return false;
              } // URL does not contain a single slash (= relative)
              if (url.indexOf(':') > url.indexOf('/')) {
                  return false;
              } // The first colon comes after the first slash (= relative)
              if (url.indexOf('://') < url.indexOf('.')) {
                  return true;
              } // Protocol is defined before first dot (= absolute)
          }
          return false; // Anything else must be relative
      }
	`);
    pluginContext = con;
  }

  return pluginContext;
}
