import { MMKV, platformContext } from 'react-native-mmkv';

export const MMKVStorage = new MMKV();
console.log(platformContext?.getBaseDirectory());
export function getMMKVObject<T>(key: string) {
  const data = MMKVStorage.getString(key);
  if (data) {
    return JSON.parse(data) as T;
  }
  return undefined;
}

export function setMMKVObject<T>(key: string, obj: T) {
  MMKVStorage.set(key, JSON.stringify(obj));
}
