# Reminder-page font

The server-rendered booking reminder page uses the original Quicksand variable
font (weights 300–700), served at `/fonts/quicksand-variable.ttf` by the frontend.
The reminder worker already generates URLs on `FRONTEND_URL`, and the existing
same-origin API rewrite serves the backend HTML. Deploy frontend public assets
together with the API; direct backend-only hosting does not provide this font.
System fonts remain available if the asset cannot load.

- Source: [Google Fonts Quicksand](https://github.com/google/fonts/blob/main/ofl/quicksand/Quicksand%5Bwght%5D.ttf).
- Retrieved: 24 September 2026. Original, unmodified TTF: 124,824 bytes.
- SHA-256: `39c9b64223561f56aaff6062a6f04063c4fc86809ad6768722c06614d977e1cc`.
- Copyright and SIL Open Font License 1.1 are included in
  [Quicksand-OFL.txt](../public/fonts/Quicksand-OFL.txt). Retain that notice when distributing the asset.

There is no runtime request to a third-party font server from this private page.
Other application pages retain their existing `next/font` configuration.
