import React,{Suspense} from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { ConnectedRouter } from 'react-router-redux';
import { createHashHistory } from 'history';
import { Feedback } from '@icedesign/base';

// 载入默认全局样式 normalize 、.clearfix 和一些 mixin 方法等
import '@icedesign/base/reset.scss';

import router from './router';
import configureStore from './configureStore';
import cookie from 'react-cookies';
import { setLang } from './utils/lang';
import * as constant from './utils/constant';
import {I18nextProvider} from 'react-i18next';
import i18n from './i18n';
import { DrizzleContext } from "@drizzle/react-plugin";
import { Drizzle } from "@drizzle/store";
import drizzleOptions from "./drizzleOptions";

const drizzle = new Drizzle(drizzleOptions);
console.log('drizzle', drizzle);

if (window.ethereum && window.ethereum.networkVersion != '128') {
  Feedback.toast.error("请将MetaMask连接到Heco网络，否则您无法正常使用本网站");
}

const defaultLang = cookie.load('defaultLang');
if (defaultLang != null) {
  setLang(defaultLang);
}

// Create redux store with history
const initialState = {};
const history = createHashHistory();
const store = configureStore(initialState, history);
const ICE_CONTAINER = document.getElementById('ice-container');

if (!window.localStorage) {
  Feedback.toast.warn(T('请升级浏览器，当前浏览器无法保存交易结果'));
}
if (!ICE_CONTAINER) {
  throw new Error('当前页面不存在 <div id="ice-container"></div> 节点.');
}

ReactDOM.render(
  <Provider store={store}>
    <Suspense fallback='loading'>
      <I18nextProvider i18n={i18n}>
          <ConnectedRouter history={history}>{router()}</ConnectedRouter>
      </I18nextProvider>
    </Suspense>
  </Provider>,
  ICE_CONTAINER
);
