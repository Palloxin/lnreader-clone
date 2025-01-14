import { assetsUriPrefix } from '@screens/reader/components/WebViewReader';
import { fetchApi } from '@plugins/helpers/fetch';
import { Plugin, PopularNovelsOptions } from '@plugins/types';
import { Filters } from '@plugins/types/filterTypes';
import { JsContext, PluginManager } from '@native/PluginManager';
import { defaultCover } from '@plugins/helpers/constants';

interface PluginThread {
  initPlugin(pluginId: string, pluginCode: string): Promise<Plugin>;
}

export function getPluginThread(): PluginThread {
  return {
    async initPlugin(pluginId: string, pluginCode: string): Promise<Plugin> {
      console.log('initPlugin', pluginId);
      await loadPlugin(pluginId, pluginCode);
      console.log('initPlugin-finished', pluginId);

      return {
        // url: string; // the url of raw code
        // iconUrl: string;
        // customJS?: string;
        // customCSS?: string;
        // hasUpdate?: boolean;
        // hasSettings?: boolean;
        id: await webviewCode(pluginId, `return plugin.id;`),
        name: await webviewCode(pluginId, `return plugin.name;`),
        lang: await webviewCode(pluginId, `return plugin.lang;`),
        icon: await webviewCode(pluginId, `return plugin.icon;`),
        site: await webviewCode(pluginId, `return plugin.site;`),
        version: await webviewCode(pluginId, `return plugin.version;`),
        filters: await webviewCode(pluginId, `return plugin.filters;`),
        imgRequestInit: await webviewCode(
            pluginId,
            `return plugin.imgRequestInit;`,
        ),
        pluginSettings: await webviewCode(
            pluginId,
            `return plugin.pluginSettings;`,
        ),
        // @ts-ignore
        popularNovels: async (
            pageNo: number,
            options?: PopularNovelsOptions<Filters>,
        ) => {
          console.log(pluginId, "popularNovels", pageNo, options)
          return await webviewCodeAsync(
              pluginId,
              `return await plugin.popularNovels(${JSON.stringify(
                  pageNo,
              )}, ${JSON.stringify(options)});`,
          );
        },
        // @ts-ignore
        parseNovel: async (novelPath: string) => {
          console.log(pluginId, 'parseNovel', novelPath);
          return await webviewCodeAsync(
              pluginId,
              `return await plugin.parseNovel(${JSON.stringify(novelPath)});`,
          );
        },
        // @ts-ignore
        parsePage: (await webviewCode(pluginId, `return !!plugin.parsePage;`))
            ? async (novelPath: string, page: string) => {
              console.log(pluginId, 'parsePage', novelPath, page);
              return await webviewCodeAsync(
                  pluginId,
                  `return await plugin.parsePage(${JSON.stringify(
                      novelPath,
                  )}, ${JSON.stringify(page)});`,
              );
            }
            : undefined,
        // @ts-ignore
        parseChapter: async (chapterPath: string) => {
          console.log(pluginId, 'parseChapter', chapterPath);
          return await webviewCodeAsync(
              pluginId,
              `return await plugin.parseChapter(${JSON.stringify(chapterPath)});`,
          );
        },
        // @ts-ignore
        searchNovels: async (searchTerm: string, pageNo: number) => {
          console.log(pluginId, 'searchNovels', searchTerm, pageNo);
          return await webviewCodeAsync(
              pluginId,
              `return await plugin.searchNovels(${JSON.stringify(
                  searchTerm,
              )}, ${JSON.stringify(pageNo)});`,
          );
        },
        // @ts-ignore
        resolveUrl: (await webviewCode(pluginId, `return !!plugin.resolveUrl;`))
            ? async (path: string, isNovel?: boolean) => {
              console.log(pluginId, 'resolveUrl', path, isNovel);
              return await webviewCodeAsync(
                  pluginId,
                  `return await plugin.resolveUrl(${JSON.stringify(
                      path,
                  )}, ${JSON.stringify(isNovel)});`,
              );
            }
            : undefined,
        webStorageUtilized: await webviewCode(
            pluginId,
            `return plugin.webStorageUtilized;`,
        ),
      };
    },
  };
}

let webviewCallbacks = new Map<
  number,
  (ret: any | null, err: string | null) => void
>();

async function webviewCode(pluginId: string, code: string) {
  let context = await getPluginContext();
  return JSON.parse(
    await context.eval(
      `(new Function("plugin", ${JSON.stringify(
        code,
      )}))(pluginsMap.get(${JSON.stringify(pluginId)}))`,
    ),
  );
}

