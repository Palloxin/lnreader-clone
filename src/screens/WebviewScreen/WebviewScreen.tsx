import React, { useEffect, useRef, useState } from 'react';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPluginAsync } from '@plugins/pluginManager';
import { useBackHandler } from '@hooks';
import { useTheme } from '@hooks/persisted';
import { WebviewScreenProps } from '@navigators/types';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { resolveUrl } from '@services/plugin/fetch';
import {
  WEBVIEW_LOCAL_STORAGE,
  WEBVIEW_SESSION_STORAGE,
  store,
} from '@plugins/helpers/storage';
import Appbar from './components/Appbar';
import Menu from './components/Menu';

type StorageData = {
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
};

const WebviewScreen = ({ route, navigation }: WebviewScreenProps) => {
  const { name, url, pluginId, isNovel } = route.params;
  const [isSave, setSave] = useState(true);
  const { bottom } = useSafeAreaInsets();
  useEffect(() => {
    getPluginAsync(pluginId).then(plugin => {
      setSave(plugin?.webStorageUtilized ?? true);
    });
  }, [pluginId]);

  const theme = useTheme();
  const webViewRef = useRef<WebView | null>(null);

  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState(name || '');
  const [currentUrl, setCurrentUrl] = useState('');
  useEffect(() => {
    let canceled = false;
    resolveUrl(pluginId, url, isNovel).then(url => {
      if (canceled) {
        return;
      }
      setCurrentUrl(url);
    });
    return () => {
      canceled = true;
    };
  }, []);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [tempData, setTempData] = useState<StorageData>();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleNavigation = (e: WebViewNavigation) => {
    if (!e.loading) {
      setTitle(e.title);
    }
    setCurrentUrl(e.url);
    setCanGoBack(e.canGoBack);
    setCanGoForward(e.canGoForward);
  };

  const saveData = () => {
    if (pluginId && tempData && isSave) {
      store.set(
        pluginId + WEBVIEW_LOCAL_STORAGE,
        JSON.stringify(tempData?.localStorage || {}),
      );
      store.set(
        pluginId + WEBVIEW_SESSION_STORAGE,
        JSON.stringify(tempData?.sessionStorage || {}),
      );
    }
  };

  useBackHandler(() => {
    if (menuVisible) {
      setMenuVisible(false);
      return true;
    }
    if (canGoBack) {
      webViewRef.current?.goBack();
      return true;
    }
    saveData();
    return false;
  });

  const injectJavaScriptCode =
    'window.ReactNativeWebView.postMessage(JSON.stringify({localStorage, sessionStorage}))';

  return (
    <>
      <Appbar
        title={title}
        theme={theme}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        webView={webViewRef}
        setMenuVisible={setMenuVisible}
        goBack={() => {
          saveData();
          navigation.goBack();
        }}
      />
      <ProgressBar
        color={theme.primary}
        progress={progress}
        visible={progress !== 1}
      />
      {currentUrl ? (
        <WebView
          userAgent={getUserAgent()}
          ref={webViewRef}
          source={{ uri: currentUrl }}
          setDisplayZoomControls={true}
          setBuiltInZoomControls={false}
          setSupportMultipleWindows={false}
          injectedJavaScript={injectJavaScriptCode}
          onNavigationStateChange={handleNavigation}
          onLoadProgress={({ nativeEvent }) =>
            setProgress(nativeEvent.progress)
          }
          onMessage={({ nativeEvent }) =>
            setTempData(JSON.parse(nativeEvent.data))
          }
          containerStyle={{ paddingBottom: bottom }}
        />
      ) : null}
      {menuVisible ? (
        <Menu
          theme={theme}
          currentUrl={currentUrl}
          webView={webViewRef}
          setMenuVisible={setMenuVisible}
        />
      ) : null}
    </>
  );
};

export default WebviewScreen;
