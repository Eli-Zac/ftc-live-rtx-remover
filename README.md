# FTC Live RTX Remover

Removes the "Presented by RTX" mark from FIRST Tech Challenge Live (FTC Scoring) pages, on any server IP.

The RTX mark isn't a separate element on the page. It's baked into the season logo SVGs as a strip along the bottom, so both tools here crop that strip off and leave the rest of the logo intact.

Two versions:

| | Use it for | How it works |
|---|---|---|
| [Chrome extension](#chrome-extension) | Displays opened in Chrome or Edge | Detects the sponsor strip automatically, so it keeps working if the artwork changes |
| [OBS script](#obs-script) | OBS browser sources | Adds CSS to every FTC Live browser source |

## Chrome extension

1. Download this repo (**Code → Download ZIP**) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.
4. Reload any open FTC Live tabs.

It runs on any `http`/`https` host but only activates on pages served by FTC Live. Other sites are untouched.

## OBS script

1. Download [`obs/ftc-live-rtx-remover.lua`](obs/ftc-live-rtx-remover.lua).
2. In OBS: **Tools → Scripts → +**, and select the file.
3. Add browser sources as normal.

Any browser source with a URL like `http://<server>/event/<code>/...` gets the CSS added automatically, including sources created later. It's added after your existing Custom CSS, so transparent backgrounds and other tweaks stay. Use **Apply now** in the script panel to force it straight away.

### Manual CSS (no script)

Paste this into a browser source's **Custom CSS** box, below the existing line:

```css
img[src*="_primary_word"]{aspect-ratio:373/72 !important;object-fit:cover !important;object-position:top !important}
img[src*="_primary_wide"]{aspect-ratio:383/69.2 !important;object-fit:cover !important;object-position:left !important}
img[src*="_season_primary_color"],img[src*="/ftc/2027/color"]{aspect-ratio:414/234 !important;object-fit:cover !important;object-position:top !important}
img[src*="/ftc/2025/color"]{aspect-ratio:649/593 !important;object-fit:cover !important;object-position:top !important}
img[src*="/ftc/2026/color"]{aspect-ratio:234/315 !important;object-fit:cover !important;object-position:top !important}
```

## Limitations

- **Result videos.** The red/blue/tie win animations are video files and aren't changed.
- **Event sponsors.** Logos uploaded in FTC Live's event sponsor settings are shown as normal sponsor images and aren't touched.
- **OBS only: future artwork.** The OBS crop sizes are fixed for the current logos. If an FTC Live update changes the artwork, they may need updating. The Chrome extension adapts on its own.
- **OBS only: new sources.** A newly added browser source can show the logo for up to a second before the script patches it.

Tested against FTC Live v8.0.3.
