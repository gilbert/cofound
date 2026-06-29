{
  "targets": [
    {
      "target_name": "eyedropper",
      "sources": [],
      "conditions": [
        ["OS=='win'", {
          "sources": ["win.c"]
        }],
        ["OS=='mac'", {
          "sources": ["mac.c"],
          "xcode_settings": {
            "OTHER_CFLAGS": ["-mmacosx-version-min=10.14.6"],
            "OTHER_LDFLAGS": ["-framework ApplicationServices"]
          }
        }],
        ["OS=='linux'", {
          "sources": ["linux.c"],
          "libraries": ["-lX11"]
        }]
      ]
    }
  ]
}
