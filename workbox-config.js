module.exports = {
  "globDirectory": "public/",
  "globPatterns": [
    "**/*.{html,ico,json,js,css}",
    "src/images/*.{jpg,png}"
  ],
  "swSrc": "public/sw-base.js",
  "swDest": "public/sw.js",
  "globIgnores": [
    "help/**",
    "src/images/app-icons-lib/**",
    "src/js/*.js"
  ]
};