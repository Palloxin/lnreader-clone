#Generates the dependancy bundle for the plugin thread
browserify -r htmlparser2 -r cheerio -r dayjs > android/app/src/main/assets/plugin_deps/bundle.js