async function webviewCodeAsync(pluginId: string, code: string) {
  let id = Math.floor(Math.random() * 100000);

  return new Promise(async (resolve, reject) => {
    webviewCallbacks.set(id, (ret: any, err: string | null) => {
      if (err !== null) reject(new Error(err));
      else resolve(ret);
    });

    let context = await getPluginContext();
    context.eval(`(new AsyncFunction("plugin", ${JSON.stringify(
      code,
    )}))(pluginsMap.get(${JSON.stringify(pluginId)})).then(ret=>{
			window.PluginManager.sendMessage(JSON.stringify({
				type: 'webview-code-res',
				id: ${id},
				data: ret
			}));
		}).catch(err=>{
          console.error(err.stack);
			window.PluginManager.sendMessage(JSON.stringify({
				type: 'webview-code-err',
				id: ${id},
				msg: err.message
			}));
		});`);
  });
}

async function loadPlugin(pluginId: string, pluginCode: string) {
  // loadedPlugins.add(pluginId);
  let context = await getPluginContext();
  await context.eval(`
    loadPlugin(${JSON.stringify(pluginId)}, ${JSON.stringify(pluginCode)});
  `);
}

let pluginContext: JsContext | null = null;

async function getPluginContext(): Promise<JsContext> {
  if (!pluginContext) {
    let resData = new Map();

    let con = await PluginManager.createJsContext(
      // language=HTML
      `
				<!DOCTYPE html>
				<html>
				<!-- Cheerio is just implementing jquery for places without a builtin html parser, so cus this is a browser, just use browsers html parser -->
				<!--		  <script src="${assetsUriPrefix}/plugin_deps/jquery-3.7.1.min.js"></script>-->

				<!--                TODO: host our own bundles -->
				<script src="https://bundle.run/cheerio@1.0.0-rc.6"></script>
				<script src="https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js"></script>

				</html>
            `,
      (data: string) => {
        const event = JSON.parse(data);
        if (__DEV__) {
          if (event.type !== 'webview-code-res') {
            console.log('[Plugin Native Req] ' + data);
          } else {
            console.log(
              '[Plugin Native Res] ' +
                JSON.stringify({ ...event, data: '[REDACTED FOR SPACE]' }),
            );
          }
        }
        switch (event.type) {
          case 'webview-code-res':
            webviewCallbacks.get(event.id)?.(event.data, null);
            break;
          case 'webview-code-err':
            webviewCallbacks.get(event.id)?.(null, event.msg);
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
                status: res.status,
                url: res.url,
                resId: resId,
              };
              pluginContext!.eval(
                `nativeRes(${event.id}, ${JSON.stringify(data)});`,
              );
            }).catch(err=>{
              pluginContext!.eval(
                  `nativeResErr(${event.id}, ${JSON.stringify(err?.message)});`,
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
      //NOTE: this is duplicated in plugin/types/index.ts
      const NovelStatus = {
        Unknown : 'Unknown',
        Ongoing : 'Ongoing',
        Completed : 'Completed',
        Licensed : 'Licensed',
        PublishingFinished : 'Publishing Finished',
        Cancelled : 'Cancelled',
        OnHiatus : 'On Hiatus',
        "Publishing Finished" : 'PublishingFinished',
        "On Hiatus" : 'OnHiatus',
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
          'dayjs': dayjs,
          // 'urlencode': { encode, decode },
          '@libs/novelStatus': { NovelStatus },
          // '@libs/fetch': { fetchApi, fetchText, fetchProto },
          '@libs/fetch': {
              fetchApi: async function (...params) {
                  let nativeFetchData = await native('fetchApi', params);
                  return {
                      ok: nativeFetchData.ok,
                      status: nativeFetchData.status,
                      url: nativeFetchData.url,
                      text: async function () {
                          return await native('fetchApi-text', nativeFetchData.resId);
                      },
                      json: async function () {
                          return await native('fetchApi-json', nativeFetchData.resId);
                      },
                  }
              }
          },
          '@libs/isAbsoluteUrl': {isUrlAbsolute},
          '@libs/filterInputs': {FilterTypes},
          '@libs/defaultCover': { defaultCover: ${JSON.stringify(
            defaultCover,
          )} },
      };

      let nativeCallbacks = new Map();

      async function native(type, data) {
          let id = Math.floor(Math.random() * 100000);

          return new Promise((resolve, reject) => {
              nativeCallbacks.set(id, (ret, err) => {
				  if(err !== null) reject(new Error(err))
                  else resolve(ret);
              });

              window.PluginManager.sendMessage(JSON.stringify({
                  type,
                  id,
                  data
              }));
          });
      }

      function nativeRes(id, res) {
          nativeCallbacks.get(id)(res, null);
      }
      function nativeResErr(id, res) {
          nativeCallbacks.get(id)(null, res);
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
			  if(!(packageName in packages)){
				  console.error(pluginId + " is importing unknown package: " + packageName)
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
